import ws from 'ws'
;(globalThis as any).WebSocket = ws

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { sendTcrDelayDigestEmail, type TcrDigestAlert } from '../_lib/resend.js'
import { PROFILES, buildSubject } from '../../src/lib/tracing/report-profiles.js'
import { loadRows } from '../../src/lib/tracing/loaders.js'
import { rowHash } from '../../src/lib/tracing/diff.js'
import { renderEmail } from '../../src/lib/tracing/render.js'

type TcrSignal = 'green' | 'red' | 'yellow' | 'blue'

function daysDiff(d1: string | null, d2: string | null): number | null {
  if (!d1 || !d2) return null
  return (new Date(d2).getTime() - new Date(d1).getTime()) / (1000 * 60 * 60 * 24)
}

function calcSignal(
  arrivedYn: boolean,
  seg: { etd: string | null; atd: string | null; eta: string | null; ata: string | null } | null,
  currentLocationSince: string | null,
): TcrSignal {
  if (arrivedYn) return 'green'

  const today = new Date().toISOString().split('T')[0]
  let maxDelay = 0

  if (seg) {
    // A: departure delay (atd vs etd; proxy today if atd not yet recorded)
    const depDelay = daysDiff(seg.etd, seg.atd ?? today)
    if (depDelay !== null && depDelay > maxDelay) maxDelay = depDelay

    // B: arrival delay (ata vs eta; proxy today if ata not yet recorded)
    const arrDelay = daysDiff(seg.eta, seg.ata ?? today)
    if (arrDelay !== null && arrDelay > maxDelay) maxDelay = arrDelay
  }

  // C: dwell time at current location
  const dwell = daysDiff(currentLocationSince, today)
  if (dwell !== null && dwell > maxDelay) maxDelay = dwell

  if (maxDelay >= 5) return 'red'
  if (maxDelay >= 3) return 'yellow'
  return 'blue'
}

// ── Location / routing helpers ────────────────────────────────────────────────
function normLoc(s: unknown): string {
  return String(s ?? '').trim().toLowerCase()
    .replace(/andijon/g, 'andijan')
    .replace(/dostuk/g, 'dostyk')
    .replace(/kashi/g, 'kashgar')
    .replace(/\bmala\b/g, 'małaszewicze')
}

function sameLoc(a: unknown, b: unknown): boolean {
  if (!a || !b) return false
  return normLoc(a) === normLoc(b)
}

// Relative waypoint order along common Silk Road routes
const ROUTE_ORDER: Record<string, number> = {
  'incheon':       0,  'busan':         0,  'korea':         0,
  'qingdao':       10, 'lianyungang':   10,
  'shijiazhuangxi': 13,
  "xi'an":         20, 'xian':          20,
  'linhe':         21,
  'gansu':         22, 'lanzhou':       22,
  'yingshuiqiao':  23,
  'jiayuguan':     25,
  'hami':          30,
  'kashgar':       35,
  'wuqia':         37,
  'irkeshtam':     40, 'irkeshstan':    40,
  'dostyk':        40, 'altynkol':      40, 'khorgos':       40,
  'alashankou':    40, 'border':        40, 'kz border':     40,
  'issyk-kul':     42,
  'almaty':        45,
  'osh':           48,
  'kyrgyz':        49,
  'andijan':       50, 'bishkek':       50, 'chukursay':     50,
  'kostanay':      51,
  'kartaly':       52,
  'nildy':         55,
  'spiridonovka':  56,
  'negoreloye':    57,
  'nieharelaye':   58,
  'brest':         60,
  'małaszewicze':  65,
  'duisburg':      70,
}

interface ContainerLike { ata_final: string | null; current_location: string | null; destination: string | null }
interface SegmentLike   { segment_id: string; segment_no: number; to_location: string | null; atd: string | null; ata: string | null }

/** Re-derive arrived status from 3 independent signals — DB arrived_yn is NOT trusted. */
function isArrived(container: ContainerLike, segments: SegmentLike[]): boolean {
  if (container.ata_final) return true
  if (sameLoc(container.current_location, container.destination)) return true
  const sorted = [...segments].sort((a, b) => a.segment_no - b.segment_no)
  if (sorted.at(-1)?.ata) return true
  return false
}

/** Determine which segment is currently active, based on location order or date fallback. */
function computeCurrentSeg(
  segments:        SegmentLike[],
  currentLocation: string | null,
  _destination:    string | null,
): string | null {
  const segs = [...segments].sort((a, b) => a.segment_no - b.segment_no)
  if (segs.length === 0) return null

  const orderOf = (loc: unknown): number => {
    const n = normLoc(loc)
    if (!n) return -1
    if (ROUTE_ORDER[n] !== undefined) return ROUTE_ORDER[n]
    // Partial match: "T/S Border" contains "border" → 40
    for (const k of Object.keys(ROUTE_ORDER)) {
      if (n.includes(k) || k.includes(n)) return ROUTE_ORDER[k]
    }
    return -1
  }

  const curOrder = orderOf(currentLocation)

  if (curOrder >= 0) {
    // Location-based: first segment whose to_location is strictly ahead of current position
    for (const s of segs) {
      if (orderOf(s.to_location) > curOrder) return s.segment_id
    }
    return segs.at(-1)?.segment_id ?? null   // at or past final stop → last segment
  }

  // Location unknown → date fallback
  const inProgress = segs.find(s => s.atd && !s.ata)
  if (inProgress) return inProgress.segment_id

  let lastDoneIdx = -1
  segs.forEach((s, i) => { if (s.ata) lastDoneIdx = i })
  if (lastDoneIdx >= 0) return segs[Math.min(lastDoneIdx + 1, segs.length - 1)]?.segment_id ?? null

  return segs[0]?.segment_id ?? null
}

