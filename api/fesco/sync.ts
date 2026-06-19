import ws from 'ws'
;(globalThis as any).WebSocket = ws

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })

import tls from 'node:tls'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// FESCO's TLS chain is misconfigured: since their 2026-06-18 cert renewal, my.fesco.com
// serves a leaf signed by Let's Encrypt "YE2" but does NOT include the YE2 intermediate
// in the handshake (it sends unrelated intermediates instead). Browsers recover via AIA
// fetching; Node/undici does not, so login fails with UNABLE_TO_VERIFY_LEAF_SIGNATURE.
// We supply the missing YE2 intermediate (http://ye2.i.lencr.org/) as an extra trust
// anchor so Node can complete the chain. Remove once FESCO fixes their server chain.
const FESCO_YE2_INTERMEDIATE_CA = `-----BEGIN CERTIFICATE-----
MIICjDCCAhGgAwIBAgIQTfOxXdbAeExQfNN7WObxFTAKBggqhkjOPQQDAzAuMQsw
CQYDVQQGEwJVUzENMAsGA1UEChMESVNSRzEQMA4GA1UEAxMHUm9vdCBZRTAeFw0y
NTA5MDMwMDAwMDBaFw0yODA5MDIyMzU5NTlaMDMxCzAJBgNVBAYTAlVTMRYwFAYD
VQQKEw1MZXQncyBFbmNyeXB0MQwwCgYDVQQDEwNZRTIwdjAQBgcqhkjOPQIBBgUr
gQQAIgNiAARxmrQzkdbEEL3MqXt3dJQttYc47axkdDTHud5TPqM2z5uSD5cmk0Wr
HlWXvnlvqBLqiB34kluxIbmMyAiq3/YD6e80/vV259K8XQIdjFXloYOa0mIU71f7
HQ09PvYDlw+jge4wgeswDgYDVR0PAQH/BAQDAgGGMBMGA1UdJQQMMAoGCCsGAQUF
BwMBMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0OBBYEFLlZ8o7PIvCG0zdI/3YU
GLqC2FWHMB8GA1UdIwQYMBaAFKPIJlqOoUzQNWP8myPIOq5W809WMDIGCCsGAQUF
BwEBBCYwJDAiBggrBgEFBQcwAoYWaHR0cDovL3llLmkubGVuY3Iub3JnLzATBgNV
HSAEDDAKMAgGBmeBDAECATAnBgNVHR8EIDAeMBygGqAYhhZodHRwOi8veWUuYy5s
ZW5jci5vcmcvMAoGCCqGSM49BAMDA2kAMGYCMQDIcnw5dcZLN9ffynXnnkLD/itS
JEycJPb3sRkzeqBowup7vOsAwaqoCnNn/jh9wycCMQCJM6CPlaOC4pQYYbJtVPYb
DKrIb2EKk5NpOpE6/XttQYZV/3gilB9l+Cc/DOVwmyg=
-----END CERTIFICATE-----`

