import ws from 'ws'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).WebSocket = ws

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { sendDelayDigestEmail, type DigestAlert } from '../_lib/resend.js'
// Safety policy: same conservative constraints as order sync.
// Sequential fetching only. No parallelism. No mass container sweep by default.

const CONTAINER_RE    = /^[A-Z]{4}\d{7}$/
const BATCH_SIZE      = 10
const DEFAULT_LIMIT   = 10
const MAX_LIMIT       = 200
const BATCH_DELAY_MS  = 500
const FALLBACK_DELAY_MS    = 300
const FETCH_MAX_ATTEMPTS   = 2    // 1 initial + 1 retry on network/HTTP error
const FETCH_RETRY_DELAY_MS = 1000

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActiveOrder {
  id:                 number
  external_1c_number: string | null
  containers:         string[] | null
  status:             string | null
}

interface FescoTrackingTransport {
  nameLatin?:    string
  voyageNumber?: string
}

interface FescoTrackingSegment {
  id?:                             string | number
  containerNumber?:                string
  segmentType?:                    string
  departureLocationEn?:            string
  destinationLocationEn?:          string
  countryOfDepartureLocationEn?:   string
  countryOfDestinationLocationEn?: string
  departureDate?:                  string | null
  destinationDate?:                string | null
  planingDepartureDate?:           string | null
  planingDestinationDate?:         string | null
  currentSegment?:                 boolean
  inProgress?:                     boolean
  completed?:                      boolean
  plan?:                           boolean
  transport?:                      FescoTrackingTransport
}

interface FescoTrackingEvent {
  id?:                string
  containerNumber?:   string
  date?:              string
  locationLatin?:     string
  operationLatin?:    string
  remainingDistance?: string
  totalDistance?:     number
  transportLatin?:    string
  type?:              string
}

interface FescoTrackingItem {
  containerNumber?: string
  unavailable?:     boolean
  type?:            string
  order?: {
    ownerShip?: string
    bills?:     string[]
  }
  segments?: FescoTrackingSegment[]
  events?:   { data?: FescoTrackingEvent[] }
  lastEventId?: string
}

interface FescoTrackingResponse {
  data?: FescoTrackingItem[]
}

interface FetchedContainer {
  ctrNum:         string
  orderId:        number
  extNum:         string | null
  orderCompleted: boolean
  item:    FescoTrackingItem
}

