import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })

import type { VercelRequest, VercelResponse } from '@vercel/node'

const CRON_SCHEDULE = '0 */3 * * *'
const SYNC_LIMIT    = 143

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return res.status(500).json({ ok: false, error: 'CRON_SECRET is not configured' })
  }

  const authHeader = (req.headers['authorization'] ?? '').toString()
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }

  // VERCEL_PROJECT_PRODUCTION_URL = canonical production URL (no https:// prefix).
  // VERCEL_URL = deployment-specific URL which may be behind Vercel deployment protection.
  // Use production URL first to avoid the Vercel auth wall on deployment URLs.
  const rawUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL
  const baseUrl = rawUrl ? `https://${rawUrl}` : 'http://localhost:3000'

  const syncUrl = `${baseUrl}/api/fesco/container-tracking-sync?limit=${SYNC_LIMIT}`

  try {
    const syncRes = await fetch(syncUrl, {
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    })

    if (!syncRes.ok) {
      const body = await syncRes.text()
      return res.status(syncRes.status).json({
        ok:     false,
        source: 'vercel-cron',
        error:  `sync responded ${syncRes.status}: ${body.substring(0, 200)}`,
      })
    }

    const result = await syncRes.json()
    return res.json({
      ok:       true,
      source:   'vercel-cron',
      schedule: CRON_SCHEDULE,
      result,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ ok: false, source: 'vercel-cron', error: msg })
  }
}