async function syncAutoAlerts(
  containers: { container_no: string; signal: TcrSignal }[],
  supabase: ReturnType<typeof createClient>,
): Promise<void> {
  const containerNos = containers.map(c => c.container_no)

  const { data: existing } = await supabase
    .from('tcr_risk_alerts')
    .select('id, container_no, severity, status')
    .in('container_no', containerNos)
    .eq('alert_type', 'DELAY_AUTO')

  type ExRow = { id: string; container_no: string; severity: string; status: string }
  const existingMap = new Map<string, ExRow>()
  for (const a of (existing ?? [] as unknown[]) as unknown as ExRow[]) {
    existingMap.set(a.container_no, a)
  }

  const toInsert: object[] = []
  const toUpdate: { id: string; severity: string }[] = []
  const toResolve: string[] = []

  for (const c of containers) {
    const ex = existingMap.get(c.container_no)
    if (c.signal === 'red' || c.signal === 'yellow') {
      const severity = c.signal === 'red' ? 'Critical' : 'Watch'
      if (!ex) {
        toInsert.push({ container_no: c.container_no, alert_type: 'DELAY_AUTO', severity, status: 'Open' })
      } else if (ex.status !== 'Open' || ex.severity !== severity) {
        toUpdate.push({ id: ex.id, severity })
      }
    } else if (ex && ex.status === 'Open') {
      toResolve.push(ex.id)
    }
  }

  await Promise.all([
    toInsert.length  ? supabase.from('tcr_risk_alerts').insert(toInsert) : null,
    toResolve.length ? supabase.from('tcr_risk_alerts').update({ status: 'Resolved' }).in('id', toResolve) : null,
    ...toUpdate.map(u => supabase.from('tcr_risk_alerts').update({ severity: u.severity, status: 'Open' }).eq('id', u.id)),
  ].filter(Boolean))
}

// ── Weather forecast cache (module-level, 1-hour TTL) ─────────────────────────
let weatherCache: { data: object; ts: number } | null = null
const WEATHER_CACHE_TTL = 60 * 60 * 1000

