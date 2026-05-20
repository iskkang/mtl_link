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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Supabase env not set' })
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  // ── 1. All containers ─────────────────────────────────────────────────
  const { data: ctrRows, error: ctrErr } = await supabase
    .from('tcr_containers_current')
    .select(
      'container_no, customer_list, origin, destination, current_location, ' +
      'eta_final, ata_final, arrived_yn, transport_mode, load_type',
    )
    .order('container_no')

  if (ctrErr) return res.status(500).json({ ok: false, error: ctrErr.message })

  const rows = (ctrRows ?? []) as {
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

  // ── 2. Location coordinates ───────────────────────────────────────────
  const locationNames = [...new Set(rows.map(r => r.current_location).filter((v): v is string => !!v))]

  const { data: locRows } = await supabase
    .from('tcr_locations')
    .select('location_name, latitude, longitude')
    .in('location_name', locationNames)

  const locMap = new Map<string, { latitude: number; longitude: number }>()
  for (const l of (locRows ?? []) as { location_name: string; latitude: number; longitude: number }[]) {
    locMap.set(l.location_name, { latitude: l.latitude, longitude: l.longitude })
  }

  // ── 3. Current segment ────────────────────────────────────────────────
  const { data: segRows } = await supabase
    .from('tcr_route_segments')
    .select('container_no, segment_name')
    .in('container_no', containerNos)
    .eq('is_current_segment', true)

  const segMap = new Map<string, string>()
  for (const s of (segRows ?? []) as { container_no: string; segment_name: string }[]) {
    segMap.set(s.container_no, s.segment_name)
  }

  // ── 4. Open alerts ────────────────────────────────────────────────────
  const { data: alertRows } = await supabase
    .from('tcr_risk_alerts')
    .select('container_no, severity')
    .in('container_no', containerNos)
    .eq('status', 'Open')

  const alertMap = new Map<string, { severity: string }[]>()
  for (const a of (alertRows ?? []) as { container_no: string; severity: string }[]) {
    const list = alertMap.get(a.container_no) ?? []
    list.push({ severity: a.severity })
    alertMap.set(a.container_no, list)
  }

  // ── 5. Assemble ───────────────────────────────────────────────────────
  const containers = rows.map(r => {
    const geo    = r.current_location ? locMap.get(r.current_location) ?? null : null
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
