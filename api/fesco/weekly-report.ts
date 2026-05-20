import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { sendWeeklyReport } from '../_lib/resend.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization ?? ''
  if (auth.replace('Bearer ', '') !== process.env.CRON_SECRET)
    return res.status(401).json({ ok: false, error: 'unauthorized' })

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data: containers } = await supabase
    .from('fesco_container_tracking_current')
    .select(
      'container_number, signal, current_from, current_to, ' +
      'last_event_location, open_alert_types, last_event_date, ' +
      'planned_destination_date, last_error_at',
    )
    .neq('status', 'completed')
    .neq('manually_excluded', true)

  const { data: alertRows } = await supabase
    .from('fesco_alerts')
    .select('container_number, first_seen_at')
    .eq('status', 'open')
    .eq('alert_type', 'container_tracking_unknown')

  const unknownSinceMap = new Map(
    (alertRows ?? []).map((a: { container_number: string; first_seen_at: string | null }) => [
      a.container_number,
      a.first_seen_at,
    ]),
  )

  const all     = (containers ?? []) as any[]
  const red     = all.filter(c => c.signal === 'red')
  const yellow  = all.filter(c => c.signal === 'yellow')
  const unknown = all
    .filter(c => c.signal === 'unknown')
    .map(c => ({ ...c, unknown_since: unknownSinceMap.get(c.container_number) ?? null }))

  const withDays = (rows: any[]) => rows.map(c => {
    const isAwaiting = (c.open_alert_types ?? []).some((t: string) => t.startsWith('awaiting_next_leg'))
    const ref  = isAwaiting ? c.last_event_date : (c.planned_destination_date ?? c.last_error_at)
    const days = ref ? Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000) : 0
    return { ...c, days_overdue: days > 0 ? days : null }
  })

  const now  = new Date()
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const dateStr = `${now.getMonth() + 1}월 ${now.getDate()}일(${days[now.getDay()]})`

  await sendWeeklyReport({
    date:    dateStr,
    total:   all.length,
    red:     withDays(red),
    yellow:  withDays(yellow),
    unknown,
  })

  return res.json({
    ok:      true,
    total:   all.length,
    red:     red.length,
    yellow:  yellow.length,
    unknown: unknown.length,
  })
}
