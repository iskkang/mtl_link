import ws from 'ws'
;(globalThis as any).WebSocket = ws

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Safety policy:
// - Use only MTL's own MY.FESCO account credentials.
// - Do not parallelize FESCO API requests.
// - Keep cron frequency conservative (every 4 hours).
// - Do not bypass CAPTCHA or any FESCO access controls.
// - If FESCO provides official API credentials later, replace this integration.

interface FescoOrder {
  id:                   number
  external_1c_number:   string
  external_1c_status:   string | null
  status:               string
  type:                 string
  req_type:             number
  clientName:           string
  email:                string
  manager:              string
  manager_email:        string
  route_latin:          string
  containers:           string[]
  bills:                string[]
  tracking:             unknown[]
  segments:             unknown[]
  created:              string
}

interface FescoOrdersResponse {
  status: string
  data: {
    meta: { total: number; offset: number; limit: number }
    data:  FescoOrder[]
  }
}

// CRON_SECRET guard is enforced in production only.
// Local dev (vercel dev, no VERCEL_ENV=production) bypasses the check.
console.log('[sync] module loaded')

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[sync] handler entered')
  try {
    return await syncHandler(req, res)
  } catch (topErr) {
    const msg = topErr instanceof Error ? topErr.message : String(topErr)
    console.error('[sync] UNCAUGHT top-level error:', msg)
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, error: 'uncaught: ' + msg })
    }
  }
}

