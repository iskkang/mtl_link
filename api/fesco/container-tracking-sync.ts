import ws from 'ws'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).WebSocket = ws

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { fetch as undiciFetch, Agent } from 'undici'
import { loginFesco } from './auth'

// Safety policy: same conservative constraints as order sync.
// Sequential fetching only. No parallelism. No mass container sweep by default.
const fescoHttpAgent = new Agent({
  connectTimeout: 45000,
  headersTimeout: 120000,
  bodyTimeout:    120000,
})

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

interface FescoTrackingItem {
  containerNumber?: string
  unavailable?:     boolean
  type?:            string
  order?: {
    ownerShip?: string
    bills?:     string[]
  }
  segments?: FescoTrackingSegment[]
}

interface FescoTrackingResponse {
  data?: FescoTrackingItem[]
}

interface FetchedContainer {
  ctrNum:  string
  orderId: number
  extNum:  string | null
  item:    FescoTrackingItem
}

interface AlertResult {
  alert_level: 'green' | 'yellow' | 'red' | 'gray'
  alert_type:  string | null
  message:     string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deriveStatus(item: FescoTrackingItem): string {
  if (item.unavailable === true) return 'unavailable'
  const segs = item.segments ?? []
  if (segs.length === 0) return 'unknown'
  const last = segs[segs.length - 1]
  // Completed only when the final segment has an actual arrival date.
  // FESCO can set completed:true on segments that are still inProgress — do NOT rely on it.
  if (last?.destinationDate) return 'completed'
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
    return { alert_level: 'green', alert_type: null, message: null }
  }

  const now = Date.now()

  // Planned arrival overdue (check destination first — higher impact)
  for (const s of (item.segments ?? [])) {
    if (s.planingDestinationDate && !s.destinationDate) {
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
    if (s.planingDepartureDate && !s.departureDate) {
      const t = new Date(s.planingDepartureDate).getTime()
      if (!isNaN(t)) {
        const overdueDays = Math.floor((now - t) / 86_400_000)
        if (overdueDays > 3) return { alert_level: 'red',    alert_type: 'planned_departure_overdue', message: 'Planned departure date passed by more than 3 days.' }
        if (overdueDays > 1) return { alert_level: 'yellow', alert_type: 'planned_departure_watch',   message: 'Planned departure date has passed.'                }
      }
    }
  }

  return { alert_level: 'green', alert_type: null, message: null }
}

const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

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

  const dryRun   = req.query.dryRun === '1' || req.query.dryRun === 'true'
  const rawLimit = parseInt(String(req.query.limit ?? String(DEFAULT_LIMIT)), 10)
  const limit    = Math.min(isNaN(rawLimit) ? DEFAULT_LIMIT : Math.max(1, rawLimit), MAX_LIMIT)

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Supabase env not set' })
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

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
  const sampleNormalized: unknown[] = []

  try {

    // ── 1. Query ACTIVE orders with containers ──────────────────────────────
    console.log('[ctr-sync] step 1: querying active orders')
    const { data: rawOrders, error: ordersError } = await supabase
      .from('fesco_orders')
      .select('id, external_1c_number, containers')
      .eq('status', 'ACTIVE')

    if (ordersError) {
      return res.status(500).json({ ok: false, error: 'Query failed: ' + ordersError.message })
    }

    const orders = ((rawOrders ?? []) as ActiveOrder[]).filter(
      o => Array.isArray(o.containers) && (o.containers?.length ?? 0) > 0,
    )
    ordersScanned = orders.length
    console.log(`[ctr-sync] step 1 OK: ${ordersScanned} active orders with containers`)

    // ── 2. Extract, deduplicate, validate ───────────────────────────────────
    const containerToOrder = new Map<string, { orderId: number; extNum: string | null }>()
    for (const order of orders) {
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
          containerToOrder.set(ctr, { orderId: order.id, extNum: order.external_1c_number })
        }
      }
    }

    const allValid = [...containerToOrder.keys()]
    const toLookup = allValid.slice(0, limit)
    console.log(
      `[ctr-sync] step 2 OK: ${validContainers} valid (${containerToOrder.size} unique), ` +
      `${invalidContainers} invalid, fetching ${toLookup.length} (limit=${limit})`,
    )

    if (toLookup.length === 0) {
      return res.json({
        ok: true, mode: dryRun ? 'dry_run' : 'live',
        ordersScanned, containersFound, validContainers, invalidContainers,
        containersFetched: 0, currentRowsUpserted: 0, segmentsUpserted: 0,
        alertsOpened: 0, alertsUpdated: 0, alertsResolved: 0,
        failedContainersCount: 0, errors,
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
        const orderInfo = containerToOrder.get(ctrNum) ?? { orderId: 0, extNum: null }
        fetched.push({ ctrNum, orderId: orderInfo.orderId, extNum: orderInfo.extNum, item })
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

    for (const { ctrNum, orderId, extNum, item } of fetched) {
      const segs   = item.segments ?? []
      const status = deriveStatus(item)
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
