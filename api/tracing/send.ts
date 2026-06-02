import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { PROFILES, buildSubject } from '../../src/lib/tracing/report-profiles.js'
import { loadRows } from '../../src/lib/tracing/loaders.js'
import { rowHash } from '../../src/lib/tracing/diff.js'
import { renderEmail } from '../../src/lib/tracing/render.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const FROM_EMAIL     = 'MTL Link <noreply@mtlb.co.kr>'

async function sendEmail(to: string[], subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('[tracing-send] RESEND_API_KEY not set — skipping email')
    return
  }
  await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
}

async function logRun(
  supabase:   ReturnType<typeof createClient>,
  reportKey:  string,
  opts: {
    changed:     boolean
    sent:        boolean
    rowCount:    number
    changedRows: number
    stalledRows: number
    error?:      string
  },
): Promise<void> {
  await supabase.from('tracing_report_runs').insert({
    report_key:   reportKey,
    changed:      opts.changed,
    sent:         opts.sent,
    row_count:    opts.rowCount,
    changed_rows: opts.changedRows,
    stalled_rows: opts.stalledRows,
    error:        opts.error ?? null,
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth — same pattern as TCR delay-notify
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

  // Optional: ?report=kr-uz to run a single report
  const reportFilter = String(req.query.report ?? '').trim()
  const profiles = reportFilter
    ? PROFILES.filter(p => p.reportKey === reportFilter)
    : PROFILES

  if (profiles.length === 0) {
    return res.status(400).json({ ok: false, error: `Unknown report: ${reportFilter}` })
  }

  const results: object[] = []

  for (const profile of profiles) {
    let rowCount    = 0
    let changedRows = 0
    let stalledRows = 0
    let changed     = false
    let sent        = false

    try {
      // 1. Load rows from DB (in-transit only)
      const rows = await loadRows(profile, supabase)
      rowCount    = rows.length
      stalledRows = rows.filter(r => r.stalled).length

      if (rows.length === 0) {
        await logRun(supabase, profile.reportKey, { changed: false, sent: false, rowCount: 0, changedRows: 0, stalledRows: 0 })
        results.push({ report: profile.reportKey, sent: false, reason: 'no_rows' })
        continue
      }

      // 2. Load previous state
      type StateRow = { row_key: string; row_hash: string }
      const { data: prevState } = await supabase
        .from('tracing_report_state')
        .select('row_key, row_hash')
        .eq('report_key', profile.reportKey)

      const prevMap = new Map<string, string>()
      for (const s of (prevState ?? []) as StateRow[]) {
        prevMap.set(s.row_key, s.row_hash)
      }

      // 3. Diff
      const currentKeys = new Set(rows.map(r => r.rowKey))

      for (const r of rows) {
        const hash = rowHash(r)
        if (!prevMap.has(r.rowKey) || prevMap.get(r.rowKey) !== hash) {
          changedRows++
          changed = true
        }
      }
      for (const k of prevMap.keys()) {
        if (!currentKeys.has(k)) {
          changedRows++
          changed = true
        }
      }

      if (!changed) {
        await logRun(supabase, profile.reportKey, { changed: false, sent: false, rowCount, changedRows: 0, stalledRows })
        results.push({ report: profile.reportKey, sent: false, reason: 'no_change', rowCount })
        continue
      }

      // 4. Render and send
      const html    = renderEmail(profile, rows)
      const subject = buildSubject(profile)
      await sendEmail(profile.to, subject, html)
      sent = true

      // 5. Upsert new state, clean up removed rows
      const removedKeys = [...prevMap.keys()].filter(k => !currentKeys.has(k))
      if (removedKeys.length > 0) {
        await supabase
          .from('tracing_report_state')
          .delete()
          .eq('report_key', profile.reportKey)
          .in('row_key', removedKeys)
      }

      const stateRows = rows.map(r => ({
        report_key: profile.reportKey,
        row_key:    r.rowKey,
        row_hash:   rowHash(r),
        raw:        { display: r.display, currentLocation: r.currentLocation, stalled: r.stalled },
        updated_at: new Date().toISOString(),
      }))
      await supabase
        .from('tracing_report_state')
        .upsert(stateRows, { onConflict: 'report_key,row_key' })

      await logRun(supabase, profile.reportKey, { changed, sent, rowCount, changedRows, stalledRows })
      results.push({ report: profile.reportKey, sent: true, rowCount, changedRows, stalledRows })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[tracing-send] ${profile.reportKey} failed:`, err)
      await logRun(supabase, profile.reportKey, {
        changed, sent, rowCount, changedRows, stalledRows, error: errMsg,
      }).catch(() => null)
      results.push({ report: profile.reportKey, sent: false, error: errMsg })
    }
  }

  return res.json({ ok: true, results })
}
