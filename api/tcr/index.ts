import ws from 'ws'
;(globalThis as any).WebSocket = ws

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

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
async function handleList(res: VercelResponse, supabase: ReturnType<typeof createClient>) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 60)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const { data: ctrRows, error: ctrErr } = await supabase
    .from('tcr_containers_current')
    .select(
      'container_no, customer_list, origin, destination, current_location, ' +
      'current_location_since, eta_final, ata_final, arrived_yn, transport_mode, load_type',
    )
    .or(
      `and(arrived_yn.eq.false,or(eta_final.is.null,eta_final.gte.${cutoffStr})),` +
      `and(arrived_yn.eq.true,ata_final.gte.${cutoffStr})`,
    )
    .order('container_no')

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

  // Fetch current-segment info and open alerts in parallel
  const [segResult, alertResult] = await Promise.all([
    supabase
      .from('tcr_route_segments')
      .select('container_no, segment_name, to_location, etd, atd, eta, ata')
      .in('container_no', containerNos)
      .eq('is_current_segment', true),
    supabase
      .from('tcr_risk_alerts')
      .select('container_no, severity')
      .in('container_no', containerNos)
      .eq('status', 'Open'),
  ])

  type SegRow   = {
    container_no:  string
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

  // container_no → segment display name / to_location / delay data
  const segMap      = new Map<string, string>()
  const segToLocMap = new Map<string, string>()
  const segDataMap  = new Map<string, { etd: string | null; atd: string | null; eta: string | null; ata: string | null }>()
  for (const s of segRows) {
    if (s.segment_name) segMap.set(s.container_no, s.segment_name)
    if (s.to_location)  segToLocMap.set(s.container_no, s.to_location)
    segDataMap.set(s.container_no, { etd: s.etd, atd: s.atd, eta: s.eta, ata: s.ata })
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
    const segToName = segToLocMap.get(r.container_no) ?? null
    // In-transit: seg_to → cur_loc (no dest fallback — hasn't arrived yet)
    // Arrived:    cur_loc → dest   (destination fallback for arrived containers)
    const geo = r.arrived_yn
      ? (r.current_location ? locMap.get(r.current_location) : undefined) ??
        (r.destination      ? locMap.get(r.destination)      : undefined) ??
        null
      : (segToName          ? locMap.get(segToName)          : undefined) ??
        (r.current_location ? locMap.get(r.current_location) : undefined) ??
        null

    const alerts = alertMap.get(r.container_no) ?? []
    const signal = calcSignal(
      !!r.arrived_yn,
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
      signal,
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

  return res.json({
    ok:        true,
    container: ctrRes.data,
    segments:  segRes.data  ?? [],
    items:     itemRes.data ?? [],
    alerts:    alertRes.data ?? [],
  })
}

// ── Upsert (Excel upload from TcrUploadPage) ──────────────────────────────────
async function handleUpsert(req: VercelRequest, res: VercelResponse, supabase: ReturnType<typeof createClient>) {
  const body = req.body as {
    containers?: Record<string, unknown>[]
    segments?:   Record<string, unknown>[]
  }
  if (!body || !Array.isArray(body.containers)) {
    return res.status(400).json({ ok: false, error: 'Missing containers array in body' })
  }

  const containers = body.containers ?? []
  const segments   = body.segments   ?? []
  const errors: string[] = []

  // Upsert containers
  let updatedContainers = 0
  if (containers.length > 0) {
    const containerRows = containers.map(c => {
      const row: Record<string, unknown> = {
        container_no:     c.container_no,
        origin:           c.origin           ?? null,
        destination:      c.destination      ?? null,
        transport_mode:   c.transport_mode   ?? null,
        current_location: c.current_location ?? null,
        eta_final:        c.eta_final        ?? null,
        ata_final:        c.ata_final        ?? null,
        arrived_yn:       Boolean(c.arrived_yn),
      }
      // Include current_location_raw only if the value is non-null (column may not exist in all schemas)
      if (c.current_location_raw) row.current_location_raw = c.current_location_raw
      return row
    })

    const { error: cErr } = await supabase
      .from('tcr_containers_current')
      .upsert(containerRows, { onConflict: 'container_no' })

    if (cErr) {
      console.error('containers upsert error:', cErr)
      errors.push(`containers: ${cErr.message} | code: ${cErr.code} | details: ${cErr.details ?? ''} | hint: ${cErr.hint ?? ''}`)
    } else {
      updatedContainers = containers.length
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

  return res.json({ ok: true, updated_containers: updatedContainers, updated_segments: updatedSegments, errors })
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

  if (action === 'detail')  return handleDetail(req, res, supabase)
  if (action === 'weather') return handleWeather(res, supabase)
  return handleList(res, supabase)
}
