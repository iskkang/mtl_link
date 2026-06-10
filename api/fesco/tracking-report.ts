import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { sendDelayDigestEmail, type DigestAlert } from '../_lib/resend.js'

// Daily FESCO tracking report — called once per day at 19:00 KST via GitHub Actions.
// Reads all currently open alerts from fesco_alerts and sends a consolidated digest.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = (req.headers.authorization ?? '').toString()
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  // Fetch all open alerts (red + yellow)
  const { data: alertRows, error: alertErr } = await supabase
    .from('fesco_alerts')
    .select('container_number, alert_type, severity')
    .eq('status', 'open')
    .in('severity', ['red', 'yellow'])

  if (alertErr) {
    return res.status(500).json({ ok: false, error: alertErr.message })
  }

  const containers = (alertRows ?? []).map(a => a.container_number as string)

  // Fetch routes for each alerted container from tracking_current
  const routeMap = new Map<string, string>()
  if (containers.length > 0) {
    const { data: trackingRows } = await supabase
      .from('fesco_container_tracking_current')
      .select('container_number, current_from, current_to')
      .in('container_number', containers)

    for (const r of trackingRows ?? []) {
      const route = [r.current_from, r.current_to].filter(Boolean).join(' → ')
      routeMap.set(r.container_number as string, route)
    }
  }

  const alerts: DigestAlert[] = (alertRows ?? []).map(a => ({
    containerNumber: a.container_number as string,
    alertType:       a.alert_type as string,
    alertLevel:      a.severity as 'red' | 'yellow',
    route:           routeMap.get(a.container_number as string) ?? '',
  }))

  if (alerts.length === 0) {
    return res.json({ ok: true, total: 0, emailSent: false })
  }

  await sendDelayDigestEmail(alerts)

  return res.json({
    ok:        true,
    total:     alerts.length,
    red:       alerts.filter(a => a.alertLevel === 'red').length,
    yellow:    alerts.filter(a => a.alertLevel === 'yellow').length,
    emailSent: true,
  })
}