// ── Weather (Open-Meteo batch forecast, no API key) ───────────────────────────
async function handleWeather(res: VercelResponse, supabase: ReturnType<typeof createClient>) {
  if (weatherCache && Date.now() - weatherCache.ts < WEATHER_CACHE_TTL) {
    return res.json(weatherCache.data)
  }

  // Active containers only
  const { data: ctrRows } = await supabase
    .from('tcr_containers_current')
    .select('container_no')
    .eq('arrived_yn', false)

  const containerNos = ((ctrRows ?? []) as { container_no: string }[]).map(r => r.container_no)
  if (containerNos.length === 0) return res.json({ alerts: [] })

  // Current segments with ETA but not yet arrived at segment
  const { data: segRows } = await supabase
    .from('tcr_route_segments')
    .select('container_no, to_location, eta')
    .in('container_no', containerNos)
    .eq('is_current_segment', true)
    .not('eta', 'is', null)
    .is('ata', null)

  type SRow = { container_no: string; to_location: string | null; eta: string | null }

  // Group by to_location → min ETA + affected container list
  const locGroups = new Map<string, { containers: string[]; minEta: string }>()
  for (const s of (segRows ?? [] as unknown[]) as unknown as SRow[]) {
    if (!s.to_location || !s.eta) continue
    const g = locGroups.get(s.to_location) ?? { containers: [], minEta: s.eta }
    g.containers.push(s.container_no)
    if (s.eta < g.minEta) g.minEta = s.eta
    locGroups.set(s.to_location, g)
  }
  if (locGroups.size === 0) return res.json({ alerts: [] })

  // Coordinates for each distinct next-stop location
  const { data: locRows } = await supabase
    .from('tcr_locations')
    .select('location_name, latitude, longitude')
    .in('location_name', [...locGroups.keys()])

  const locMap = new Map<string, { latitude: number; longitude: number }>()
  for (const l of (locRows ?? [] as unknown[]) as unknown as { location_name: string; latitude: number; longitude: number }[]) {
    locMap.set(l.location_name, { latitude: l.latitude, longitude: l.longitude })
  }

  // Only include locations with coords whose ETA falls within the 16-day forecast window
  const cutoff16 = new Date()
  cutoff16.setDate(cutoff16.getDate() + 16)
  const cutoff16Str = cutoff16.toISOString().split('T')[0]

  type ForecastTarget = {
    location:      string
    latitude:      number
    longitude:     number
    forecast_date: string
    containers:    string[]
  }
  const targets: ForecastTarget[] = []
  for (const [loc, g] of locGroups) {
    const geo = locMap.get(loc)
    if (!geo || g.minEta > cutoff16Str) continue
    targets.push({ location: loc, latitude: geo.latitude, longitude: geo.longitude, forecast_date: g.minEta, containers: g.containers })
  }
  if (targets.length === 0) return res.json({ alerts: [] })

  // Open-Meteo batch forecast (comma-separated lat/lon, free, no key needed)
  const params = new URLSearchParams({
    latitude:      targets.map(t => t.latitude.toFixed(4)).join(','),
    longitude:     targets.map(t => t.longitude.toFixed(4)).join(','),
    daily:         'weather_code,wind_speed_10m_max,temperature_2m_min,precipitation_sum',
    timezone:      'auto',
    forecast_days: '16',
  })
  let forecasts: object[]
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
    if (!r.ok) throw new Error(`Open-Meteo ${r.status}`)
    const json = await r.json() as object
    // Single location → object, multiple → array
    forecasts = Array.isArray(json) ? json : [json]
  } catch {
    return res.json({ alerts: [] })
  }

  function getSeverity(code: number, wind: number, tempMin: number): { level: 'severe' | 'warning' | 'caution'; label: string } | null {
    if (code >= 95)                   return { level: 'severe',  label: '폭풍'   }
    if (code >= 71 && code <= 77)     return { level: 'warning', label: '대설'   }
    if (code >= 85 && code <= 86)     return { level: 'warning', label: '눈소나기' }
    if (wind > 60)                    return { level: 'warning', label: '강풍'   }
    if (tempMin < -25)                return { level: 'warning', label: '혹한'   }
    if (code >= 80)                   return { level: 'caution', label: '강수'   }
    if (wind > 40)                    return { level: 'caution', label: '바람'   }
    return null
  }

  const alerts: object[] = []
  for (let i = 0; i < targets.length; i++) {
    const target   = targets[i]
    const forecast = forecasts[i] as Record<string, Record<string, number[]>> | undefined
    if (!forecast?.daily?.time) continue

    const times = forecast.daily.time as unknown as string[]
    const idx   = times.indexOf(target.forecast_date)
    if (idx === -1) continue

    const code    = (forecast.daily.weather_code as number[])[idx] ?? 0
    const wind    = (forecast.daily.wind_speed_10m_max as number[])[idx] ?? 0
    const tempMin = (forecast.daily.temperature_2m_min as number[])[idx] ?? 0

    const sev = getSeverity(code, wind, tempMin)
    if (!sev) continue

    alerts.push({
      location:            target.location,
      latitude:            target.latitude,
      longitude:           target.longitude,
      forecast_date:       target.forecast_date,
      weather_code:        code,
      severity:            sev.level,
      label:               sev.label,
      wind_speed:          Math.round(wind),
      temp_min:            Math.round(tempMin),
      containers_affected: target.containers,
    })
  }

  const result = { alerts }
  weatherCache = { data: result, ts: Date.now() }
  return res.json(result)
}