async function syncHandler(req: VercelRequest, res: VercelResponse) {
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

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase env not set' })
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })

  // Atomic lock: evicts stale locks (> 15 min old) then atomically claims
  // the unique active slot via a DB-level unique partial index (unique_violation
  // on a second concurrent INSERT is caught inside the Postgres function).
  const { data: lockRows, error: lockError } = await supabase.rpc('fesco_sync_try_lock')
  if (lockError) {
    console.error('[sync] lock RPC error:', lockError.message)
    return res.status(500).json({ ok: false, error: 'Failed to acquire sync lock: ' + lockError.message })
  }
  const lockResult = Array.isArray(lockRows) ? lockRows[0] : lockRows
  if (!lockResult?.ok) {
    return res.status(409).json({ ok: false, error: 'sync already running' })
  }
  const logId: number | undefined = lockResult.lock_id ?? undefined

  const startedAt  = Date.now()
  let fetchedCount = 0
  let updated      = 0
  let failed       = 0
  let total        = 0

  // undici is in node_modules — always present in the Lambda bundle.
  const undici = await import('undici').catch((err: unknown) => {
    console.error('[sync] undici import FAILED:', err instanceof Error ? err.message : String(err))
    return null
  })
  if (!undici) return res.status(500).json({ ok: false, error: 'undici unavailable' })
  const { fetch: undiciFetch, Agent } = undici

  const fescoHttpAgent = new Agent({
    connectTimeout: 45000,
    headersTimeout: 120000,
    bodyTimeout:    120000,
  })

  // loginFesco is inlined here because @vercel/node only compiles route files
  // (files with a default export). auth.ts has no default export so it is never
  // compiled and auth.js is absent from the Lambda bundle at runtime.
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
    let loginRes: any
    try {
      loginRes = await undiciFetch('https://my.fesco.com/api/v2/lk/user/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept':       'application/json',
          'X-Lk-Lang':   'en',
        },
        body: JSON.stringify(loginBody),
        dispatcher: fescoHttpAgent,
      })
    } catch (err: any) {
      console.error('[fesco-auth] login failed:', { message: err?.message, causeName: err?.cause?.name, causeCode: err?.cause?.code })
      throw new Error(`login: ${err?.message || 'unknown error'}`)
    }
    const responseText = await loginRes.text()
    if (!loginRes.ok) throw new Error(`FESCO login failed: ${loginRes.status}: ${responseText.substring(0, 200)}`)
    let parsed: any
    try { parsed = JSON.parse(responseText) } catch { throw new Error('FESCO login response is not JSON: ' + responseText.substring(0, 100)) }
    const token = parsed?.data?.token
    if (!token) throw new Error('FESCO login: no token field. Got: ' + responseText.substring(0, 200))
    console.log('[auth] login successful, token length:', token.length)
    return token
  }

  try {
    // 1. Login
    console.log('[sync] step 1: logging in to FESCO')
    let token: string
    try {
      token = await loginFesco()
      console.log('[sync] step 1 OK: token received, length=', token.length)
    } catch (e) {
      console.error('[sync] step 1 FAILED (login):', e instanceof Error ? e.message : e)
      throw new Error('login: ' + (e instanceof Error ? e.message : String(e)))
    }

    // 2. Paginate all orders — sequential, no parallelism, 1 s delay between pages
    console.log('[sync] step 2: fetching orders')
    const allOrders: FescoOrder[] = []
    const pageSize = 10
    let offset = 0

    while (true) {
      const url = `https://my.fesco.com/api/v1/orders?offset=${offset}&rows=${pageSize}`
      let r: any
      try {
        r = await undiciFetch(url, {
          method:  'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Lk-Lang':    'en',
            'User-Agent':   'MTL-Link-FESCO-Sync/1.0 (+internal operations dashboard)',
          },
          dispatcher: fescoHttpAgent,
        })
      } catch (e: any) {
        // Temporary diagnostic — logs error type and cause only, no token or secrets.
        const urlObj = new URL(url)
        console.error('[sync] step 2 network error:', {
          page:         offset / 10,
          urlPath:      urlObj.pathname + urlObj.search,
          errorName:    e?.name,
          message:      e?.message,
          causeName:    e?.cause?.name,
          causeCode:    e?.cause?.code,
          causeMessage: e?.cause?.message,
        })
        throw new Error('orders fetch: ' + (e?.message || 'unknown error'))
      }
      try {
        if (!r.ok) {
          throw new Error(`FESCO orders fetch failed at offset=${offset}: ${r.status}`)
        }
        const json = await r.json() as FescoOrdersResponse
        total = json.data.meta.total
        const batch = json.data.data
        allOrders.push(...batch)
        console.log(`[sync] fetched ${batch.length} orders at offset=${offset}, total so far=${allOrders.length}/${total}`)
        if (allOrders.length >= total || batch.length === 0) break
        offset += pageSize
        // Conservative delay between pages — do not flood the FESCO server.
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (e) {
        console.error('[sync] step 2 FAILED at offset=' + offset + ':', e instanceof Error ? e.message : e)
        throw new Error('orders fetch: ' + (e instanceof Error ? e.message : String(e)))
      }
    }
    fetchedCount = allOrders.length
    console.log('[sync] step 2 OK: fetched', fetchedCount, 'of', total)

    // 3. Upsert in chunks
    const now  = new Date().toISOString()
    const rows = allOrders.map(o => ({
      id:                  o.id,
      external_1c_number:  o.external_1c_number ?? null,
      status:              o.status,
      external_1c_status:  o.external_1c_status,
      type:                o.type,
      req_type:            o.req_type,
      client_name:         o.clientName,
      email:               o.email,
      manager:             o.manager,
      manager_email:       o.manager_email,
      route_latin:         o.route_latin,
      containers:          o.containers ?? [],
      bills:               o.bills ?? [],
      tracking:            o.tracking,
      segments:            o.segments,
      source:              'fesco_lk_v1',
      fesco_created_at:    o.created,
      last_synced_at:      now,
    }))

    const chunkSize = 50
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      const { error } = await supabase
        .from('fesco_orders')
        .upsert(chunk, { onConflict: 'id' })
      if (error) {
        failed += chunk.length
        throw new Error(`Upsert chunk failed at index=${i}: ${error.message}`)
      }
      updated += chunk.length
    }

    // 4. Mark sync complete
    const durationMs = Date.now() - startedAt
    if (logId) {
      await supabase.from('fesco_sync_log').update({
        finished_at:    new Date().toISOString(),
        fetched_count:  fetchedCount,
        inserted_count: 0,
        updated_count:  updated,
        failed_count:   failed,
        duration_ms:    durationMs,
      }).eq('id', logId)
    }

    return res.status(200).json({ ok: true, fetched: fetchedCount, total, updated, durationMs })

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    const durationMs   = Date.now() - startedAt
    if (logId) {
      await supabase.from('fesco_sync_log').update({
        finished_at:    new Date().toISOString(),
        fetched_count:  fetchedCount,
        inserted_count: 0,
        updated_count:  updated,
        failed_count:   failed,
        error_message:  errorMessage,
        duration_ms:    durationMs,
      }).eq('id', logId).then(() => null)
    }
    return res.status(500).json({ ok: false, error: errorMessage })
  }
}
