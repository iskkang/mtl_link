import ws from 'ws'
;(globalThis as any).WebSocket = ws

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { sendTcrDelayDigestEmail, type TcrDigestAlert } from '../_lib/resend.js'

// ─── Signal helpers (mirrors tcr/index.ts) ───────────────────────────────────

type TcrSignal = 'green' | 'red' | 'yellow' | 'blue'

function daysDiff(d1: string | null, d2: string | null): number | null {
  if (!d1 || !d2) return null
  return (new Date(d2).getTime() - new Date(d1).getTime()) / (1000 * 60 * 60 * 24)
}

const ROUTE_ORDER: Record<string, number> = {
  'incheon': 0, 'busan': 0, 'korea': 0,
  'qingdao': 10, 'lianyungang': 10,
  "xi'an": 20, 'xian': 20,
  'jiayuguan': 25, 'hami': 30, 'kashgar': 35,
  'dostyk': 40, 'altynkol': 40, 'khorgos': 40,
  'alashankou': 40, 'border': 40, 'kz border': 40,
  'almaty': 45, 'osh': 48,
  'andijan': 50, 'bishkek': 50, 'chukursay': 50,
  'kartaly': 52, 'nildy': 55,
  'brest': 60, 'małaszewicze': 65, 'duisburg': 70,
}

function normLoc(s: unknown): string {
  return String(s ?? '').trim().toLowerCase()
    .replace(/andijon/g, 'andijan').replace(/dostuk/g, 'dostyk')
    .replace(/kashi/g, 'kashgar').replace(/\bmala\b/g, 'małaszewicze')
}

function sameLoc(a: unknown, b: unknown): boolean {
  if (!a || !b) return false
  return normLoc(a) === normLoc(b)
}

interface SegData { etd: string | null; atd: string | null; eta: string | null; ata: string | null }

function calcSignalAndReason(
  arrivedYn: boolean,
  seg: SegData | null,
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
  if (maxDelay >= 3) return { signal: 'yellow',  reason }
  return { signal: 'blue', reason: '' }
}

interface SegmentLike { segment_id: string; segment_no: number; to_location: string | null; atd: string | null; ata: string | null }
interface ContainerLike { ata_final: string | null; current_location: string | null; destination: string | null }

function isArrived(c: ContainerLike, segments: SegmentLike[]): boolean {
  if (c.ata_final) return true
  if (sameLoc(c.current_location, c.destination)) return true
  const sorted = [...segments].sort((a, b) => a.segment_no - b.segment_no)
  if (sorted.at(-1)?.ata) return true
  return false
}