// ── List (was containers-list.ts) ─────────────────────────────────────────────
async function handleList(req: VercelRequest, res: VercelResponse, supabase: ReturnType<typeof createClient>) {
  // Search query bypasses the active filter so historical containers remain searchable
  const searchQuery = String(req.query.q ?? '').trim().toUpperCase()

  // Active view window: in-transit OR arrived ≤7 days ago OR arrived with no ata_final (edge case)
  const cutoff7 = new Date()
  cutoff7.setDate(cutoff7.getDate() - 7)
  const cutoff7Str = cutoff7.toISOString().split('T')[0]

  let listQuery = supabase
    .from('tcr_containers_current')
    .select(
      'container_no, customer_list, origin, destination, current_location, ' +
      'current_location_since, eta_final, ata_final, arrived_yn, transport_mode, load_type',
    )

  if (searchQuery) {
    // Search mode: no active filter — return all matching containers (historical included)
    listQuery = listQuery.ilike('container_no', `%${searchQuery}%`)
  } else {
    // Default active filter:
    //   arrived_yn = false          → in-transit, always show
    //   ata_final IS NULL           → edge case: arrived_yn=true but no ata_final recorded
    //   ata_final >= today-7d       → recently arrived, show for 7 days then drop from view
    listQuery = listQuery.or(
      `arrived_yn.eq.false,ata_final.is.null,ata_final.gte.${cutoff7Str}`,
    )
  }

  const { data: ctrRows, error: ctrErr } = await listQuery.order('container_no')

  if (ctrErr) return res.status(500).json({ ok: false, error: ctrErr.message })

  const rows = (ctrRows ?? [] as unknown[]) as unknown as {
    container_no:            string
    customer_list:           string | null
    origin:                  string | null
    destination:             string | null
    current_location:        string | null
    current_location_since:  string | null
    eta_final:               string | null
    ata_final:               string | null
    arrived_yn:              boolean
    transport_mode:          string | null
    load_type:               string | null
  }[]

  if (rows.length === 0) return res.json({ containers: [], total: 0 })

  const containerNos = rows.map(r => r.container_no)

  // Fetch ALL segments (needed for isArrived + computeCurrentSeg) and open alerts in parallel
  const [segResult, alertResult] = await Promise.all([
    supabase
      .from('tcr_route_segments')
      .select('container_no, segment_id, segment_no, segment_name, to_location, etd, atd, eta, ata')
      .in('container_no', containerNos)
      .order('segment_no'),
    supabase
      .from('tcr_risk_alerts')
      .select('container_no, severity')
      .in('container_no', containerNos)
      .eq('status', 'Open'),
  ])

  type SegRow   = {
    container_no:  string
    segment_id:    string
    segment_no:    number
    segment_name:  string | null
    to_location:   string | null
    etd:           string | null
    atd:           string | null
    eta:           string | null
    ata:           string | null
  }
  type AlertRow = { container_no: string; severity: string }

  const segRows   = (segResult.data   ?? [] as unknown[]) as unknown as SegRow[]
  const alertRows = (alertResult.data ?? [] as unknown[]) as unknown as AlertRow[]

  // Group all segments by container_no; compute arrived status + current segment per container
  const allSegsByContainer = new Map<string, SegRow[]>()
  for (const s of segRows) {
    const arr = allSegsByContainer.get(s.container_no) ?? []
    arr.push(s)
    allSegsByContainer.set(s.container_no, arr)
  }

  const arrivedMap      = new Map<string, boolean>()
  const currentSegIdMap = new Map<string, string | null>()
  for (const r of rows) {
    const segs    = (allSegsByContainer.get(r.container_no) ?? []).sort((a, b) => a.segment_no - b.segment_no)
    const arrived = isArrived(r, segs)
    arrivedMap.set(r.container_no, arrived)
    currentSegIdMap.set(r.container_no, arrived ? null : computeCurrentSeg(segs, r.current_location, r.destination))
  }

  // container_no → current-segment name / to_location / delay data (for signal + geo fallback)
  const segMap      = new Map<string, string>()
  const segToLocMap = new Map<string, string>()
  const segDataMap  = new Map<string, { etd: string | null; atd: string | null; eta: string | null; ata: string | null }>()
  for (const r of rows) {
    const currentSegId = currentSegIdMap.get(r.container_no)
    const currentSeg   = currentSegId
      ? (allSegsByContainer.get(r.container_no) ?? []).find(s => s.segment_id === currentSegId)
      : undefined
    if (currentSeg) {
      if (currentSeg.segment_name) segMap.set(r.container_no, currentSeg.segment_name)
      if (currentSeg.to_location)  segToLocMap.set(r.container_no, currentSeg.to_location)
      segDataMap.set(r.container_no, { etd: currentSeg.etd, atd: currentSeg.atd, eta: currentSeg.eta, ata: currentSeg.ata })
    }
  }

  // Alert map (for open_alert_count, not signal derivation)
  const alertMap = new Map<string, { severity: string }[]>()
  for (const a of alertRows) {
    const list = alertMap.get(a.container_no) ?? []
    list.push({ severity: a.severity })
    alertMap.set(a.container_no, list)
  }

  // Collect ALL unique location names for one batch lookup
  const allLocNames = new Set<string>()
  for (const r of rows) {
    if (r.current_location) allLocNames.add(r.current_location)
    if (r.destination)      allLocNames.add(r.destination)
    if (r.origin)           allLocNames.add(r.origin)
  }
  for (const toName of segToLocMap.values()) allLocNames.add(toName)

  const { data: locRows } = await supabase
    .from('tcr_locations')
    .select('location_name, latitude, longitude')
    .in('location_name', [...allLocNames])

  const locMap = new Map<string, { latitude: number; longitude: number }>()
  for (const l of (locRows ?? [] as unknown[]) as unknown as { location_name: string; latitude: number; longitude: number }[]) {
    locMap.set(l.location_name, { latitude: l.latitude, longitude: l.longitude })
  }

  const containers = rows.map(r => {
    const arrived   = arrivedMap.get(r.container_no) ?? !!r.arrived_yn
    const segToName = segToLocMap.get(r.container_no) ?? null
    const geo = arrived
      // Arrived (≤7d): place marker at destination — container has reached its end-point
      ? (r.destination      ? locMap.get(r.destination)      : undefined) ??
        (r.current_location ? locMap.get(r.current_location) : undefined) ??
        null
      // In-transit: current location geo, with segment next-stop fallback only when
      // current_location is set (but not yet geocoded). Containers with null current_location
      // get no coordinates and are excluded from the map.
      : (r.current_location ? locMap.get(r.current_location) : undefined) ??
        (r.current_location && segToName ? locMap.get(segToName) : undefined) ??
        null

    const alerts = alertMap.get(r.container_no) ?? []
    const { signal, reason } = calcSignalAndReason(
      arrived,
      segDataMap.get(r.container_no) ?? null,
      r.current_location_since,
    )
    return {
      container_no:         r.container_no,
      customer_list:        r.customer_list ?? null,
      origin:               r.origin ?? null,
      destination:          r.destination ?? null,
      current_location:     r.current_location ?? null,
      latitude:             geo?.latitude  ?? null,
      longitude:            geo?.longitude ?? null,
      arrived_yn:           arrived,
      signal,
      signal_reason:        reason || null,
      eta_final:            r.eta_final ?? null,
      ata_final:            r.ata_final ?? null,
      current_segment_name: segMap.get(r.container_no) ?? null,
      open_alert_count:     alerts.length,
      transport_mode:       r.transport_mode ?? null,
      load_type:            r.load_type ?? null,
    }
  })

  // Fire-and-forget: upsert DELAY_AUTO alerts without blocking response
  syncAutoAlerts(containers.map(c => ({ container_no: c.container_no, signal: c.signal })), supabase)
    .catch(() => { /* non-blocking — ignore errors */ })

  return res.json({ containers, total: containers.length })
}