interface AlertResult {
  alert_level: 'green' | 'yellow' | 'red' | 'gray'
  alert_type:  string | null
  message:     string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Operations that definitively indicate delivery to consignee — case-insensitive check.
const DELIVERED_OPERATIONS = new Set([
  'departed full to consignee',
])

function deriveStatus(item: FescoTrackingItem): string {
  if (item.unavailable === true) return 'unavailable'

  // "Departed Full to Consignee" in the latest event = container delivered, case closed.
  // Check this before segment-date logic because it's unambiguous regardless of segment state.
  const events = item.events?.data ?? []
  const latestEvent = events.length > 0 ? events[0] : null
  const latestOp = (latestEvent?.operationLatin ?? latestEvent?.operation ?? '').trim().toLowerCase()
  if (latestOp && DELIVERED_OPERATIONS.has(latestOp)) return 'completed'

  const segs = item.segments ?? []
  if (segs.length === 0) return 'unknown'
  const last = segs[segs.length - 1]
  // Completed only when the final segment has an actual arrival date.
  // FESCO can set completed:true on segments that are still inProgress — do NOT rely on it.
  // Cross-check with the latest event's remainingDistance: if > 0, FESCO prematurely
  // closed the segment (e.g. train breakdown recorded as arrival). Keep as in_progress.
  if (last?.destinationDate) {
    const lastEvent = events.length > 0 ? events[0] : null
    const remaining = lastEvent?.remainingDistance != null
      ? parseFloat(String(lastEvent.remainingDistance))
      : null
    if (remaining !== null && !isNaN(remaining) && remaining > 0) return 'in_progress'
    return 'completed'
  }
  // Active flags override segment.completed.
  if (segs.some(s => s.currentSegment === true || s.inProgress === true)) return 'in_progress'
  if (segs.some(s => s.plan === true)) return 'planned'
  // Previous leg arrived with a real date; final leg exists but has no usable dates yet.
  const hasPreviousArrived = segs.some((s, i) => i < segs.length - 1 && !!s.destinationDate)
  const lastHasNoUsableDates =
    !last.departureDate &&
    !last.destinationDate &&
    !last.planingDepartureDate &&
    !last.planingDestinationDate
  if (segs.length > 1 && hasPreviousArrived && lastHasNoUsableDates) return 'awaiting_next_leg'
  return 'unknown'
}

function findCurrentSegment(segs: FescoTrackingSegment[]): FescoTrackingSegment | null {
  if (segs.length === 0) return null
  return (
    segs.find(s => s.currentSegment === true) ??
    segs.find(s => s.inProgress     === true) ??
    segs.find(s => s.plan           === true) ??
    segs[0]
  )
}

function deriveAlert(item: FescoTrackingItem, status: string): AlertResult {
  if (item.unavailable === true) {
    return {
      alert_level: 'yellow',
      alert_type:  'container_tracking_unavailable',
      message:     'Tracking is unavailable for this container.',
    }
  }

  if (status === 'completed') {
    return { alert_level: 'gray', alert_type: null, message: null }
  }

  if (status === 'unknown') {
    return {
      alert_level: 'yellow',
      alert_type:  'container_tracking_unknown',
      message:     'No usable tracking dates from FESCO.',
    }
  }

  if (status === 'awaiting_next_leg') {
    const segs = item.segments ?? []
    // Find the latest prior segment that has a real arrival date.
    let waitingStartDate: string | null = null
    for (let i = segs.length - 2; i >= 0; i--) {
      if (segs[i].destinationDate) { waitingStartDate = segs[i].destinationDate!; break }
    }
    if (!waitingStartDate) {
      return {
        alert_level: 'yellow',
        alert_type:  'awaiting_next_leg_watch',
        message:     'Awaiting next leg, but waiting start date is unavailable.',
      }
    }
    const waitDays = Math.floor((Date.now() - new Date(waitingStartDate).getTime()) / 86_400_000)
    if (waitDays >= 11) return { alert_level: 'red',    alert_type: 'awaiting_next_leg_overdue', message: 'Awaiting next leg departure for more than 10 days.' }
    if (waitDays >= 6)  return { alert_level: 'yellow', alert_type: 'awaiting_next_leg_watch',   message: 'Awaiting next leg departure for more than 5 days.'  }
    // waitDays < 6: do NOT return early — fall through to the location_stagnant check below.
    // A container waiting at a rail terminal for 3+ days should still be flagged yellow
    // via the event-based stagnant check, even though the segment-level wait is < 6 days.
  }

  const now = Date.now()

  // ── SEA vessel arrival delay (immediate, no floor rounding) ──────────────
  // Separate from planned_arrival_overdue: applies only to SEA segments,
  // uses fractional days (not floored) so 1-day ETA breach fires immediately.
  for (const s of (item.segments ?? [])) {
    if (
      (s as any).segmentType === 'SEA' &&
      s.planingDestinationDate &&
      !s.destinationDate &&
      !((s as any).completed && (s as any).inProgress)
    ) {
      const t = new Date(s.planingDestinationDate).getTime()
      if (!isNaN(t)) {
        const overdueDays = (now - t) / 86_400_000   // no Math.floor
        if (overdueDays > 3) return {
          alert_level: 'red',
          alert_type:  'vessel_arrival_overdue',
          message:     `Vessel has not arrived at destination. ETA ${s.planingDestinationDate} passed by ${Math.floor(overdueDays)} days.`,
        }
        if (overdueDays >= 1) return {
          alert_level: 'yellow',
          alert_type:  'vessel_arrival_watch',
          message:     `Vessel arrival delayed. ETA was ${s.planingDestinationDate}.`,
        }
      }
    }
  }

  // Planned arrival overdue (check destination first — higher impact)
  // Also fires when destinationDate is set but remainingDistance > 0 (FESCO premature completion).
  const _evts = item.events?.data ?? []
  const _lastEvt = _evts.length > 0 ? _evts[0] : null
  const _remaining = _lastEvt?.remainingDistance != null ? parseFloat(String(_lastEvt.remainingDistance)) : null
  const isPrematureCompletion = _remaining !== null && !isNaN(_remaining) && _remaining > 0
  for (const s of (item.segments ?? [])) {
    if (s.planingDestinationDate && (!s.destinationDate || isPrematureCompletion) &&
        !((s as any).completed && (s as any).inProgress)) {
      const t = new Date(s.planingDestinationDate).getTime()
      if (!isNaN(t)) {
        const overdueDays = Math.floor((now - t) / 86_400_000)
        if (overdueDays > 3) return { alert_level: 'red',    alert_type: 'planned_arrival_overdue', message: 'Planned arrival date passed by more than 3 days.' }
        if (overdueDays > 1) return { alert_level: 'yellow', alert_type: 'planned_arrival_watch',   message: 'Planned arrival date has passed.'                }
      }
    }
  }

  // Planned departure overdue
  for (const s of (item.segments ?? [])) {
    if (s.planingDepartureDate && !s.departureDate &&
        !((s as any).completed && (s as any).inProgress)) {
      const t = new Date(s.planingDepartureDate).getTime()
      if (!isNaN(t)) {
        const overdueDays = Math.floor((now - t) / 86_400_000)
        if (overdueDays > 3) return { alert_level: 'red',    alert_type: 'planned_departure_overdue', message: 'Planned departure date passed by more than 3 days.' }
        if (overdueDays > 1) return { alert_level: 'yellow', alert_type: 'planned_departure_watch',   message: 'Planned departure date has passed.'                }
      }
    }
  }

  // Location stagnant: container has not moved from the same location for 3+ days.
  // Checked last — only fires when no higher-priority alert matched above.
  // Skip when the current segment is SEA (container is on a vessel; events may not update mid-voyage).
  {
    const isSeaCurrent = (item.segments ?? []).some(
      s => s.currentSegment === true && s.segmentType === 'SEA',
    )
    if (!isSeaCurrent) {
      const evts = (item.events?.data ?? []).filter(
        (ev): ev is FescoTrackingEvent & { date: string; locationLatin: string } =>
          typeof ev.date === 'string' && typeof ev.locationLatin === 'string',
      )
      if (evts.length > 0) {
        // Sort newest-first to find the current location and when the streak started
        evts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        const curLoc = evts[0].locationLatin
        let stagnantSince = evts[0].date
        for (const ev of evts) {
          if (ev.locationLatin !== curLoc) break
          stagnantSince = ev.date // walk back to the earliest event at this location
        }
        const stagnantDays = (now - new Date(stagnantSince).getTime()) / 86_400_000
        if (stagnantDays >= 3) {
          return {
            alert_level: 'yellow',
            alert_type:  'location_stagnant',
            message:     `No movement from ${curLoc} for ${Math.floor(stagnantDays)} days.`,
          }
        }
      }
    }
  }

  return { alert_level: 'green', alert_type: null, message: null }
}

const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

// ─── Stale alert helpers ──────────────────────────────────────────────────────

interface StaleAlertResult {
  alertType: 'stale_tracking_watch' | 'stale_tracking_risk'
  severity:  'yellow' | 'red'
  message:   string
}

function getStaleAlert(row: {
  status?:          string | null
  last_success_at?: string | null
}): StaleAlertResult | null {
  if (row.status === 'completed') return null
  if (!row.last_success_at) {
    // Never synced successfully — treat as highest risk (no refresh baseline exists).
    return {
      alertType: 'stale_tracking_risk',
      severity:  'red',
      message:   'Tracking data has not been refreshed for more than 48 hours.',
    }
  }

  const ageHours = (Date.now() - new Date(row.last_success_at).getTime()) / 3_600_000

  if (ageHours >= 48) {
    return {
      alertType: 'stale_tracking_risk',
      severity:  'red',
      message:   'Tracking data has not been refreshed for more than 48 hours.',
    }
  }
  if (ageHours >= 24) {
    return {
      alertType: 'stale_tracking_watch',
      severity:  'yellow',
      message:   'Tracking data has not been refreshed for more than 24 hours.',
    }
  }
  return null
}

const ALERT_PRIORITY: Record<string, number> = { gray: 0, green: 1, yellow: 2, red: 3 }

function shouldApplyAlertLevel(current?: string | null, next?: string | null): boolean {
  return (ALERT_PRIORITY[next ?? 'gray'] ?? 0) > (ALERT_PRIORITY[current ?? 'gray'] ?? 0)
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CRON_SECRET guard — production only, same pattern as sync.ts
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

  const dryRun    = req.query.dryRun === '1' || req.query.dryRun === 'true'
  const rawLimit  = parseInt(String(req.query.limit  ?? String(DEFAULT_LIMIT)), 10)
  const limit     = Math.min(isNaN(rawLimit)  ? DEFAULT_LIMIT : Math.max(1, rawLimit),  MAX_LIMIT)
  const rawOffset = parseInt(String(req.query.offset ?? '0'), 10)
  const offset    = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Supabase env not set' })
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  // undici — always in node_modules, but must be imported dynamically so that a load
  // failure is caught here rather than crashing the Lambda before the handler runs.
  // (@vercel/node only compiles files with a default export; auth.ts has none.)
  const undici = await import('undici').catch((err: unknown) => {
    console.error('[ctr-sync] undici import FAILED:', err instanceof Error ? err.message : String(err))
    return null
  })
  if (!undici) return res.status(500).json({ ok: false, error: 'undici unavailable' })
  const { fetch: undiciFetch, Agent } = undici

  const fescoHttpAgent = new Agent({
    connectTimeout: 45000,
    headersTimeout: 120000,
    bodyTimeout:    120000,
  })

  // Retry helper: wraps undiciFetch with exponential backoff on network errors.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function fetchWithRetry(url: string, opts: any, label: string, attempts = 3): Promise<any> {
    let lastErr: any
    for (let i = 1; i <= attempts; i++) {
      try { return await undiciFetch(url, opts) }
      catch (e: any) {
        lastErr = e
        console.error(`[${label}] attempt ${i}/${attempts} failed:`, { causeCode: e?.cause?.code, message: e?.message })
        if (i < attempts) await new Promise(r => setTimeout(r, i * 3000))
      }
    }
    throw new Error(`${label}: ${lastErr?.cause?.code || lastErr?.message || 'unknown'}`)
  }