function computeCurrentSegId(segments: SegmentLike[], currentLocation: string | null): string | null {
  const segs = [...segments].sort((a, b) => a.segment_no - b.segment_no)
  if (segs.length === 0) return null

  const orderOf = (loc: unknown): number => {
    const n = normLoc(loc)
    if (!n) return -1
    if (ROUTE_ORDER[n] !== undefined) return ROUTE_ORDER[n]
    for (const k of Object.keys(ROUTE_ORDER)) {
      if (n.includes(k) || k.includes(n)) return ROUTE_ORDER[k]
    }
    return -1
  }

  const curOrder = orderOf(currentLocation)
  if (curOrder >= 0) {
    for (const s of segs) {
      if (orderOf(s.to_location) > curOrder) return s.segment_id
    }
    return segs.at(-1)?.segment_id ?? null
  }

  const inProgress = segs.find(s => s.atd && !s.ata)
  if (inProgress) return inProgress.segment_id

  let lastDoneIdx = -1
  segs.forEach((s, i) => { if (s.ata) lastDoneIdx = i })
  if (lastDoneIdx >= 0) return segs[Math.min(lastDoneIdx + 1, segs.length - 1)]?.segment_id ?? null

  return segs[0]?.segment_id ?? null
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }

  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = (req.headers['authorization'] ?? '').toString()
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ ok: false, error: 'unauthorized' })
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Supabase env not set' })
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  try {
    // 1. Query active (non-arrived) containers
    const { data: ctrRows, error: ctrErr } = await supabase
      .from('tcr_containers_current')
      .select('container_no, origin, destination, current_location, current_location_since, eta_final, ata_final, arrived_yn')
      .eq('arrived_yn', false)

    if (ctrErr) return res.status(500).json({ ok: false, error: ctrErr.message })
    const containers = (ctrRows ?? []) as {
      container_no:            string
      origin:                  string | null
      destination:             string | null
      current_location:        string | null
      current_location_since:  string | null
      eta_final:               string | null
      ata_final:               string | null
      arrived_yn:              boolean
    }[]

    if (containers.length === 0) {
      return res.json({ ok: true, checked: 0, newAlerts: 0, emailSent: false })
    }

    const containerNos = containers.map(c => c.container_no)

    // 2. Fetch all segments
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

    // 3. Compute signals
    type Computed = { container_no: string; signal: TcrSignal; reason: string; route: string; currentLocation: string }
    const computed: Computed[] = []

    for (const c of containers) {
      const segs    = (segsByContainer.get(c.container_no) ?? []).sort((a, b) => a.segment_no - b.segment_no)
      const arrived = isArrived(c, segs)
      if (arrived) continue

      const curSegId = computeCurrentSegId(segs, c.current_location)
      const curSeg   = curSegId ? segs.find(s => s.segment_id === curSegId) ?? null : null
      const segData: SegData | null = curSeg
        ? { etd: curSeg.etd, atd: curSeg.atd, eta: curSeg.eta, ata: curSeg.ata }
        : null

      const { signal, reason } = calcSignalAndReason(false, segData, c.current_location_since)

      computed.push({
        container_no:    c.container_no,
        signal,
        reason,
        route:           [c.origin, c.destination].filter(Boolean).join(' → '),
        currentLocation: c.current_location ?? '—',
      })
    }

    // 4. Get existing open DELAY_AUTO alerts
    const { data: existingAlerts } = await supabase
      .from('tcr_risk_alerts')
      .select('id, container_no, severity, status')
      .in('container_no', containerNos)
      .eq('alert_type', 'DELAY_AUTO')
      .eq('status', 'Open')

    type ExAlert = { id: string; container_no: string; severity: string; status: string }
    const existingMap = new Map<string, ExAlert>()
    for (const a of (existingAlerts ?? []) as ExAlert[]) {
      existingMap.set(a.container_no, a)
    }

    // 5. Compute new alerts, updates, resolutions
    const now = new Date().toISOString()
    const digestAlerts: TcrDigestAlert[] = []
    const toInsert: object[] = []
    const toResolve: string[] = []
    const toUpdate:  { id: string; severity: string }[] = []

    for (const c of computed) {
      const ex = existingMap.get(c.container_no)

      if (c.signal === 'red' || c.signal === 'yellow') {
        const severity = c.signal === 'red' ? 'Critical' : 'Watch'
        if (!ex) {
          toInsert.push({
            container_no: c.container_no,
            alert_type:   'DELAY_AUTO',
            severity,
            status:       'Open',
            first_seen_at: now,
            last_seen_at:  now,
          })
          digestAlerts.push({
            containerNo:     c.container_no,
            route:           c.route,
            currentLocation: c.currentLocation,
            severity,
            delayReason:     c.reason || (severity === 'Critical' ? '5일 이상 지연' : '3일 이상 지연'),
          })
        } else if (ex.severity !== severity) {
          toUpdate.push({ id: ex.id, severity })
        }
        // Remove from existingMap so remaining = resolved
        existingMap.delete(c.container_no)
      } else {
        existingMap.delete(c.container_no)
      }
    }

    // Containers no longer delayed → resolve
    for (const ex of existingMap.values()) {
      toResolve.push(ex.id)
    }

    // 6. Apply DB changes
    await Promise.all([
      toInsert.length  ? supabase.from('tcr_risk_alerts').insert(toInsert) : null,
      toResolve.length ? supabase.from('tcr_risk_alerts').update({ status: 'Resolved' }).in('id', toResolve) : null,
      ...toUpdate.map(u => supabase.from('tcr_risk_alerts').update({ severity: u.severity, status: 'Open', last_seen_at: now }).eq('id', u.id)),
    ].filter(Boolean))

    // 7. Send digest email for newly opened alerts
    let emailSent = false
    if (digestAlerts.length > 0) {
      await sendTcrDelayDigestEmail(digestAlerts).catch(err =>
        console.error('[tcr-delay-notify] email failed:', err),
      )
      emailSent = true
    }

    return res.json({
      ok:          true,
      checked:     computed.length,
      newAlerts:   digestAlerts.length,
      resolved:    toResolve.length,
      updated:     toUpdate.length,
      emailSent,
    })

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[tcr-delay-notify] fatal:', msg)
    return res.status(500).json({ ok: false, error: msg })
  }
}
