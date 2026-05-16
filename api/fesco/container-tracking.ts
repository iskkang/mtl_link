import ws from 'ws'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).WebSocket = ws

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Supabase env not set' })
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  // Mode 1: alert-level counts per order_id (for booking card chips)
  if (req.query.summary === '1') {
    const raw = String(req.query.order_ids ?? '')
    const ids = raw
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0)
      .slice(0, 200)

    if (ids.length === 0) return res.json({ ok: true, summary: {} })

    const { data, error } = await supabase
      .from('fesco_container_tracking_current')
      .select('order_id, alert_level')
      .in('order_id', ids)

    if (error) return res.status(500).json({ ok: false, error: error.message })

    const summary: Record<number, { red: number; yellow: number; green: number; gray: number; total: number }> = {}
    for (const row of (data ?? []) as { order_id: number; alert_level: string | null }[]) {
      const oid = row.order_id
      if (!summary[oid]) summary[oid] = { red: 0, yellow: 0, green: 0, gray: 0, total: 0 }
      const lvl = row.alert_level ?? 'gray'
      if (lvl === 'red' || lvl === 'yellow' || lvl === 'green' || lvl === 'gray') summary[oid][lvl]++
      summary[oid].total++
    }

    return res.json({ ok: true, summary })
  }

  // Mode 2: full tracking rows + open alerts for one order
  const orderId = parseInt(String(req.query.order_id ?? ''), 10)
  if (isNaN(orderId) || orderId <= 0) {
    return res.status(400).json({ ok: false, error: 'order_id is required' })
  }

  const [trackingResult, alertsResult] = await Promise.all([
    supabase
      .from('fesco_container_tracking_current')
      .select(
        'container_number, status, alert_level, alert_reason, ' +
        'current_segment_type, current_from, current_to, ' +
        'departure_date, planned_departure_date, destination_date, planned_destination_date, ' +
        'transport_name, voyage_number, last_checked_at',
      )
      .eq('order_id', orderId)
      .order('container_number'),
    supabase
      .from('fesco_alerts')
      .select('id, container_number, alert_type, severity, message, first_seen_at, last_seen_at')
      .eq('order_id', orderId)
      .eq('status', 'open')
      .order('last_seen_at', { ascending: false }),
  ])

  if (trackingResult.error) return res.status(500).json({ ok: false, error: trackingResult.error.message })
  if (alertsResult.error)   return res.status(500).json({ ok: false, error: alertsResult.error.message })

  return res.json({
    ok:       true,
    tracking: trackingResult.data ?? [],
    alerts:   alertsResult.data   ?? [],
  })
}