// ── Detail (was container-detail.ts) ──────────────────────────────────────────
async function handleDetail(req: VercelRequest, res: VercelResponse, supabase: ReturnType<typeof createClient>) {
  const containerNo = String(req.query.container_no ?? '').trim().toUpperCase()
  if (!containerNo) return res.status(400).json({ ok: false, error: 'Missing ?container_no=' })

  const [ctrRes, segRes, itemRes, alertRes] = await Promise.all([
    supabase.from('tcr_containers_current').select('*').eq('container_no', containerNo).single(),
    supabase.from('tcr_route_segments').select('*').eq('container_no', containerNo).order('segment_no'),
    supabase.from('tcr_shipment_items').select('*').eq('container_no', containerNo),
    supabase.from('tcr_risk_alerts').select('*').eq('container_no', containerNo),
  ])

  if (ctrRes.error || !ctrRes.data) {
    return res.status(404).json({ ok: false, error: 'Container not found' })
  }

  // Re-derive arrived status and current segment using live location signals
  type DetailSeg = SegmentLike & { is_current_segment: boolean; [key: string]: unknown }
  const container  = { ...ctrRes.data } as Record<string, unknown>
  const detailSegs = ([...(segRes.data ?? [])] as DetailSeg[])
    .sort((a, b) => (a.segment_no as number) - (b.segment_no as number))

  const arrived = isArrived(
    { ata_final:        container.ata_final        as string | null,
      current_location: container.current_location as string | null,
      destination:      container.destination      as string | null },
    detailSegs,
  )
  container.arrived_yn = arrived

  const currentSegId = arrived
    ? null
    : computeCurrentSeg(
        detailSegs,
        container.current_location as string | null,
        container.destination      as string | null,
      )

  const updatedSegments = detailSegs.map(s => ({
    ...s,
    is_current_segment: !arrived && s.segment_id === currentSegId,
  }))

  return res.json({
    ok:        true,
    container,
    segments:  updatedSegments,
    items:     itemRes.data ?? [],
    alerts:    alertRes.data ?? [],
  })
}

// ── Upload log (admin history view) ──────────────────────────────────────────
async function handleUploadLog(_req: VercelRequest, res: VercelResponse, supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from('tcr_upload_log')
    .select('id, uploaded_at, uploader_ip, file_name, file_type, containers_count, segments_count')
    .order('uploaded_at', { ascending: false })
    .limit(100)

  if (error) return res.status(500).json({ ok: false, error: error.message })
  return res.json({ ok: true, logs: data ?? [] })
}