// YE2 is issued by ISRG "Root YE", which FESCO also omits from the handshake. Root YE
// chains to the long-trusted ISRG Root X2 (present in Node's default store), so we only
// need to supply the two missing intermediates — not a root.
const FESCO_ROOT_YE_CA = `-----BEGIN CERTIFICATE-----
MIICpjCCAiugAwIBAgIRAIchZfw0tuX7qK3Vs3BftTowCgYIKoZIzj0EAwMwTzEL
MAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2VhcmNo
IEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDIwHhcNMjYwNTEzMDAwMDAwWhcN
MzIwOTAyMjM1OTU5WjAuMQswCQYDVQQGEwJVUzENMAsGA1UEChMESVNSRzEQMA4G
A1UEAxMHUm9vdCBZRTB2MBAGByqGSM49AgEGBSuBBAAiA2IABDwS/6vhrcVqcbBo
+wgdI3fwn9x7DNJJOY/lTOti0vkwuRN87RhEhTH17E7XyFjWsPYhIPt/wzOqxTd2
b+4ZJNy9ID04YywF9U5zasDVyGSNErVNtz8uSGh5izW87j77GaOB6zCB6DAOBgNV
HQ8BAf8EBAMCAQYwEwYDVR0lBAwwCgYIKwYBBQUHAwEwDwYDVR0TAQH/BAUwAwEB
/zAdBgNVHQ4EFgQUo8gmWo6hTNA1Y/ybI8g6rlbzT1YwHwYDVR0jBBgwFoAUfEKW
rt5LSDv6kviejM9ti6lyN5UwMgYIKwYBBQUHAQEEJjAkMCIGCCsGAQUFBzAChhZo
dHRwOi8veDIuaS5sZW5jci5vcmcvMBMGA1UdIAQMMAowCAYGZ4EMAQIBMCcGA1Ud
HwQgMB4wHKAaoBiGFmh0dHA6Ly94Mi5jLmxlbmNyLm9yZy8wCgYIKoZIzj0EAwMD
aQAwZgIxAMU19WCtmxVND8UHBZRoma49Z7jPs64Dma0eTu1OChVbB/2J7GV3nvYK
Ax54uk1G9QIxAO0miLVJu8PLNiXXXkiE/gsK3CTRTF/aeo4bMX42Zw40csRU6AC2
6hSW1/IWaas6dg==
-----END CERTIFICATE-----`

// Default Node roots + the two missing FESCO intermediates, used as the TLS trust store
// for the FESCO Agent only. Keeping the defaults preserves normal verification.
const FESCO_CA_BUNDLE = [...tls.rootCertificates, FESCO_YE2_INTERMEDIATE_CA, FESCO_ROOT_YE_CA]

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
    // Supply FESCO's missing Let's Encrypt YE2 intermediate so Node can verify the leaf.
    connect: { ca: FESCO_CA_BUNDLE },
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

  try {
    // 1. Login
    console.log('[sync] step 1: logging in to FESCO')
    let token: string
    try {
      token = await loginFesco()
      console.log('[sync] step 1 OK: token received, length=', token.length)
    } catch (e) {
      console.error('[sync] step 1 FAILED (login):', e instanceof Error ? e.message : e)
      throw e
    }

    // 2. Paginate orders — sequential, no parallelism, 1 s delay between pages.
    // startOffset/limit query params enable batch splitting across multiple calls
    // to stay under Cloudflare's 100s proxy timeout (same pattern as container-tracking-sync).
    const batchStartOffset = Math.max(0, parseInt((req.query.startOffset as string) ?? '0') || 0)
    const batchLimit = req.query.limit ? Math.max(1, parseInt(req.query.limit as string)) : null
    console.log('[sync] step 2: fetching orders', { batchStartOffset, batchLimit })
    const allOrders: FescoOrder[] = []
    const pageSize = 10
    let offset = batchStartOffset

    while (true) {
      const url = `https://my.fesco.com/api/v1/orders?offset=${offset}&rows=${pageSize}`
      const r: any = await fetchWithRetry(
        url,
        {
          method:  'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Lk-Lang':    'en',
            'User-Agent':   'MTL-Link-FESCO-Sync/1.0 (+internal operations dashboard)',
          },
          dispatcher: fescoHttpAgent,
        },
        'orders fetch',
      )
      try {
        if (!r.ok) {
          throw new Error(`FESCO orders fetch failed at offset=${offset}: ${r.status}`)
        }
        const json = await r.json() as FescoOrdersResponse
        total = json.data.meta.total
        const batch = json.data.data
        allOrders.push(...batch)
        console.log(`[sync] fetched ${batch.length} orders at offset=${offset}, total so far=${allOrders.length}/${total}`)
        const fetchedUpTo = offset + batch.length
        const reachedEnd = batch.length === 0 || fetchedUpTo >= total
        const reachedBatchLimit = batchLimit !== null && allOrders.length >= batchLimit
        if (reachedEnd || reachedBatchLimit) break
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
