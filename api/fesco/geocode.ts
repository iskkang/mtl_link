import ws from 'ws'
;(globalThis as any).WebSocket = ws

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { geocodeLocation } from '../utils/mapbox'
import { parseRoute } from '../utils/route'

const BACKOFF_HOURS = 24
const DEFAULT_LIMIT = 100

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }

  // Same CRON_SECRET guard as /api/fesco/sync — production only.
  if (process.env.VERCEL_ENV === 'production') {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return res.status(500).json({ ok: false, error: 'CRON_SECRET is not configured' })
    }
    const authHeader = (req.headers['authorization'] ?? '').toString()
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ ok: false, error: 'unauthorized' })
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Supabase env not set' })
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  const body    = typeof req.body === 'object' ? req.body : {}
  const dryRun  = body.dryRun === true || body.dryRun === 'true'
  const limit   = Math.min(Math.max(parseInt(String(body.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1), 500)

  // ── 1. Collect distinct location strings ───────────────────────────────────

  const [trackingRes, ordersRes] = await Promise.all([
    supabase
      .from('fesco_container_tracking_current')
      .select('current_to')
      .not('current_to', 'is', null),
    supabase
      .from('fesco_orders')
      .select('route_latin')
      .not('route_latin', 'is', null),
  ])

  const rawLocations = new Set<string>()

  for (const row of (trackingRes.data ?? []) as { current_to: string }[]) {
    const v = row.current_to?.trim()
    if (v) rawLocations.add(v)
  }

  for (const row of (ordersRes.data ?? []) as { route_latin: string }[]) {
    const parsed = parseRoute(row.route_latin)
    if (parsed.origin)      rawLocations.add(parsed.origin)
    if (parsed.destination) rawLocations.add(parsed.destination)
  }

  const totalUniqueLocations = rawLocations.size

  if (dryRun) {
    return res.json({
      ok: true,
      dryRun: true,
      totalUniqueLocations,
      alreadyCached:         0,
      newlyGeocoded:         0,
      failed:                0,
      skippedBackoff:        0,
      remainingUnprocessed:  0,
      note: 'dry run — no DB writes or Mapbox calls',
    })
  }

  // ── 2. Load existing cache entries ─────────────────────────────────────────

  const normalizedList = [...rawLocations].map(v => v.toLowerCase())

  const { data: existing } = await supabase
    .from('city_coordinates')
    .select('query_normalized, geocoded_at, last_attempt_at')
    .in('query_normalized', normalizedList)

  const cacheMap = new Map<string, { geocoded_at: string | null; last_attempt_at: string | null }>()
  for (const row of (existing ?? []) as { query_normalized: string; geocoded_at: string | null; last_attempt_at: string | null }[]) {
    cacheMap.set(row.query_normalized, { geocoded_at: row.geocoded_at, last_attempt_at: row.last_attempt_at })
  }

  // ── 3. Process each location serially ──────────────────────────────────────

  const backoffMs = BACKOFF_HOURS * 3_600_000
  const now       = Date.now()

  let alreadyCached        = 0
  let newlyGeocoded        = 0
  let failed               = 0
  let skippedBackoff       = 0
  let processed            = 0
  let remainingUnprocessed = 0

  for (const raw of rawLocations) {
    const normalized = raw.toLowerCase()
    const cached     = cacheMap.get(normalized)

    if (cached?.geocoded_at) {
      alreadyCached++
      continue
    }

    if (cached && !cached.geocoded_at && cached.last_attempt_at) {
      const age = now - new Date(cached.last_attempt_at).getTime()
      if (age < backoffMs) {
        skippedBackoff++
        continue
      }
    }

    if (processed >= limit) {
      remainingUnprocessed++
      continue
    }

    processed++

    try {
      const result = await geocodeLocation(raw)
      const nowIso = new Date().toISOString()

      if (result) {
        await supabase
          .from('city_coordinates')
          .upsert({
            query_text:        raw,
            query_normalized:  normalized,
            latitude:          result.latitude,
            longitude:         result.longitude,
            country_code:      result.countryCode,
            country_name:      result.countryName,
            mapbox_place_name: result.placeName,
            mapbox_place_type: result.placeType,
            geocoded_at:       nowIso,
            last_attempt_at:   nowIso,
            error_message:     null,
            updated_at:        nowIso,
          }, { onConflict: 'query_normalized' })
        newlyGeocoded++
      } else {
        // Mapbox returned no features — record the attempt so backoff applies.
        await supabase
          .from('city_coordinates')
          .upsert({
            query_text:       raw,
            query_normalized: normalized,
            last_attempt_at:  new Date().toISOString(),
            error_message:    'no results from mapbox',
            updated_at:       new Date().toISOString(),
          }, { onConflict: 'query_normalized' })
        failed++
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[geocode] failed for "${raw}":`, msg)
      await supabase
        .from('city_coordinates')
        .upsert({
          query_text:       raw,
          query_normalized: normalized,
          last_attempt_at:  new Date().toISOString(),
          error_message:    msg.substring(0, 500),
          updated_at:       new Date().toISOString(),
        }, { onConflict: 'query_normalized' })
        .then(() => null) // non-critical
      failed++
    }
  }

  return res.json({
    ok: true,
    totalUniqueLocations,
    alreadyCached,
    newlyGeocoded,
    failed,
    skippedBackoff,
    remainingUnprocessed,
  })
}