// ── Upsert (Excel upload from TcrUploadPage) ──────────────────────────────────
async function handleUpsert(req: VercelRequest, res: VercelResponse, supabase: ReturnType<typeof createClient>) {
  const body = req.body as {
    containers?: Record<string, unknown>[]
    segments?:   Record<string, unknown>[]
    files_info?: { file_name: string; file_type: string; containers_count: number; segments_count: number }[]
  }
  if (!body || !Array.isArray(body.containers)) {
    return res.status(400).json({ ok: false, error: 'Missing containers array in body' })
  }

  const rawContainers = body.containers ?? []
  const rawSegments   = body.segments   ?? []
  const errors: string[] = []

  // Deduplicate by key — last value wins (matches Excel row order)
  const containers = Object.values(
    rawContainers.reduce<Record<string, Record<string, unknown>>>((acc, c) => {
      const key = String(c.container_no ?? '').trim()
      if (key) acc[key] = c
      return acc
    }, {}),
  )
  const segments = Object.values(
    rawSegments.reduce<Record<string, Record<string, unknown>>>((acc, s) => {
      const key = String(s.segment_id ?? '').trim()
      if (key) acc[key] = s
      return acc
    }, {}),
  )

  // Auto-compute current_location_since:
  // Fetch existing location data so we can preserve the since-date when location is unchanged,
  // and reset it to today when the location changes (or the container is new).
  const today = new Date().toISOString().split('T')[0]
  type ExLocRow = { container_no: string; current_location: string | null; current_location_since: string | null }
  const existingLocMap = new Map<string, ExLocRow>()
  {
    const keys = containers.map(c => String(c.container_no ?? '').trim()).filter(Boolean)
    if (keys.length > 0) {
      const { data: existingLocs } = await supabase
        .from('tcr_containers_current')
        .select('container_no, current_location, current_location_since')
        .in('container_no', keys)
      for (const row of (existingLocs ?? []) as ExLocRow[]) {
        existingLocMap.set(row.container_no, row)
      }
    }
  }

  // Upsert containers
  let updatedContainers = 0
  if (containers.length > 0) {
    const containerRows = containers.map(c => {
      const key     = String(c.container_no ?? '').trim()
      const newLoc  = c.current_location ? String(c.current_location) : null
      const existing = existingLocMap.get(key)
      // Reset since-date to today when location changes; preserve it when location is the same.
      const locSince = (!existing || existing.current_location !== newLoc)
        ? today
        : (existing.current_location_since ?? today)
      const row: Record<string, unknown> = {
        container_no:           key,
        origin:                 c.origin           ?? null,
        destination:            c.destination      ?? null,
        transport_mode:         c.transport_mode   ?? null,
        current_location:       newLoc,
        current_location_since: locSince,
        eta_final:              c.eta_final        ?? null,
        ata_final:              c.ata_final        ?? null,
        arrived_yn:             Boolean(c.arrived_yn),
      }
      if (c.current_location_raw) row.current_location_raw = c.current_location_raw
      if ((c as Record<string, unknown>).transit_time_days != null) row.total_tt_days = (c as Record<string, unknown>).transit_time_days
      const ft = String((c as Record<string, unknown>).file_type ?? '').trim()
      if (ft) row.file_type = ft
      return row
    })

    const { error: cErr } = await supabase
      .from('tcr_containers_current')
      .upsert(containerRows, { onConflict: 'container_no' })

    if (cErr) {
      console.error('containers upsert error:', cErr)
      errors.push(`containers: ${cErr.message} | code: ${cErr.code} | details: ${cErr.details ?? ''} | hint: ${cErr.hint ?? ''}`)
    } else {
      updatedContainers = containerRows.length
    }
  }

  // Upsert segments
  let updatedSegments = 0
  if (segments.length > 0) {
    // Filter out rows missing required PK fields
    const validSegments = (segments as Record<string, unknown>[]).filter(s =>
      s.segment_id && String(s.segment_id).trim() &&
      s.container_no && String(s.container_no).trim() &&
      s.segment_no !== null && s.segment_no !== undefined
    )

    if (validSegments.length < segments.length) {
      errors.push(`segments: ${segments.length - validSegments.length} rows skipped (missing segment_id / container_no / segment_no)`)
    }

    if (validSegments.length > 0) {
      const segmentRows = validSegments.map(s => ({
        segment_id:         String(s.segment_id).trim(),
        container_no:       String(s.container_no).trim(),
        segment_no:         Number(s.segment_no),
        segment_name:       s.segment_name   ? String(s.segment_name)   : null,
        from_location:      s.from_location  ? String(s.from_location)  : null,
        to_location:        s.to_location    ? String(s.to_location)    : null,
        etd:                s.etd && String(s.etd).trim()  ? String(s.etd).trim()  : null,
        atd:                s.atd && String(s.atd).trim()  ? String(s.atd).trim()  : null,
        eta:                s.eta && String(s.eta).trim()  ? String(s.eta).trim()  : null,
        ata:                s.ata && String(s.ata).trim()  ? String(s.ata).trim()  : null,
        is_current_segment: Boolean(s.is_current_segment),
      }))

      // Try upsert with segment_id first; if that constraint doesn't exist, fall back to composite key
      const { error: sErr1 } = await supabase
        .from('tcr_route_segments')
        .upsert(segmentRows, { onConflict: 'segment_id' })

      if (sErr1) {
        const isConstraintErr = sErr1.code === '42P10' || (sErr1.message ?? '').toLowerCase().includes('constraint')
        if (isConstraintErr) {
          // segment_id unique constraint not found — retry with composite key
          const { error: sErr2 } = await supabase
            .from('tcr_route_segments')
            .upsert(segmentRows, { onConflict: 'container_no,segment_no' })

          if (sErr2) {
            console.error('segments upsert error (composite fallback):', sErr2)
            errors.push(`segments: ${sErr2.message} | code: ${sErr2.code} | details: ${sErr2.details ?? ''} | hint: ${sErr2.hint ?? ''}`)
          } else {
            updatedSegments = validSegments.length
          }
        } else {
          console.error('segments upsert error:', sErr1)
          errors.push(`segments: ${sErr1.message} | code: ${sErr1.code} | details: ${sErr1.details ?? ''} | hint: ${sErr1.hint ?? ''}`)
        }
      } else {
        updatedSegments = validSegments.length
      }
    }
  }

  // Log each uploaded file to tcr_upload_log (fire-and-forget, non-blocking)
  const filesInfo = body.files_info ?? []
  if (filesInfo.length > 0) {
    const ip = String((req.headers['x-forwarded-for'] as string | undefined) ?? '').split(',')[0].trim() || null
    const logRows = filesInfo.map(f => ({
      uploader_ip:      ip,
      file_name:        String(f.file_name ?? ''),
      file_type:        String(f.file_type ?? ''),
      containers_count: Number(f.containers_count ?? 0),
      segments_count:   Number(f.segments_count ?? 0),
    }))
    supabase.from('tcr_upload_log').insert(logRows).then(() => null).catch(() => null)
  }

  return res.json({ ok: true, updated_containers: updatedContainers, updated_segments: updatedSegments, errors })
}

