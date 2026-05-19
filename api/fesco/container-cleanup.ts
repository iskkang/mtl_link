import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { action, container_number } = req.body as {
    action: 'delete' | 'dismiss'
    container_number: string
  }
  if (!container_number || !action)
    return res.status(400).json({ ok: false, error: 'action + container_number required' })

  if (action === 'dismiss') {
    const until = new Date(Date.now() + 30 * 86_400_000).toISOString()
    await supabase
      .from('fesco_container_tracking_current')
      .update({ cleanup_dismissed_until: until })
      .eq('container_number', container_number)
    return res.json({ ok: true })
  }

  if (action === 'delete') {
    const { data: row } = await supabase
      .from('fesco_container_tracking_current')
      .select('order_id')
      .eq('container_number', container_number)
      .maybeSingle()

    if (row?.order_id) {
      const { data: order } = await supabase
        .from('fesco_orders')
        .select('containers')
        .eq('id', row.order_id)
        .maybeSingle()
      if (order?.containers) {
        const updated = (order.containers as string[]).filter(c => c !== container_number)
        await supabase.from('fesco_orders').update({ containers: updated }).eq('id', row.order_id)
      }
    }
    await supabase.from('fesco_alerts').delete().eq('container_number', container_number)
    await supabase.from('fesco_container_tracking_current').delete().eq('container_number', container_number)
    return res.json({ ok: true })
  }

  return res.status(400).json({ ok: false, error: 'Unknown action' })
}
