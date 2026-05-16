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

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

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