// ── Delay notify (merged from tcr/delay-notify.ts) ────────────────────────────
function calcSignalAndReason(
  arrivedYn: boolean,
  seg: { etd: string | null; atd: string | null; eta: string | null; ata: string | null } | null,
  currentLocationSince: string | null,
): { signal: TcrSignal; reason: string } {
  if (arrivedYn) return { signal: 'green', reason: '' }

  const today = new Date().toISOString().split('T')[0]
  let maxDelay = 0
  let reason = ''

  if (seg) {
    const depDelay = daysDiff(seg.etd, seg.atd ?? today)
    if (depDelay !== null && depDelay > maxDelay) {
      maxDelay = depDelay
      reason = `출발 ${Math.floor(depDelay)}일 초과`
    }
    const arrDelay = daysDiff(seg.eta, seg.ata ?? today)
    if (arrDelay !== null && arrDelay > maxDelay) {
      maxDelay = arrDelay
      reason = `도착 ${Math.floor(arrDelay)}일 초과`
    }
  }

  const dwell = daysDiff(currentLocationSince, today)
  if (dwell !== null && dwell > maxDelay) {
    maxDelay = dwell
    reason = `동일 위치 ${Math.floor(dwell)}일 정체`
  }

  if (maxDelay >= 5) return { signal: 'red',    reason }
  if (maxDelay >= 3) return { signal: 'yellow', reason }
  return { signal: 'blue', reason: '' }
}

async function handleDelayNotify(req: VercelRequest, res: VercelResponse, supabase: ReturnType<typeof createClient>) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = (req.headers['authorization'] ?? '').toString()
    if (auth !== `Bearer ${cronSecret}`) return res.status(401).json({ ok: false, error: 'unauthorized' })
  }

  const { data: ctrRows, error: ctrErr } = await supabase
    .from('tcr_containers_current')
    .select('container_no, origin, destination, current_location, current_location_since, eta_final, ata_final, arrived_yn')
    .eq('arrived_yn', false)

  if (ctrErr) return res.status(500).json({ ok: false, error: ctrErr.message })

  const containers = (ctrRows ?? []) as {
    container_no: string; origin: string | null; destination: string | null
    current_location: string | null; current_location_since: string | null
    eta_final: string | null; ata_final: string | null; arrived_yn: boolean
  }[]

  if (containers.length === 0) return res.json({ ok: true, checked: 0, newAlerts: 0, emailSent: false })

  const containerNos = containers.map(c => c.container_no)

  const { data: segRows } = await supabase
    .from('tcr_route_segments')
    .select('container_no, segment_id, segment_no, to_location, etd, atd, eta, ata')
    .in('container_no', containerNos)
    .order('segment_no')

  type FullSeg = SegmentLike & { etd: string | null; eta: string | null }
  const allSegs = (segRows ?? []) as FullSeg[]
  const segsByContainer = new Map<string, FullSeg[]>()
  for (const s of allSegs) {
    const arr = segsByContainer.get(s.container_no) ?? []
    arr.push(s)
    segsByContainer.set(s.container_no, arr)
  }

  type Computed = { container_no: string; signal: TcrSignal; reason: string; route: string; currentLocation: string }
  const computed: Computed[] = []

  for (const c of containers) {
    const segs    = (segsByContainer.get(c.container_no) ?? []).sort((a, b) => a.segment_no - b.segment_no)
    const arrived = isArrived(c, segs)
    if (arrived) continue

    const curSegId = computeCurrentSeg(segs, c.current_location, c.destination)
    const curSeg   = curSegId ? segs.find(s => s.segment_id === curSegId) ?? null : null
    const segData  = curSeg ? { etd: curSeg.etd, atd: curSeg.atd, eta: curSeg.eta, ata: curSeg.ata } : null

    const { signal, reason } = calcSignalAndReason(false, segData, c.current_location_since)
    computed.push({
      container_no:    c.container_no,
      signal, reason,
      route:           [c.origin, c.destination].filter(Boolean).join(' → '),
      currentLocation: c.current_location ?? '—',
    })
  }

  const { data: existingAlerts } = await supabase
    .from('tcr_risk_alerts')
    .select('id, container_no, severity, status')
    .in('container_no', containerNos)
    .eq('alert_type', 'DELAY_AUTO')
    .eq('status', 'Open')

  type ExAlert = { id: string; container_no: string; severity: string; status: string }
  const existingMap = new Map<string, ExAlert>()
  for (const a of (existingAlerts ?? []) as ExAlert[]) existingMap.set(a.container_no, a)

  const now = new Date().toISOString()
  const digestAlerts: TcrDigestAlert[] = []
  const toInsert: object[] = []
  const toResolve: string[] = []
  const toUpdate: { id: string; severity: string }[] = []

  for (const c of computed) {
    const ex = existingMap.get(c.container_no)
    if (c.signal === 'red' || c.signal === 'yellow') {
      const severity = c.signal === 'red' ? 'Critical' : 'Watch'
      if (!ex) {
        toInsert.push({ container_no: c.container_no, alert_type: 'DELAY_AUTO', severity, status: 'Open', first_seen_at: now, last_seen_at: now })
        digestAlerts.push({ containerNo: c.container_no, route: c.route, currentLocation: c.currentLocation, severity, delayReason: c.reason || (severity === 'Critical' ? '5일 이상 지연' : '3일 이상 지연') })
      } else if (ex.severity !== severity) {
        toUpdate.push({ id: ex.id, severity })
      }
      existingMap.delete(c.container_no)
    } else {
      existingMap.delete(c.container_no)
    }
  }
  for (const ex of existingMap.values()) toResolve.push(ex.id)

  await Promise.all([
    toInsert.length  ? supabase.from('tcr_risk_alerts').insert(toInsert) : null,
    toResolve.length ? supabase.from('tcr_risk_alerts').update({ status: 'Resolved' }).in('id', toResolve) : null,
    ...toUpdate.map(u => supabase.from('tcr_risk_alerts').update({ severity: u.severity, status: 'Open', last_seen_at: now }).eq('id', u.id)),
  ].filter(Boolean))

  let emailSent = false
  if (digestAlerts.length > 0) {
    await sendTcrDelayDigestEmail(digestAlerts).catch(err => console.error('[tcr-delay-notify] email failed:', err))
    emailSent = true
  }

  return res.json({ ok: true, checked: computed.length, newAlerts: digestAlerts.length, resolved: toResolve.length, updated: toUpdate.length, emailSent })
}

