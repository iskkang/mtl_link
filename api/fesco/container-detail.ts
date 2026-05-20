import ws from 'ws'
;(globalThis as any).WebSocket = ws

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

function normalizeLocationKey(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  return trimmed.toLowerCase().replace(/\s+/g, ' ')
}

function deriveSignal(
  ctr: { status: string | null; last_success_at: string | null },
  alerts: { severity: string }[],
): 'red' | 'yellow' | 'green' | 'gray' {
  if (alerts.some(a => a.severity === 'red'))    return 'red'
  if (alerts.some(a => a.severity === 'yellow')) return 'yellow'
  if (ctr.status === 'completed')                return 'green'
  if (ctr.last_success_at && new Date(ctr.last_success_at).getTime() > Date.now() - 86_400_000) return 'green'
  return 'gray'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  const containerNumber = String(req.query.number ?? '').trim().toUpperCase()
  if (!containerNumber) return res.status(400).json({ ok: false, error: 'Missing ?number=' })

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Supabase env not set' })
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  // ── 1. Container tracking row ──────────────────────────────────────────────
  const { data: ctr, error: ctrErr } = await supabase
    .from('fesco_container_tracking_current')
    .select(
      'container_number, order_id, status, alert_level, alert_reason, ' +
      'current_from, current_to, current_segment_type, ' +
      'departure_date, planned_departure_date, destination_date, planned_destination_date, ' +
      'last_success_at, events_json'
    )
    .eq('container_number', containerNumber)
    .single()

  if (ctrErr || !ctr) return res.status(404).json({ ok: false, error: 'Container not found' })

  const row = ctr as unknown as {
    container_number:         string
    order_id:                 number | null
    status:                   string | null
    alert_level:              string | null
    alert_reason:             string | null
    current_from:             string | null
    current_to:               string | null
    current_segment_type:     string | null
    departure_date:           string | null
    planned_departure_date:   string | null
    destination_date:         string | null
    planned_destination_date: string | null
    last_success_at:          string | null
    events_json:              unknown[] | null
  }

  // ── 2. Alerts ──────────────────────────────────────────────────────────────
  const { data: alertRows } = await supabase
    .from('fesco_alerts')
    .select('severity, alert_type')
    .eq('container_number', containerNumber)
    .eq('status', 'open')

  const alerts = (alertRows ?? []) as { severity: string; alert_type: string | null }[]
  const signal = deriveSignal(row, alerts)

  // ── 3. Parse events_json ───────────────────────────────────────────────────
  type RawEvent = {
    location?:         string | null
    locationLatin?:    string | null
    date?:             string | null
    operationLatin?:   string | null
    transportLatin?:   string | null
    type?:             string | null
    totalDistance?:    number | null
    remainingDistance?: number | null
  }

  const rawEvents: RawEvent[] = Array.isArray(row.events_json)
    ? (row.events_json as RawEvent[])
    : []

  // DB stores newest-first; reverse to oldest-first for timeline
  const eventsAsc = [...rawEvents].reverse()

  // Collect all unique location keys for bulk geocoding
  const locationKeys = new Set<string>()

  const fromNorm = normalizeLocationKey(row.current_from)
  const toNorm   = normalizeLocationKey(row.current_to)
  if (fromNorm) locationKeys.add(fromNorm)
  if (toNorm)   locationKeys.add(toNorm)

  for (const ev of eventsAsc) {
    const cyrKey = normalizeLocationKey(ev.location)
    const latKey = normalizeLocationKey(ev.locationLatin)
    if (cyrKey) locationKeys.add(cyrKey)
    if (latKey) locationKeys.add(latKey)
  }

  // ── 4. Bulk geocode ────────────────────────────────────────────────────────
  type GeoRow = {
    query_normalized: string
    latitude:         number | null
    longitude:        number | null
    country_code:     string | null
    country_name:     string | null
  }
  const geoMap = new Map<string, GeoRow>()

  if (locationKeys.size > 0) {
    const { data: geoRows } = await supabase
      .from('city_coordinates')
      .select('query_normalized, latitude, longitude, country_code, country_name')
      .in('query_normalized', [...locationKeys])
      .not('geocoded_at', 'is', null)

    for (const g of (geoRows ?? []) as GeoRow[]) {
      geoMap.set(g.query_normalized, g)
    }
  }

  // ── 5. Resolve current_from / current_to coords ────────────────────────────
  const fromGeo = fromNorm ? geoMap.get(fromNorm) ?? null : null
  const toGeo   = toNorm   ? geoMap.get(toNorm)   ?? null : null

  const current_from_coord = (fromGeo?.latitude != null && fromGeo?.longitude != null)
    ? { lat: fromGeo.latitude, lng: fromGeo.longitude }
    : null
  const current_to_coord = (toGeo?.latitude != null && toGeo?.longitude != null)
    ? { lat: toGeo.latitude, lng: toGeo.longitude }
    : null

  // ── 6. Build events timeline (Cyrillic-first coord lookup) ────────────────
  type TrailEvent = {
    date:            string
    locationLabel:   string
    operationLatin:  string | null
    transportLatin:  string | null
    lat:             number
    lng:             number
    totalDistance:   number | null
    remainingDistance: number | null
  }

  const events_timeline: TrailEvent[] = []
  let latest_event: TrailEvent | null = null

  for (const ev of eventsAsc) {
    if (!ev.date) continue

    const cyrKey = normalizeLocationKey(ev.location)
    const latKey = normalizeLocationKey(ev.locationLatin)
    const geoCyr = cyrKey ? geoMap.get(cyrKey) ?? null : null
    const geoLat = latKey ? geoMap.get(latKey) ?? null : null
    // Cyrillic-first: prefer Cyrillic match (osm2esr seeded), Latin as fallback
    const geo = (geoCyr?.latitude != null && geoCyr?.longitude != null) ? geoCyr : geoLat

    if (!geo || geo.latitude == null || geo.longitude == null) continue

    const point: TrailEvent = {
      date:             ev.date,
      locationLabel:    ev.locationLatin ?? ev.location ?? '',
      operationLatin:   ev.operationLatin ?? null,
      transportLatin:   ev.transportLatin ?? null,
      lat:              geo.latitude,
      lng:              geo.longitude,
      totalDistance:    ev.totalDistance ?? null,
      remainingDistance: ev.remainingDistance != null ? Number(ev.remainingDistance) : null,
    }
    events_timeline.push(point)
  }

  // Latest event = last item in ascending timeline (= events_json[0] in DB)
  if (events_timeline.length > 0) {
    latest_event = events_timeline[events_timeline.length - 1]
  }

  // ── 7. Distance from latest event ─────────────────────────────────────────
  // totalDistance and remainingDistance come from the FESCO event payload directly.
  // Use the most recent event that has both values.
  let remaining_km: number | null = null
  let total_km:     number | null = null

  for (let i = events_timeline.length - 1; i >= 0; i--) {
    const ev = events_timeline[i]
    if (ev.remainingDistance != null && ev.totalDistance != null) {
      remaining_km = ev.remainingDistance
      total_km     = ev.totalDistance
      break
    }
  }

  return res.json({
    ok: true,
    container_number:         row.container_number,
    current_from:             row.current_from,
    current_to:               row.current_to,
    current_from_coord,
    current_to_coord,
    current_segment_type:     row.current_segment_type,
    signal_level:             signal,
    alert_reason:             row.alert_reason,
    departure_date:           row.departure_date,
    planned_destination_date: row.planned_destination_date,
    events_timeline,
    latest_event,
    remaining_km,
    total_km,
  })
}
