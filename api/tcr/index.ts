import ws from 'ws'
;(globalThis as any).WebSocket = ws

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

type TcrSignal = 'green' | 'red' | 'yellow' | 'blue'

function deriveSignal(arrivedYn: boolean, alerts: { severity: string }[]): TcrSignal {
  if (arrivedYn) return 'green'
  if (alerts.some(a => a.severity === 'Critical')) return 'red'
  if (alerts.some(a => a.severity === 'Watch'))    return 'yellow'
  return 'blue'
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
      'eta_final, ata_final, arrived_yn, transport_mode, load_type',
    )
    .or(`arrived_yn.eq.false,ata_final.gte.${cutoffStr}`)
    .order('container_no')

  if (ctrErr) return res.status(500).json({ ok: false, error: ctrErr.message })

  const rows = (ctrRows ?? [] as unknown[]) as unknown as {
    container_no:     string
    customer_list:    string | null
    origin:           string | null
    destination:      string | null
    current_location: string | null
    eta_final:        string | null
    ata_final:        string | null
    arrived_yn:       boolean
    transport_mode:   string | null
    load_type:        string | null
  }[]

  if (rows.length === 0) return res.json({ containers: [], total: 0 })

  const containerNos = rows.map(r => r.container_no)

  // Fetch current-segment info (incl. to_location) and open alerts in parallel
  const [segResult, alertResult] = await Promise.all([
    supabase
      .from('tcr_route_segments')
      .select('container_no, segment_name, to_location')
      .in('container_no', containerNos)
      .eq('is_current_segment', true),
    supabase
      .from('tcr_risk_alerts')
      .select('container_no, severity')
      .in('container_no', containerNos)
      .eq('status', 'Open'),
  ])

  type SegRow   = { container_no: string; segment_name: string | null; to_location: string | null }
  type AlertRow = { container_no: string; severity: string }

  const segRows   = (segResult.data   ?? [] as unknown[]) as unknown as SegRow[]
  const alertRows = (alertResult.data ?? [] as unknown[]) as unknown as AlertRow[]

  // container_no → segment_name / to_location
  const segMap      = new Map<string, string>()
  const segToLocMap = new Map<string, string>()
  for (const s of segRows) {
    if (s.segment_name) segMap.set(s.container_no, s.segment_name)
    if (s.to_location)  segToLocMap.set(s.container_no, s.to_location)
  }

  // Alert map
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
    return {
      container_no:         r.container_no,
      customer_list:        r.customer_list ?? null,
      origin:               r.origin ?? null,
      destination:          r.destination ?? null,
      current_location:     r.current_location ?? null,
      latitude:             geo?.latitude  ?? null,
      longitude:            geo?.longitude ?? null,
      signal:               deriveSignal(!!r.arrived_yn, alerts),
      eta_final:            r.eta_final ?? null,
      ata_final:            r.ata_final ?? null,
      current_segment_name: segMap.get(r.container_no) ?? null,
      open_alert_count:     alerts.length,
      transport_mode:       r.transport_mode ?? null,
      load_type:            r.load_type ?? null,
    }
  })

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

// ── Router ────────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Supabase env not set' })
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  const action = String(req.query.action ?? 'list')
  if (action === 'detail') return handleDetail(req, res, supabase)
  return handleList(res, supabase)
}