// ── Tracing report send ───────────────────────────────────────────────────────
async function handleTracingSend(req: VercelRequest, res: VercelResponse, supabase: ReturnType<typeof createClient>) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = (req.headers['authorization'] ?? '').toString()
    if (auth !== `Bearer ${cronSecret}`) return res.status(401).json({ ok: false, error: 'unauthorized' })
  }

  const resendKey = process.env.RESEND_API_KEY ?? ''
  const from      = 'MTL Link <noreply@mtlb.co.kr>'

  const reportFilter = String(req.query.report ?? '').trim()
  const profiles = reportFilter ? PROFILES.filter(p => p.reportKey === reportFilter) : PROFILES
  if (profiles.length === 0) {
    return res.status(400).json({ ok: false, error: `Unknown report: ${reportFilter}` })
  }

  const results: object[] = []

  for (const profile of profiles) {
    let rowCount = 0, changedRows = 0, stalledRows = 0, changed = false, sent = false
    try {
      const rows  = await loadRows(profile, supabase)
      rowCount    = rows.length
      stalledRows = rows.filter(r => r.stalled).length

      if (rows.length === 0) {
        await supabase.from('tracing_report_runs').insert({ report_key: profile.reportKey, changed: false, sent: false, row_count: 0, changed_rows: 0, stalled_rows: 0 })
        results.push({ report: profile.reportKey, sent: false, reason: 'no_rows' })
        continue
      }

      type StateRow = { row_key: string; row_hash: string }
      const { data: prevState } = await supabase
        .from('tracing_report_state').select('row_key, row_hash').eq('report_key', profile.reportKey)
      const prevMap = new Map<string, string>()
      for (const s of (prevState ?? []) as StateRow[]) prevMap.set(s.row_key, s.row_hash)

      const currentKeys = new Set(rows.map(r => r.rowKey))
      for (const r of rows) {
        const h = rowHash(r)
        if (!prevMap.has(r.rowKey) || prevMap.get(r.rowKey) !== h) { changedRows++; changed = true }
      }
      for (const k of prevMap.keys()) {
        if (!currentKeys.has(k)) { changedRows++; changed = true }
      }

      if (!changed) {
        await supabase.from('tracing_report_runs').insert({ report_key: profile.reportKey, changed: false, sent: false, row_count: rowCount, changed_rows: 0, stalled_rows: stalledRows })
        results.push({ report: profile.reportKey, sent: false, reason: 'no_change', rowCount })
        continue
      }

      const html    = renderEmail(profile, rows)
      const subject = buildSubject(profile)
      if (resendKey) {
        await fetch('https://api.resend.com/emails', {
          method:  'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ from, to: profile.to, subject, html }),
        })
      }
      sent = true

      const removedKeys = [...prevMap.keys()].filter(k => !currentKeys.has(k))
      if (removedKeys.length > 0) {
        await supabase.from('tracing_report_state').delete().eq('report_key', profile.reportKey).in('row_key', removedKeys)
      }
      await supabase.from('tracing_report_state').upsert(
        rows.map(r => ({
          report_key: profile.reportKey,
          row_key:    r.rowKey,
          row_hash:   rowHash(r),
          raw:        { display: r.display, currentLocation: r.currentLocation, stalled: r.stalled },
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'report_key,row_key' },
      )
      await supabase.from('tracing_report_runs').insert({ report_key: profile.reportKey, changed, sent, row_count: rowCount, changed_rows: changedRows, stalled_rows: stalledRows })
      results.push({ report: profile.reportKey, sent: true, rowCount, changedRows, stalledRows })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[tracing-send] ${profile.reportKey} failed:`, err)
      await supabase.from('tracing_report_runs').insert({ report_key: profile.reportKey, changed, sent, row_count: rowCount, changed_rows: changedRows, stalled_rows: stalledRows, error: errMsg }).catch(() => null)
      results.push({ report: profile.reportKey, sent: false, error: errMsg })
    }
  }

  return res.json({ ok: true, results })
}

// ── Router ────────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Supabase env not set' })
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  const action = String(req.query.action ?? 'list')

  if (req.method === 'POST' && action === 'upsert') return handleUpsert(req, res, supabase)
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  if (action === 'upload_log')    return handleUploadLog(req, res, supabase)
  if (action === 'delay-notify')  return handleDelayNotify(req, res, supabase)
  if (action === 'tracing-send')  return handleTracingSend(req, res, supabase)
  if (action === 'detail')        return handleDetail(req, res, supabase)
  if (action === 'weather')       return handleWeather(res, supabase)
  return handleList(req, res, supabase)
}
