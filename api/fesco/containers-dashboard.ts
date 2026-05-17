import ws from 'ws'
;(globalThis as any).WebSocket = ws

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { parseRoute } from '../utils/route.js'

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

function computeTransitProgress(
  departureDate: string | null,
  plannedDestinationDate: string | null,
  now: number = Date.now(),
): number | null {
  if (!departureDate || !plannedDestinationDate) return null
  const dep = new Date(departureDate).getTime()
  const eta = new Date(plannedDestinationDate).getTime()
  if (!Number.isFinite(dep) || !Number.isFinite(eta) || eta <= dep) return null
  const raw = (now - dep) / (eta - dep)
  return Math.max(0, Math.min(1, raw))
}

function interpolateCoord(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  progress: number,
): { lat: number; lng: number } {
  const p = Math.max(0, Math.min(1, progress))
  return {
    lat: fromLat + p * (toLat - fromLat),
    lng: fromLng + p * (toLng - fromLng),
  }
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

  // ── 1. Container tracking rows (exclude completed) ────────────────────────
  const { data: ctRows, error: ctErr, count } = await supabase
    .from('fesco_container_tracking_current')
    .select(
      'container_number, order_id, external_1c_number, status, alert_level, alert_reason, ' +
      'current_from, current_to, current_segment_type, current_from_country, current_to_country, ' +
      'departure_date, planned_departure_date, destination_date, planned_destination_date, ' +
      'transport_name, voyage_number, ' +
      'last_success_at, last_error_at, last_error_message, consecutive_errors, segments_json, events_json',
      { count: 'exact' },
    )
    .neq('status', 'completed')
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
    current_segment_type:     string | null
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
    segments_json:            unknown[] | null
    events_json:              unknown[] | null
  }[]

  if (rows.length === 0) {
    return res.json({ ok: true, total: count ?? 0, limit, offset, data: [] })
  }

  // ── 2. Orders: external_1c_number + route_latin ────────────────────────────
  const orderIds = [...new Set(rows.map(r => r.order_id).filter((id): id is number => id != null))]

  const { data: orderRows } = await supabase
    .from('fesco_orders')
    .select('id, external_1c_number, route_latin, created_at')
    .in('id', orderIds)

  const orderMap = new Map<number, { external_1c_number: string | null; route_latin: string | null; created_at: string | null }>()
  for (const o of (orderRows ?? []) as { id: number; external_1c_number: string | null; route_latin: string | null; created_at: string | null }[]) {
    orderMap.set(o.id, { external_1c_number: o.external_1c_number, route_latin: o.route_latin, created_at: o.created_at })
  }

  // ── 3. Geocoding lookups ───────────────────────────────────────────────────
  // Collect current_from + current_to for smart marker placement, plus parsed route cities.
  // Also extract last event per container for event-based positioning (v1.10.2).
  const locationKeys = new Set<string>()

  type LastEventData = {
    locationLatin:     string | null
    date:              string | null
    operationLatin:    string | null
    transportLatin:    string | null
    type:              string | null
    totalDistance:     number | null
    remainingDistance: number | null
  }
  const lastEventMap = new Map<string, LastEventData>()

  for (const r of rows) {
    if (r.current_to?.trim())   locationKeys.add(r.current_to.trim().toLowerCase())
    if (r.current_from?.trim()) locationKeys.add(r.current_from.trim().toLowerCase())

    // Extract last event and add its location to geocoding set
    const evArr      = Array.isArray(r.events_json) ? r.events_json as Record<string, unknown>[] : []
    const ev         = evArr.length > 0 ? evArr[0] : null
    const evLocation = typeof ev?.locationLatin === 'string' ? ev.locationLatin : null
    if (evLocation?.trim()) locationKeys.add(evLocation.trim().toLowerCase())

    lastEventMap.set(r.container_number, {
      locationLatin:     evLocation,
      date:              typeof ev?.date            === 'string' ? ev.date            : null,
      operationLatin:    typeof ev?.operationLatin  === 'string' ? ev.operationLatin  : null,
      transportLatin:    typeof ev?.transportLatin  === 'string' ? ev.transportLatin  : null,
      type:              typeof ev?.type            === 'string' ? ev.type            : null,
      totalDistance:     typeof ev?.totalDistance   === 'number' ? ev.totalDistance   : null,
      remainingDistance: ev?.remainingDistance != null ? Number(ev.remainingDistance) : null,
    })
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
    const order  = r.order_id != null ? orderMap.get(r.order_id) : null
    const parsed = parseRoute(order?.route_latin)
    const alerts = alertMap.get(r.container_number) ?? []

    // Display position: priority chain (v1.10.2)
    const lastEvent = lastEventMap.get(r.container_number) ?? null

    const fromKey   = r.current_from?.trim().toLowerCase() ?? null
    const toKey     = r.current_to?.trim().toLowerCase() ?? null
    const fromGeo   = fromKey ? geoMap.get(fromKey) ?? null : null
    const toGeo     = toKey   ? geoMap.get(toKey)   ?? null : null
    const fromCoord = fromGeo?.latitude != null && fromGeo?.longitude != null ? fromGeo : null
    const toCoord   = toGeo?.latitude   != null && toGeo?.longitude   != null ? toGeo   : null

    const evLocKey  = lastEvent?.locationLatin?.trim().toLowerCase() ?? null
    const evGeo     = evLocKey ? geoMap.get(evLocKey) ?? null : null
    const eventCoord = evGeo?.latitude != null && evGeo?.longitude != null ? evGeo : null

    const departed = !!r.departure_date
    const arrived  = !!r.destination_date

    let displayLat:          number | null = null
    let displayLng:          number | null = null
    let displayLocationText: string | null = null
    let transitProgress:     number | null = null

    // Country mismatch sanity check (v1.10.2c): skip event coord when it geocodes to a
    // different country than current_from — signals a geocode false match
    // (e.g. "9-10 Prichaly VMTP" geocodes to LT while segment is Vladivostok RU → skip).
    const countryMatch = !fromCoord
      || !evGeo?.country_code
      || !fromGeo?.country_code
      || evGeo.country_code === fromGeo.country_code

    if (eventCoord && lastEvent?.locationLatin && countryMatch) {
      // PRIORITY 1: actual last-event location (most accurate)
      displayLat          = eventCoord.latitude
      displayLng          = eventCoord.longitude
      displayLocationText = lastEvent.locationLatin
      // km-based progress when available
      if (lastEvent.totalDistance && lastEvent.totalDistance > 0 && lastEvent.remainingDistance != null) {
        const p = 1 - (lastEvent.remainingDistance / lastEvent.totalDistance)
        transitProgress = Math.max(0, Math.min(1, p))
      }
    } else {
      // PRIORITY 2+: v1.9.2c time-based interpolation + segment fallbacks
      if (departed && !arrived && fromCoord && toCoord) {
        const progress = computeTransitProgress(r.departure_date, r.planned_destination_date)
        if (progress !== null) {
          const pos = interpolateCoord(
            fromCoord.latitude!, fromCoord.longitude!,
            toCoord.latitude!,   toCoord.longitude!,
            progress,
          )
          displayLat          = pos.lat
          displayLng          = pos.lng
          displayLocationText = r.current_to
          transitProgress     = progress
        } else {
          displayLat          = toCoord.latitude
          displayLng          = toCoord.longitude
          displayLocationText = r.current_to
        }
      } else if (departed && toCoord) {
        displayLat          = toCoord.latitude
        displayLng          = toCoord.longitude
        displayLocationText = r.current_to
      } else if (!departed && fromCoord) {
        displayLat          = fromCoord.latitude
        displayLng          = fromCoord.longitude
        displayLocationText = r.current_from
      } else {
        if (toCoord) {
          displayLat          = toCoord.latitude
          displayLng          = toCoord.longitude
          displayLocationText = r.current_to
        } else if (fromCoord) {
          displayLat          = fromCoord.latitude
          displayLng          = fromCoord.longitude
          displayLocationText = r.current_from
        }
      }
    }

    // Backward-compat: current_to-based coordinates (deprecated, use display_* for marker placement)
    const curLocKey = r.current_to?.trim().toLowerCase() ?? null
    const curGeo    = curLocKey ? geoMap.get(curLocKey) ?? null : null

    const destKey = parsed.destination?.trim().toLowerCase() ?? null
    const origKey = parsed.origin?.trim().toLowerCase() ?? null
    const destGeo = destKey ? geoMap.get(destKey) ?? null : null

    return {
      container_number:          r.container_number,
      order_number:              order?.external_1c_number ?? r.external_1c_number ?? null,
      operational_status:        r.status,
      origin_city:               parsed.origin      ?? null,
      destination_city:          parsed.destination  ?? null,
      destination_country_code:  destGeo?.country_code  ?? null,
      destination_country_name:  destGeo?.country_name  ?? null,
      // Smart marker placement with interpolation
      display_location_text:     displayLocationText,
      display_latitude:          displayLat,
      display_longitude:         displayLng,
      transit_progress:          transitProgress,
      // Deprecated (backward compat): current_to-based coordinates
      current_location_text:     r.current_to ?? null,
      current_latitude:          curGeo?.latitude  ?? null,
      current_longitude:         curGeo?.longitude ?? null,
      eta:                       r.planned_destination_date ?? null,
      signal:                    deriveSignal(r, alerts),
      last_success_at:           r.last_success_at,
      last_error_at:             r.last_error_at,
      last_error_message:        r.last_error_message,
      consecutive_errors:        r.consecutive_errors ?? 0,
      open_alert_count:          alerts.length,
      open_alert_types:          alerts.map(a => a.alert_type).filter((t): t is string => t != null),
      // Segment context
      current_to:                r.current_to ?? null,
      current_segment_type:      r.current_segment_type ?? null,
      departure_date:            r.departure_date ?? null,
      planned_destination_date:  r.planned_destination_date ?? null,
      alert_reason:              r.alert_reason ?? null,
      // Full segments array (v1.10.0)
      segments:                  r.segments_json ?? [],
      // Last event data (v1.10.2)
      last_event_location:           lastEvent?.locationLatin     ?? null,
      last_event_date:               lastEvent?.date              ?? null,
      last_event_operation:          lastEvent?.operationLatin    ?? null,
      last_event_transport:          lastEvent?.transportLatin    ?? null,
      last_event_type:               lastEvent?.type              ?? null,
      last_event_total_distance:     lastEvent?.totalDistance     ?? null,
      last_event_remaining_distance: lastEvent?.remainingDistance ?? null,
      // extras
      origin_key:                origKey,
      current_from:              r.current_from,
      current_from_country:      r.current_from_country,
      current_to_country:        r.current_to_country,
      transport_name:            r.transport_name,
      voyage_number:             r.voyage_number,
    }
  })

  // ── 6. Recent orders — grouped by order, sorted by created_at desc ──────────
  const SIG_RANK: Record<string, number> = { red: 3, yellow: 2, green: 1, gray: 0 }

  type RecentOrderEntry = {
    order_number:    string | null
    route:           string | null
    created_at:      string | null
    order_id:        number | null
    container_count: number
    signal:          string
  }
  const roMap = new Map<string, RecentOrderEntry>()

  for (const r of rows) {
    const order  = r.order_id != null ? orderMap.get(r.order_id) : null
    const parsed = parseRoute(order?.route_latin)
    const alerts = alertMap.get(r.container_number) ?? []
    const sig    = deriveSignal(r, alerts)
    const key    = order?.external_1c_number ?? r.external_1c_number ?? `_${r.container_number}`
    const entry  = roMap.get(key)
    if (entry) {
      entry.container_count++
      if (SIG_RANK[sig] > SIG_RANK[entry.signal]) entry.signal = sig
    } else {
      roMap.set(key, {
        order_number:    order?.external_1c_number ?? r.external_1c_number ?? null,
        route:           parsed.origin && parsed.destination
          ? `${parsed.origin} → ${parsed.destination}`
          : parsed.destination ?? null,
        created_at:      order?.created_at ?? null,
        order_id:        r.order_id,
        container_count: 1,
        signal:          sig,
      })
    }
  }

  const recent_orders = [...roMap.values()]
    .sort((a, b) => {
      if (a.created_at && b.created_at) return b.created_at.localeCompare(a.created_at)
      if (a.created_at) return -1
      if (b.created_at) return 1
      return (b.order_id ?? 0) - (a.order_id ?? 0)
    })
    .slice(0, 8)
    .map(o => ({
      order_number:    o.order_number,
      route:           o.route,
      created_at:      o.created_at,
      container_count: o.container_count,
      signal:          o.signal,
    }))

  return res.json({ ok: true, total: count ?? 0, limit, offset, data, recent_orders })
}