  // loginFesco inlined — auth.ts has no default export so @vercel/node never compiles it.
  // Headers and body match CLAUDE.md requirements exactly — do not change them.
  async function loginFesco(): Promise<string> {
    const username = process.env.FESCO_USERNAME
    const password = process.env.FESCO_PASSWORD
    if (!username || !password) throw new Error('FESCO_USERNAME or FESCO_PASSWORD not set')
    const loginBody = {
      usernameOrEmail: username,
      password,
      safeDevice:   false,
      personalData: false,
      sessionId:    null,
      browser: '{"name":"chrome","version":"131.0.0","os":"Windows 10","type":"browser"}',
    }
    const loginRes: any = await fetchWithRetry(
      'https://my.fesco.com/api/v2/lk/user/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept':       'application/json',
          'X-Lk-Lang':   'en',
        },
        body: JSON.stringify(loginBody),
        dispatcher: fescoHttpAgent,
      },
      'login',
    )
    const responseText = await loginRes.text()
    if (!loginRes.ok) throw new Error(`FESCO login failed: ${loginRes.status}: ${responseText.substring(0, 200)}`)
    let parsed: any
    try { parsed = JSON.parse(responseText) } catch { throw new Error('FESCO login response is not JSON: ' + responseText.substring(0, 100)) }
    const token = parsed?.data?.token
    if (!token) throw new Error('FESCO login: no token field. Got: ' + responseText.substring(0, 200))
    console.log('[auth] login successful, token length:', token.length)
    return token
  }

  const errors: string[] = []
  let ordersScanned       = 0
  let containersFound     = 0
  let validContainers     = 0
  let invalidContainers   = 0
  let containersFetched   = 0
  let currentRowsUpserted = 0
  let segmentsUpserted    = 0
  let alertsOpened          = 0
  let alertsUpdated         = 0
  let alertsResolved        = 0
  let failedContainersCount = 0
  let staleAlertsOpened    = 0
  let staleAlertsUpdated   = 0
  let staleAlertsResolved  = 0
  const newAlerts: DigestAlert[] = []
  const sampleNormalized: unknown[] = []

  try {

    // ── 1. Query ACTIVE + recently COMPLETED orders with containers ─────────
    // COMPLETED orders within 30 days are included so that FESCO data corrections
    // (e.g. premature destinationDate removed after train breakdown) are still picked up.
    console.log('[ctr-sync] step 1: querying active + recent completed orders')
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const { data: rawOrders, error: ordersError } = await supabase
      .from('fesco_orders')
      .select('id, external_1c_number, containers, status')
      .or(`status.eq.ACTIVE,and(status.eq.COMPLETED,last_synced_at.gte.${thirtyDaysAgo})`)

    if (ordersError) {
      return res.status(500).json({ ok: false, error: 'Query failed: ' + ordersError.message })
    }

    const orders = ((rawOrders ?? []) as ActiveOrder[]).filter(
      o => Array.isArray(o.containers) && (o.containers?.length ?? 0) > 0,
    )
    ordersScanned = orders.length
    console.log(`[ctr-sync] step 1 OK: ${ordersScanned} active/recent-completed orders with containers`)

    // ── 2. Extract, deduplicate, validate ───────────────────────────────────
    const containerToOrder = new Map<string, { orderId: number; extNum: string | null; orderCompleted: boolean }>()
    for (const order of orders) {
      const orderCompleted = (order.status ?? '').toUpperCase() === 'COMPLETED'
      for (const raw of order.containers ?? []) {
        const ctr = raw.trim().toUpperCase()
        if (!ctr) continue
        containersFound++
        if (!CONTAINER_RE.test(ctr)) {
          invalidContainers++
          continue
        }
        validContainers++
        if (!containerToOrder.has(ctr)) {
          containerToOrder.set(ctr, { orderId: order.id, extNum: order.external_1c_number, orderCompleted })
        }
      }
    }

    const allValid = [...containerToOrder.keys()].sort()
    const toLookup = allValid.slice(offset, offset + limit)
    console.log(
      `[ctr-sync] step 2 OK: ${validContainers} valid (${containerToOrder.size} unique), ` +
      `${invalidContainers} invalid, fetching ${toLookup.length} (offset=${offset}, limit=${limit})`,
    )

    if (toLookup.length === 0) {
      return res.json({
        ok: true, mode: dryRun ? 'dry_run' : 'live',
        ordersScanned, containersFound, validContainers, invalidContainers,
        containersFetched: 0, currentRowsUpserted: 0, segmentsUpserted: 0,
        alertsOpened: 0, alertsUpdated: 0, alertsResolved: 0,
        failedContainersCount: 0,
        staleAlertsOpened: 0, staleAlertsUpdated: 0, staleAlertsResolved: 0,
        errors,
      })
    }

    // ── 3. Authenticate ─────────────────────────────────────────────────────
    console.log('[ctr-sync] step 3: authenticating with FESCO')
    let token: string
    try {
      token = await loginFesco()
      console.log('[ctr-sync] step 3 OK: token received')
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: 'FESCO login: ' + (e instanceof Error ? e.message : String(e)),
      })
    }

    // ── 4. Fetch container tracking from FESCO ─────────────────────────────
    console.log(`[ctr-sync] step 4: fetching ${toLookup.length} containers (batch=${BATCH_SIZE})`)
    const fetched: FetchedContainer[] = []

    // Inner helper — uses token and errors from outer scope via closure.
    // Defined after token is definitely assigned (catch above returns).
    // Retries up to FETCH_MAX_ATTEMPTS times on network/HTTP errors; JSON parse is not retried.
    const fetchNumbers = async (numbers: string[]): Promise<FescoTrackingItem[]> => {
      const url = `https://my.fesco.com/api/v2/lk/tracking?numbers=${encodeURIComponent(numbers.join(','))}`
      for (let attempt = 1; attempt <= FETCH_MAX_ATTEMPTS; attempt++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let r: any
        try {
          r = await undiciFetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Lk-Lang':    'en',
              'User-Agent':   'MTL-Link-FESCO-Sync/1.0 (+internal operations dashboard)',
            },
            dispatcher: fescoHttpAgent,
          })
        } catch (e: unknown) {
          const msg = `fetch [${numbers[0]}…]: network: ${e instanceof Error ? e.message : String(e)}`
          if (attempt < FETCH_MAX_ATTEMPTS) { await pause(FETCH_RETRY_DELAY_MS); continue }
          errors.push(msg)
          return []
        }
        if (!r.ok) {
          const body: string = await r.text()
          const msg = `fetch [${numbers[0]}…]: HTTP ${r.status}: ${body.substring(0, 200)}`
          if (attempt < FETCH_MAX_ATTEMPTS) { await pause(FETCH_RETRY_DELAY_MS); continue }
          errors.push(msg)
          return []
        }
        try {
          const parsed = await r.json() as FescoTrackingResponse
          return parsed?.data ?? []
        } catch {
          errors.push(`fetch [${numbers[0]}…]: JSON parse error`)
          return []
        }
      }
      return []
    }

    const collectItems = (items: FescoTrackingItem[]) => {
      for (const item of items) {
        const ctrNum = (item.containerNumber ?? '').toUpperCase()
        if (!ctrNum) continue
        const orderInfo = containerToOrder.get(ctrNum) ?? { orderId: 0, extNum: null, orderCompleted: false }
        fetched.push({ ctrNum, orderId: orderInfo.orderId, extNum: orderInfo.extNum, orderCompleted: orderInfo.orderCompleted, item })
        containersFetched++
      }
    }

    for (let i = 0; i < toLookup.length; i += BATCH_SIZE) {
      const batch = toLookup.slice(i, i + BATCH_SIZE)
      const items = await fetchNumbers(batch)
      collectItems(items)

      // Fallback: individual requests for any containers the batch missed
      const returned = new Set(items.map(it => (it.containerNumber ?? '').toUpperCase()))
      const missing  = batch.filter(c => !returned.has(c))
      if (missing.length > 0) {
        console.log(`[ctr-sync] batch missed ${missing.length} containers, falling back individually`)
        for (const ctr of missing) {
          await pause(FALLBACK_DELAY_MS)
          collectItems(await fetchNumbers([ctr]))
        }
      }

      if (i + BATCH_SIZE < toLookup.length) await pause(BATCH_DELAY_MS)
    }

    console.log(`[ctr-sync] step 4 OK: data for ${containersFetched} containers`)

    const fetchedSet    = new Set(fetched.map(f => f.ctrNum))
    const failedContainers = toLookup.filter(c => !fetchedSet.has(c))
    failedContainersCount  = failedContainers.length
    if (failedContainersCount > 0) {
      console.log(`[ctr-sync] ${failedContainersCount} containers failed all fetch attempts`)
    }

    // ── 5. Normalize + upsert ───────────────────────────────────────────────
    const now = new Date().toISOString()

    for (const { ctrNum, orderId, extNum, orderCompleted, item } of fetched) {
      // Skip manually excluded containers
      const { data: excRow } = await supabase
        .from('fesco_container_tracking_current')
        .select('manually_excluded')
        .eq('container_number', ctrNum)
        .maybeSingle()
      if (excRow?.manually_excluded) continue

      const segs   = item.segments ?? []
      // If the parent order is marked COMPLETED in 1C, trust that over the FESCO tracking API
      // response (which can lag by hours/days before showing remainingDistance=0).
      const derivedStatus = deriveStatus(item)
      const status = (orderCompleted && derivedStatus !== 'completed') ? 'completed' : derivedStatus
      const alert  = deriveAlert(item, status)
      // For awaiting_next_leg and completed, use the final segment as curSeg.
      // completed containers may have null-placeholder segs at index 0 — the final seg has the real data.
      const curSeg = (
        (status === 'awaiting_next_leg' || status === 'completed') &&
        segs.length > 0
      )
        ? segs[segs.length - 1]
        : findCurrentSegment(segs)

      const currentRow = {
        container_number:          ctrNum,
        order_id:                  orderId,
        external_1c_number:        extNum,
        unavailable:               item.unavailable ?? false,
        owner_ship:                item.order?.ownerShip ?? null,
        bills:                     item.order?.bills     ?? null,
        status,
        alert_level:               alert.alert_level,
        alert_reason:              alert.message,
        current_segment_type:      curSeg?.segmentType                     ?? null,
        current_from:              curSeg?.departureLocationEn              ?? null,
        current_to:                curSeg?.destinationLocationEn            ?? null,
        departure_date:            curSeg?.departureDate                    ?? null,
        planned_departure_date:    curSeg?.planingDepartureDate             ?? null,
        destination_date:          curSeg?.destinationDate                  ?? null,
        planned_destination_date:  curSeg?.planingDestinationDate           ?? null,
        transport_name:            curSeg?.transport?.nameLatin             ?? null,
        voyage_number:             curSeg?.transport?.voyageNumber          ?? null,
        segments_json:             Array.isArray(item.segments) ? item.segments : [],
        events_json:               Array.isArray(item.events?.data) ? item.events!.data : [],
        raw_response:              item,
        last_checked_at:           now,
        last_success_at:           now,
        consecutive_errors:        0,
        updated_at:                now,
      }

      const segmentRows = segs.map((s, idx) => ({
        container_number:          ctrNum,
        order_id:                  orderId,
        external_1c_number:        extNum,
        segment_id:                s.id                                ?? null,
        segment_index:             idx + 1,
        segment_type:              s.segmentType                       ?? null,
        departure_location:        s.departureLocationEn               ?? null,
        destination_location:      s.destinationLocationEn             ?? null,
        departure_country:         s.countryOfDepartureLocationEn      ?? null,
        destination_country:       s.countryOfDestinationLocationEn    ?? null,
        departure_date:            s.departureDate                     ?? null,
        destination_date:          s.destinationDate                   ?? null,
        planned_departure_date:    s.planingDepartureDate               ?? null,
        planned_destination_date:  s.planingDestinationDate             ?? null,
        current_segment:           s.currentSegment                    ?? false,
        in_progress:               s.inProgress                        ?? false,
        completed:                 s.completed                         ?? false,
        plan:                      s.plan                              ?? false,
        transport_name:            s.transport?.nameLatin               ?? null,
        voyage_number:             s.transport?.voyageNumber            ?? null,
        raw_segment:               s,
        last_checked_at:           now,
        updated_at:                now,
      }))

      if (dryRun) {
        if (sampleNormalized.length < 3) sampleNormalized.push({ currentRow, segmentRows })
        continue
      }

      // Upsert current status row
      const { error: curErr } = await supabase
        .from('fesco_container_tracking_current')
        .upsert(currentRow, { onConflict: 'container_number' })
      if (curErr) {
        errors.push(`upsert current [${ctrNum}]: ${curErr.message}`)
      } else {
        currentRowsUpserted++
      }

      // Upsert segments (one row per segment index)
      for (const segRow of segmentRows) {
        const { error: segErr } = await supabase
          .from('fesco_container_tracking_segments')
          .upsert(segRow, { onConflict: 'container_number,segment_index' })
        if (segErr) {
          errors.push(`upsert seg [${ctrNum}#${segRow.segment_index}]: ${segErr.message}`)
        } else {
          segmentsUpserted++
        }
      }

      // Alerts: open / update last_seen / resolve
      if (alert.alert_type) {
        const { data: existing } = await supabase
          .from('fesco_alerts')
          .select('id')
          .eq('container_number', ctrNum)
          .eq('alert_type', alert.alert_type)
          .eq('status', 'open')
          .maybeSingle()

        if (existing) {
          await supabase
            .from('fesco_alerts')
            .update({ last_seen_at: now, raw_context: currentRow })
            .eq('id', existing.id)
          alertsUpdated++
          // Resolve open alerts of different types (stale alerts superseded by current one)
          const { data: staleOpenAlerts } = await supabase
            .from('fesco_alerts')
            .select('id')
            .eq('container_number', ctrNum)
            .eq('status', 'open')
            .neq('alert_type', alert.alert_type)
          if (staleOpenAlerts && staleOpenAlerts.length > 0) {
            await supabase
              .from('fesco_alerts')
              .update({ status: 'resolved', resolved_at: new Date().toISOString() })
              .in('id', staleOpenAlerts.map(a => a.id))
          }
        } else {
          await supabase
            .from('fesco_alerts')
            .insert({
              container_number:   ctrNum,
              order_id:           orderId,
              external_1c_number: extNum,
              alert_type:         alert.alert_type,
              severity:           alert.alert_level,
              message:            alert.message,
              status:             'open',
              raw_context:        currentRow,
              first_seen_at:      now,
              last_seen_at:       now,
            })
          alertsOpened++

          // 신규 alert 수집 — cron 완료 후 digest 1통으로 발송
          if (!dryRun && (alert.alert_level === 'red' || alert.alert_level === 'yellow')) {
            const route = [currentRow.current_from, currentRow.current_to]
              .filter(Boolean).join(' → ')
            newAlerts.push({
              containerNumber: ctrNum,
              alertType:       alert.alert_type ?? '',
              alertLevel:      alert.alert_level as 'red' | 'yellow',
              route,
            })
          }

          // Resolve open alerts of different types (stale alerts superseded by current one)
          const { data: staleOpenAlerts } = await supabase
            .from('fesco_alerts')
            .select('id')
            .eq('container_number', ctrNum)
            .eq('status', 'open')
            .neq('alert_type', alert.alert_type)
          if (staleOpenAlerts && staleOpenAlerts.length > 0) {
            await supabase
              .from('fesco_alerts')
              .update({ status: 'resolved', resolved_at: new Date().toISOString() })
              .in('id', staleOpenAlerts.map(a => a.id))
          }
        }
      } else {
        // No active alert condition — resolve any previously open alerts for this container
        const { data: openAlerts } = await supabase
          .from('fesco_alerts')
          .select('id')
          .eq('container_number', ctrNum)
          .eq('status', 'open')

        if (openAlerts && openAlerts.length > 0) {
          await supabase
            .from('fesco_alerts')
            .update({ status: 'resolved', resolved_at: now })
            .eq('container_number', ctrNum)
            .eq('status', 'open')
          alertsResolved += openAlerts.length
        }
      }
    }

    // ── 6. Record errors for containers that failed all fetch attempts ──────────
    if (!dryRun && failedContainers.length > 0) {
      console.log(`[ctr-sync] step 6: recording errors for ${failedContainers.length} failed containers`)
      for (const ctr of failedContainers) {
        const errMsg = (errors.find(e => e.includes(ctr)) ?? 'fetch failed after retries').substring(0, 500)
        const { data: existing } = await supabase
          .from('fesco_container_tracking_current')
          .select('consecutive_errors')
          .eq('container_number', ctr)
          .maybeSingle()
        await supabase
          .from('fesco_container_tracking_current')
          .update({
            last_error_at:      now,
            last_error_message: errMsg,
            consecutive_errors: (existing?.consecutive_errors ?? 0) + 1,
          })
          .eq('container_number', ctr)
      }
    }

    // ── 7. Stale tracking alert check ──────────────────────────────────────────
    if (!dryRun) {
      console.log('[ctr-sync] step 7: checking for stale tracking')

      // 7a. Cleanup: resolve open stale alerts for containers that are now completed
      const { data: openStaleForCleanup } = await supabase
        .from('fesco_alerts')
        .select('id, container_number')
        .in('alert_type', ['stale_tracking_watch', 'stale_tracking_risk'])
        .eq('status', 'open')

      if (openStaleForCleanup && openStaleForCleanup.length > 0) {
        const staleCtrNums = [...new Set(openStaleForCleanup.map(a => a.container_number as string))]
        const { data: completedRows } = await supabase
          .from('fesco_container_tracking_current')
          .select('container_number')
          .in('container_number', staleCtrNums)
          .eq('status', 'completed')

        if (completedRows && completedRows.length > 0) {
          const completedSet = new Set(completedRows.map(r => r.container_number as string))
          const idsToResolve = openStaleForCleanup
            .filter(a => completedSet.has(a.container_number as string))
            .map(a => a.id as number)
          if (idsToResolve.length > 0) {
            await supabase
              .from('fesco_alerts')
              .update({ status: 'resolved', resolved_at: now })
              .in('id', idsToResolve)
            staleAlertsResolved += idsToResolve.length
          }
        }
      }

      // 7b. Check all non-completed rows for staleness
      const { data: trackingRows, error: staleQueryErr } = await supabase
        .from('fesco_container_tracking_current')
        .select('container_number, order_id, external_1c_number, status, last_success_at, last_error_at, last_error_message, consecutive_errors, alert_level')
        .neq('status', 'completed')

      if (staleQueryErr) {
        errors.push('stale check query: ' + staleQueryErr.message)
      } else {
        for (const row of (trackingRows ?? [])) {
          const stale = getStaleAlert({
            status:          row.status          as string | null,
            last_success_at: row.last_success_at as string | null,
          })

          if (stale) {
            const staleHours = row.last_success_at
              ? Math.round((Date.now() - new Date(row.last_success_at as string).getTime()) / 3_600_000)
              : null
            const rawContext = {
              last_success_at:    row.last_success_at,
              last_error_at:      row.last_error_at,
              last_error_message: row.last_error_message,
              consecutive_errors: row.consecutive_errors,
              stale_hours:        staleHours,
            }

            // Deduplicate: find any open stale alert (watch or risk) for this container
            const { data: existingStaleRows } = await supabase
              .from('fesco_alerts')
              .select('id')
              .eq('container_number', row.container_number as string)
              .in('alert_type', ['stale_tracking_watch', 'stale_tracking_risk'])
              .eq('status', 'open')
              .limit(1)
            const existingStale = existingStaleRows?.[0] ?? null

            if (existingStale) {
              await supabase
                .from('fesco_alerts')
                .update({
                  alert_type:   stale.alertType,
                  severity:     stale.severity,
                  message:      stale.message,
                  last_seen_at: now,
                  raw_context:  rawContext,
                })
                .eq('id', existingStale.id)
              staleAlertsUpdated++
            } else {
              await supabase
                .from('fesco_alerts')
                .insert({
                  container_number:   row.container_number,
                  order_id:           row.order_id,
                  external_1c_number: row.external_1c_number,
                  alert_type:         stale.alertType,
                  severity:           stale.severity,
                  message:            stale.message,
                  status:             'open',
                  raw_context:        rawContext,
                  first_seen_at:      now,
                  last_seen_at:       now,
                })
              staleAlertsOpened++

              // 신규 stale alert 수집
              if (!dryRun) {
                newAlerts.push({
                  containerNumber: row.container_number as string,
                  alertType:       stale.alertType,
                  alertLevel:      stale.severity,
                  route:           '',
                })
              }
            }

            // Upgrade alert_level on current row only if stale priority is strictly higher
            if (shouldApplyAlertLevel(row.alert_level as string | null, stale.severity)) {
              await supabase
                .from('fesco_container_tracking_current')
                .update({ alert_level: stale.severity, alert_reason: stale.message })
                .eq('container_number', row.container_number as string)
            }
          } else {
            // Fresh — resolve any open stale alerts for this container
            const { data: openStale } = await supabase
              .from('fesco_alerts')
              .select('id')
              .eq('container_number', row.container_number as string)
              .in('alert_type', ['stale_tracking_watch', 'stale_tracking_risk'])
              .eq('status', 'open')

            if (openStale && openStale.length > 0) {
              await supabase
                .from('fesco_alerts')
                .update({ status: 'resolved', resolved_at: now })
                .in('id', openStale.map(a => a.id as number))
              staleAlertsResolved += openStale.length
            }
          }
        }
      }
      console.log(`[ctr-sync] step 7 OK: stale opened=${staleAlertsOpened} updated=${staleAlertsUpdated} resolved=${staleAlertsResolved}`)
    }

    // ── 8. Digest email — 신규 alert 전체를 메일 1통으로 발송 ────────────────
    if (!dryRun && newAlerts.length > 0) {
      console.log(`[ctr-sync] step 8: sending digest email (${newAlerts.length} new alerts)`)
      await sendDelayDigestEmail(newAlerts).catch(err =>
        console.error('[email] digest failed:', err),
      )
    }

    const result: Record<string, unknown> = {
      ok:                  true,
      mode:                dryRun ? 'dry_run' : 'live',
      ordersScanned,
      containersFound,
      validContainers,
      invalidContainers,
      containersFetched,
      currentRowsUpserted,
      segmentsUpserted,
      alertsOpened,
      alertsUpdated,
      alertsResolved,
      failedContainersCount,
      staleAlertsOpened,
      staleAlertsUpdated,
      staleAlertsResolved,
      errors,
    }
    if (dryRun && sampleNormalized.length > 0) result.sampleNormalized = sampleNormalized

    return res.json(result)

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[ctr-sync] fatal:', msg)
    return res.status(500).json({ ok: false, error: msg, errors })
  }
}
