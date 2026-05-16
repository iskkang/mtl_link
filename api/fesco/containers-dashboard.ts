import ws from 'ws'
;(globalThis as any).WebSocket = ws

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { parseRoute } from '../utils/route'

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
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Supabase env not set' })
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  const limit  = Math.min(Math.max(parseInt(String(req.query.limit  ?? '200'), 10) || 200, 1), 500)
  const offset = Math.max(parseInt(String(req.query.offset ?? '0'),  10) || 0, 0)

  // ── 1. Container tracking rows ─────────────────────────────────────────────
  const { data: ctRows, error: ctErr, count } = await supabase
    .from('fesco_container_tracking_current')
    .select(
      'container_number, order_id, external_1c_number, status, alert_level, alert_reason, ' +
      'current_from, current_to, current_from_country, current_to_country, ' +
      'departure_date, planned_departure_date, destination_date, planned_destination_date, ' +
      'transport_name, voyage_number, ' +
      'last_success_at, last_error_at, last_error_message, consecutive_errors',
      { count: 'exact' },
    )
    .order('container_number')
    .range(offset, offset + limit - 1)

  if (ctErr) return res.status(500).json({ ok: false, error: ctErr.message })

  const rows = (ctRows ?? []) as {
    container_number:         string
    order_id:                 number | null
    external_1c_number:       string | null
    status:                   string | null
    alert_level:              string | null
    alert_reason:             string | null
    current_from:             string | null
    current_to:               string | null
    current_from_country:     string | null
    current_to_country:       string | null
    departure_date:           string | null
    planned_departure_date:   string | null
    destination_date:         string | null
    planned_destination_date: string | null
    transport_name:           string | null
    voyage_number:            string | null
    last_success_at:          string | null
    last_error_at:            string | null
    last_error_message:       string | null
    consecutive_errors:       number | null
  }[]

  if (rows.length === 0) {
    return res.json({ ok: true, total: count ?? 0, limit, offset, data: [] })
  }

  // ── 2. Orders: external_1c_number + route_latin ────────────────────────────
  const orderIds = [...new Set(rows.map(r => r.order_id).filter((id): id is number => id != null))]

  const { data: orderRows } = await supabase
    .from('fesco_orders')
    .select('id, external_1c_number, route_latin')
    .in('id', orderIds)

  const orderMap = new Map<number, { external_1c_number: string | null; route_latin: string | null }>()
  for (const o of (orderRows ?? []) as { id: number; external_1c_number: string | null; route_latin: string | null }[]) {
    orderMap.set(o.id, { external_1c_number: o.external_1c_number, route_latin: o.route_latin })
  }

  // ── 3. Geocoding lookups ───────────────────────────────────────────────────
  // Collect normalized location strings: current_to + parsed destinations
  const locationKeys = new Set<string>()
  for (const r of rows) {
    if (r.current_to?.trim()) locationKeys.add(r.current_to.trim().toLowerCase())
  }
  for (const o of (orderRows ?? []) as { route_latin: string | null }[]) {
    const parsed = parseRoute(o.route_latin)
    if (parsed.destination?.trim()) locationKeys.add(parsed.destination.trim().toLowerCase())
    if (parsed.origin?.trim())      locationKeys.add(parsed.origin.trim().toLowerCase())
  }

  type GeoRow = {
    query_normalized: string
    latitude:         number | null
    longitude:        number | null
    country_code:     string | null
    country_name:     string | null
  }
  let geoMap = new Map<string, GeoRow>()

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

  // ── 4. Open alerts ─────────────────────────────────────────────────────────
  const containerNumbers = rows.map(r => r.container_number)

  const { data: alertRows } = await supabase
    .from('fesco_alerts')
    .select('container_number, severity, alert_type')
    .in('container_number', containerNumbers)
    .eq('status', 'open')

  type AlertRow = { container_number: string; severity: string; alert_type: string | null }
  const alertMap = new Map<string, AlertRow[]>()
  for (const a of (alertRows ?? []) as AlertRow[]) {
    const list = alertMap.get(a.container_number) ?? []
    list.push(a)
    alertMap.set(a.container_number, list)
  }

  // ── 5. Assemble result ─────────────────────────────────────────────────────
  const data = rows.map(r => {
    const order   = r.order_id != null ? orderMap.get(r.order_id) : null
    const parsed  = parseRoute(order?.route_latin)
    const alerts  = alertMap.get(r.container_number) ?? []

    const curLocKey  = r.current_to?.trim().toLowerCase() ?? null
    const destKey    = parsed.destination?.trim().toLowerCase() ?? null
    const origKey    = parsed.origin?.trim().toLowerCase() ?? null

    const curGeo  = curLocKey  ? geoMap.get(curLocKey)  ?? null : null
    const destGeo = destKey    ? geoMap.get(destKey)    ?? null : null

    return {
      container_number:          r.container_number,
      order_number:              order?.external_1c_number ?? r.external_1c_number ?? null,
      operational_status:        r.status,
      origin_city:               parsed.origin      ?? null,
      destination_city:          parsed.destination  ?? null,
      destination_country_code:  destGeo?.country_code  ?? null,
      destination_country_name:  destGeo?.country_name  ?? null,
      current_location_text:     r.current_to ?? null,
      current_latitude:          curGeo?.latitude  ?? null,
      current_longitude:         curGeo?.longitude ?? null,
      // ETA: no dedicated ETA column in fesco_orders; using planned_destination_date
      // from fesco_container_tracking_current as best available approximation.
      eta:                       r.planned_destination_date ?? null,
      signal:                    deriveSignal(r, alerts),
      last_success_at:           r.last_success_at,
      last_error_at:             r.last_error_at,
      last_error_message:        r.last_error_message,
      consecutive_errors:        r.consecutive_errors ?? 0,
      open_alert_count:          alerts.length,
      open_alert_types:          alerts.map(a => a.alert_type).filter((t): t is string => t != null),
      // extras kept for UI convenience
      origin_key:                origKey,
      current_from:              r.current_from,
      current_from_country:      r.current_from_country,
      current_to_country:        r.current_to_country,
      transport_name:            r.transport_name,
      voyage_number:             r.voyage_number,
    }
  })

  return res.json({ ok: true, total: count ?? 0, limit, offset, data })
}
