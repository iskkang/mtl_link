import ws from 'ws'
;(globalThis as any).WebSocket = ws

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { parseRoute } from '../_lib/route.js'

// ── Shared helpers ────────────────────────────────────────────────────────────
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

// ── Detail handler (was container-detail.ts) ──────────────────────────────────
async function handleDetail(req: VercelRequest, res: VercelResponse, supabase: ReturnType<typeof createClient>) {
  const containerNumber = String(req.query.number ?? '').trim().toUpperCase()
  if (!containerNumber) return res.status(400).json({ ok: false, error: 'Missing ?number=' })

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

  const { data: alertRows } = await supabase
    .from('fesco_alerts')
    .select('severity, alert_type')
    .eq('container_number', containerNumber)
    .eq('status', 'open')

  const alerts = (alertRows ?? []) as { severity: string; alert_type: string | null }[]
  const signal = deriveSignal(row, alerts)

  type RawEvent = {
    location?:          string | null
    locationLatin?:     string | null
    date?:              string | null
    operationLatin?:    string | null
    transportLatin?:    string | null
    type?:              string | null
    totalDistance?:     number | null
    remainingDistance?: number | null
  }

  const rawEvents: RawEvent[] = Array.isArray(row.events_json) ? (row.events_json as RawEvent[]) : []
  const eventsAsc = [...rawEvents].reverse()

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

  type GeoRow = { query_normalized: string; latitude: number | null; longitude: number | null; country_code: string | null; country_name: string | null }
  const geoMap = new Map<string, GeoRow>()
  if (locationKeys.size > 0) {
    const { data: geoRows } = await supabase
      .from('city_coordinates')
      .select('query_normalized, latitude, longitude, country_code, country_name')
      .in('query_normalized', [...locationKeys])
      .not('geocoded_at', 'is', null)
    for (const g of (geoRows ?? []) as GeoRow[]) geoMap.set(g.query_normalized, g)
  }

  const fromGeo = fromNorm ? geoMap.get(fromNorm) ?? null : null
  const toGeo   = toNorm   ? geoMap.get(toNorm)   ?? null : null
  const current_from_coord = (fromGeo?.latitude != null && fromGeo?.longitude != null)
    ? { lat: fromGeo.latitude, lng: fromGeo.longitude } : null
  const current_to_coord = (toGeo?.latitude != null && toGeo?.longitude != null)
    ? { lat: toGeo.latitude, lng: toGeo.longitude } : null

  type TrailEvent = {
    date:             string
    locationLabel:    string
    operationLatin:   string | null
    transportLatin:   string | null
    lat:              number
    lng:              number
    totalDistance:    number | null
    remainingDistance: number | null
  }

  const events_timeline: TrailEvent[] = []
  for (const ev of eventsAsc) {
    if (!ev.date) continue
    const cyrKey = normalizeLocationKey(ev.location)
    const latKey = normalizeLocationKey(ev.locationLatin)
    const geoCyr = cyrKey ? geoMap.get(cyrKey) ?? null : null
    const geoLat = latKey ? geoMap.get(latKey) ?? null : null
    const geo    = (geoCyr?.latitude != null && geoCyr?.longitude != null) ? geoCyr : geoLat
    if (!geo || geo.latitude == null || geo.longitude == null) continue
    events_timeline.push({
      date:              ev.date,
      locationLabel:     ev.locationLatin ?? ev.location ?? '',
      operationLatin:    ev.operationLatin ?? null,
      transportLatin:    ev.transportLatin ?? null,
      lat:               geo.latitude,
      lng:               geo.longitude,
      totalDistance:     ev.totalDistance ?? null,
      remainingDistance: ev.remainingDistance != null ? Number(ev.remainingDistance) : null,
    })
  }

  const latest_event = events_timeline.length > 0 ? events_timeline[events_timeline.length - 1] : null

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
    ok:                       true,
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

// ── Dashboard handler (was containers-dashboard.ts) ───────────────────────────
function computeTransitProgress(departureDate: string | null, plannedDestinationDate: string | null, now = Date.now()): number | null {
  if (!departureDate || !plannedDestinationDate) return null
  const dep = new Date(departureDate).getTime()
  const eta = new Date(plannedDestinationDate).getTime()
  if (!Number.isFinite(dep) || !Number.isFinite(eta) || eta <= dep) return null
  return Math.max(0, Math.min(1, (now - dep) / (eta - dep)))
}

function interpolateCoord(fromLat: number, fromLng: number, toLat: number, toLng: number, progress: number) {
  const p = Math.max(0, Math.min(1, progress))
  return { lat: fromLat + p * (toLat - fromLat), lng: fromLng + p * (toLng - fromLng) }
}

const SEGMENT_LONG_THRESHOLD_KM = 1500

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

async function handleDashboard(req: VercelRequest, res: VercelResponse, supabase: ReturnType<typeof createClient>) {
  const limit  = Math.min(Math.max(parseInt(String(req.query.limit  ?? '200'), 10) || 200, 1), 500)
  const offset = Math.max(parseInt(String(req.query.offset ?? '0'),  10) || 0, 0)

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
    .neq('manually_excluded', true)
    .order('container_number')
    .range(offset, offset + limit - 1)

  if (ctErr) return res.status(500).json({ ok: false, error: ctErr.message })

  const rows = (ctRows ?? [] as unknown[]) as unknown as {
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

  if (rows.length === 0) return res.json({ ok: true, total: count ?? 0, limit, offset, data: [] })

  const orderIds = [...new Set(rows.map(r => r.order_id).filter((id): id is number => id != null))]

  const { data: orderRows } = await supabase
    .from('fesco_orders')
    .select('id, external_1c_number, route_latin, created_at')
    .in('id', orderIds)

  const orderMap = new Map<number, { external_1c_number: string | null; route_latin: string | null; created_at: string | null }>()
  for (const o of (orderRows ?? []) as { id: number; external_1c_number: string | null; route_latin: string | null; created_at: string | null }[]) {
    orderMap.set(o.id, { external_1c_number: o.external_1c_number, route_latin: o.route_latin, created_at: o.created_at })
  }

  const locationKeys = new Set<string>()

  type LastEventData = {
    locationCyrillic:  string | null
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
    const toNorm   = normalizeLocationKey(r.current_to)
    const fromNorm = normalizeLocationKey(r.current_from)
    if (toNorm)   locationKeys.add(toNorm)
    if (fromNorm) locationKeys.add(fromNorm)

    const evArr         = Array.isArray(r.events_json) ? r.events_json as Record<string, unknown>[] : []
    const ev            = evArr.length > 0 ? evArr[0] : null
    const evLocationCyr = typeof ev?.location      === 'string' ? ev.location      : null
    const evLocation    = typeof ev?.locationLatin === 'string' ? ev.locationLatin : null
    const cyrKey = normalizeLocationKey(evLocationCyr)
    const latKey = normalizeLocationKey(evLocation)
    if (cyrKey) locationKeys.add(cyrKey)
    if (latKey) locationKeys.add(latKey)

    lastEventMap.set(r.container_number, {
      locationCyrillic:  evLocationCyr,
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
    const parsed  = parseRoute(o.route_latin)
    const destNorm = normalizeLocationKey(parsed.destination)
    const origNorm = normalizeLocationKey(parsed.origin)
    if (destNorm) locationKeys.add(destNorm)
    if (origNorm) locationKeys.add(origNorm)
  }

  type GeoRow = { query_normalized: string; latitude: number | null; longitude: number | null; country_code: string | null; country_name: string | null }
  const geoMap = new Map<string, GeoRow>()
  if (locationKeys.size > 0) {
    const { data: geoRows } = await supabase
      .from('city_coordinates')
      .select('query_normalized, latitude, longitude, country_code, country_name')
      .in('query_normalized', [...locationKeys])
      .not('geocoded_at', 'is', null)
    for (const g of (geoRows ?? []) as GeoRow[]) geoMap.set(g.query_normalized, g)
  }

  const containerNumbers = rows.map(r => r.container_number)
  const { data: alertRows } = await supabase
    .from('fesco_alerts')
    .select('container_number, severity, alert_type, first_seen_at')
    .in('container_number', containerNumbers)
    .eq('status', 'open')

  type AlertRow = { container_number: string; severity: string; alert_type: string | null; first_seen_at: string | null }
  const alertMap = new Map<string, AlertRow[]>()
  for (const a of (alertRows ?? []) as AlertRow[]) {
    const list = alertMap.get(a.container_number) ?? []
    list.push(a)
    alertMap.set(a.container_number, list)
  }

  const BBOX_BUFFER_DEG = 8

  const data = rows.map(r => {
    const order      = r.order_id != null ? orderMap.get(r.order_id) : null
    const parsed     = parseRoute(order?.route_latin)
    const alerts     = alertMap.get(r.container_number) ?? []
    const lastEvent  = lastEventMap.get(r.container_number) ?? null

    const fromKey  = normalizeLocationKey(r.current_from)
    const toKey    = normalizeLocationKey(r.current_to)
    const fromGeo  = fromKey ? geoMap.get(fromKey) ?? null : null
    const toGeo    = toKey   ? geoMap.get(toKey)   ?? null : null
    const fromCoord = fromGeo?.latitude != null && fromGeo?.longitude != null ? fromGeo : null
    const toCoord   = toGeo?.latitude   != null && toGeo?.longitude   != null ? toGeo   : null

    const evLocCyrKey = normalizeLocationKey(lastEvent?.locationCyrillic)
    const evLocLatKey = normalizeLocationKey(lastEvent?.locationLatin)
    const evGeoCyr    = evLocCyrKey ? geoMap.get(evLocCyrKey) ?? null : null
    const evGeoLat    = evLocLatKey ? geoMap.get(evLocLatKey) ?? null : null
    const evGeo       = (evGeoCyr?.latitude != null && evGeoCyr?.longitude != null) ? evGeoCyr : evGeoLat
    const eventCoord  = evGeo?.latitude != null && evGeo?.longitude != null ? evGeo : null

    const departed = !!r.departure_date
    const arrived  = !!r.destination_date

    let displayLat:          number | null = null
    let displayLng:          number | null = null
    let displayLocationText: string | null = null
    let transitProgress:     number | null = null

    const segmentDistKm = (fromCoord && toCoord)
      ? haversineKm(fromCoord.latitude!, fromCoord.longitude!, toCoord.latitude!, toCoord.longitude!)
      : null
    const skipBbox = segmentDistKm === null || segmentDistKm > SEGMENT_LONG_THRESHOLD_KM

    let useEventCoord = false
    if (eventCoord && lastEvent?.locationLatin) {
      if (!skipBbox && fromCoord && toCoord) {
        const minLat = Math.min(fromCoord.latitude!,  toCoord.latitude!)  - BBOX_BUFFER_DEG
        const maxLat = Math.max(fromCoord.latitude!,  toCoord.latitude!)  + BBOX_BUFFER_DEG
        const minLng = Math.min(fromCoord.longitude!, toCoord.longitude!) - BBOX_BUFFER_DEG
        const maxLng = Math.max(fromCoord.longitude!, toCoord.longitude!) + BBOX_BUFFER_DEG
        useEventCoord =
          eventCoord.latitude!  >= minLat && eventCoord.latitude!  <= maxLat &&
          eventCoord.longitude! >= minLng && eventCoord.longitude! <= maxLng
      } else {
        useEventCoord = true
      }
    }

    if (useEventCoord && eventCoord && lastEvent?.locationLatin) {
      displayLat          = eventCoord.latitude
      displayLng          = eventCoord.longitude
      displayLocationText = lastEvent.locationLatin
      if (lastEvent.totalDistance && lastEvent.totalDistance > 0 && lastEvent.remainingDistance != null) {
        transitProgress = Math.max(0, Math.min(1, 1 - (lastEvent.remainingDistance / lastEvent.totalDistance)))
      }
    } else {
      if (departed && !arrived && fromCoord && toCoord) {
        const progress = computeTransitProgress(r.departure_date, r.planned_destination_date)
        if (progress !== null) {
          const pos = interpolateCoord(fromCoord.latitude!, fromCoord.longitude!, toCoord.latitude!, toCoord.longitude!, progress)
          displayLat = pos.lat; displayLng = pos.lng; displayLocationText = r.current_to; transitProgress = progress
        } else {
          displayLat = toCoord.latitude; displayLng = toCoord.longitude; displayLocationText = r.current_to
        }
      } else if (departed && toCoord) {
        displayLat = toCoord.latitude; displayLng = toCoord.longitude; displayLocationText = r.current_to
      } else if (!departed && fromCoord) {
        displayLat = fromCoord.latitude; displayLng = fromCoord.longitude; displayLocationText = r.current_from
      } else {
        if (toCoord) {
          displayLat = toCoord.latitude; displayLng = toCoord.longitude; displayLocationText = r.current_to
        } else if (fromCoord) {
          displayLat = fromCoord.latitude; displayLng = fromCoord.longitude; displayLocationText = r.current_from
        }
      }
    }

    const curLocKey = normalizeLocationKey(r.current_to)
    const curGeo    = curLocKey ? geoMap.get(curLocKey) ?? null : null
    const destKey   = normalizeLocationKey(parsed.destination)
    const origKey   = normalizeLocationKey(parsed.origin)
    const destGeo   = destKey ? geoMap.get(destKey) ?? null : null

    return {
      container_number:          r.container_number,
      order_number:              order?.external_1c_number ?? r.external_1c_number ?? null,
      operational_status:        r.status,
      origin_city:               parsed.origin      ?? null,
      destination_city:          parsed.destination  ?? null,
      destination_country_code:  destGeo?.country_code  ?? null,
      destination_country_name:  destGeo?.country_name  ?? null,
      display_location_text:     displayLocationText,
      display_latitude:          displayLat,
      display_longitude:         displayLng,
      transit_progress:          transitProgress,
      current_location_text:     r.current_to ?? null,
      current_latitude:          curGeo?.latitude  ?? null,
      current_longitude:         curGeo?.longitude ?? null,
      eta:                       r.planned_destination_date ?? null,
      signal: alerts.some(a => a.alert_type === 'container_tracking_unknown')
        ? 'unknown'
        : deriveSignal(r, alerts),
      unknown_since:             alerts.find(a => a.alert_type === 'container_tracking_unknown')?.first_seen_at ?? null,
      last_success_at:           r.last_success_at,
      last_error_at:             r.last_error_at,
      last_error_message:        r.last_error_message,
      consecutive_errors:        r.consecutive_errors ?? 0,
      open_alert_count:          alerts.length,
      open_alert_types:          alerts.map(a => a.alert_type).filter((t): t is string => t != null),
      current_to:                r.current_to ?? null,
      current_segment_type:      r.current_segment_type ?? null,
      departure_date:            r.departure_date ?? null,
      planned_destination_date:  r.planned_destination_date ?? null,
      alert_reason:              r.alert_reason ?? null,
      segments:                  r.segments_json ?? [],
      last_event_location:           lastEvent?.locationLatin     ?? null,
      last_event_date:               lastEvent?.date              ?? null,
      last_event_operation:          lastEvent?.operationLatin    ?? null,
      last_event_transport:          lastEvent?.transportLatin    ?? null,
      last_event_type:               lastEvent?.type              ?? null,
      last_event_total_distance:     lastEvent?.totalDistance     ?? null,
      last_event_remaining_distance: lastEvent?.remainingDistance ?? null,
      origin_key:                origKey,
      current_from:              r.current_from,
      current_from_country:      r.current_from_country,
      current_to_country:        r.current_to_country,
      transport_name:            r.transport_name,
      voyage_number:             r.voyage_number,
    }
  })

  const twentyDaysAgo = new Date(Date.now() - 20 * 86_400_000).toISOString().split('T')[0]
  const nowIso        = new Date().toISOString()
  const { data: staleRaw } = await supabase
    .from('fesco_container_tracking_current')
    .select('container_number, planned_destination_date, events_json, cleanup_dismissed_until, order_id')
    .neq('status', 'completed')
    .lt('planned_destination_date', twentyDaysAgo)
    .eq('consecutive_errors', 0)
    .or(`cleanup_dismissed_until.is.null,cleanup_dismissed_until.lt.${nowIso}`)

  const stale_candidates: { container_number: string; route: string | null; days_overdue: number; reason: 'no_events' | 'at_destination' | 'tracking_unavailable' }[] = []
  for (const r of (staleRaw ?? []) as any[]) {
    const order      = r.order_id != null ? orderMap.get(r.order_id) : null
    const routeLatin = order?.route_latin ?? null
    const destRaw    = routeLatin ? routeLatin.replace(/^.+-/, '').trim() : null
    const evArr      = Array.isArray(r.events_json) ? r.events_json as any[] : []
    const lastLoc    = evArr[0]?.locationLatin?.toLowerCase() ?? null
    const destLower  = destRaw?.toLowerCase() ?? null
    const noEvents   = evArr.length === 0
    const atDest     = lastLoc && destLower ? lastLoc.includes(destLower) || destLower.includes(lastLoc) : false
    if (!noEvents && !atDest) continue
    stale_candidates.push({
      container_number: r.container_number,
      route:            routeLatin,
      days_overdue:     Math.floor((Date.now() - new Date(r.planned_destination_date).getTime()) / 86_400_000),
      reason:           noEvents ? 'no_events' : 'at_destination',
    })
  }

  // Unavailable containers (FESCO tracking API failing) are likely arrived or abandoned.
  // Surface them for manual cleanup regardless of consecutive_errors count.
  const staleCnSet = new Set(stale_candidates.map(c => c.container_number))
  const { data: unavailRaw } = await supabase
    .from('fesco_container_tracking_current')
    .select('container_number, planned_destination_date, order_id, cleanup_dismissed_until')
    .neq('status', 'completed')
    .eq('unavailable', true)
    .or(`cleanup_dismissed_until.is.null,cleanup_dismissed_until.lt.${nowIso}`)

  for (const r of (unavailRaw ?? []) as any[]) {
    if (staleCnSet.has(r.container_number)) continue
    const order      = r.order_id != null ? orderMap.get(r.order_id) : null
    const routeLatin = order?.route_latin ?? null
    const daysOverdue = r.planned_destination_date
      ? Math.max(0, Math.floor((Date.now() - new Date(r.planned_destination_date).getTime()) / 86_400_000))
      : 0
    stale_candidates.push({
      container_number: r.container_number,
      route:            routeLatin,
      days_overdue:     daysOverdue,
      reason:           'tracking_unavailable',
    })
  }

  const SIG_RANK: Record<string, number> = { red: 3, yellow: 2, green: 1, gray: 0 }
  type RecentOrderEntry = { order_number: string | null; route: string | null; created_at: string | null; order_id: number | null; container_count: number; signal: string }
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
        route:           parsed.origin && parsed.destination ? `${parsed.origin} → ${parsed.destination}` : parsed.destination ?? null,
        created_at:      order?.created_at ?? null,
        order_id:        r.order_id,
        container_count: 1,
        signal:          sig,
      })
    }
  }
  const recent_orders = [...roMap.values()]
    .sort((a, b) => (b.order_number ?? '').localeCompare(a.order_number ?? ''))
    .slice(0, 8)
    .map(o => ({ order_number: o.order_number, route: o.route, created_at: o.created_at, container_count: o.container_count, signal: o.signal }))

  return res.json({ ok: true, total: count ?? 0, limit, offset, data, recent_orders, stale_candidates })
}

// ── Router ────────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Supabase env not set' })
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  if (req.query.number) return handleDetail(req, res, supabase)
  return handleDashboard(req, res, supabase)
}
