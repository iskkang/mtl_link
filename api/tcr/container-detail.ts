import ws from 'ws'
;(globalThis as any).WebSocket = ws

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  const containerNo = String(req.query.container_no ?? '').trim().toUpperCase()
  if (!containerNo) return res.status(400).json({ ok: false, error: 'Missing ?container_no=' })

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Supabase env not set' })
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  const [ctrRes, segRes, itemRes, alertRes] = await Promise.all([
    supabase
      .from('tcr_containers_current')
      .select('*')
      .eq('container_no', containerNo)
      .single(),
    supabase
      .from('tcr_route_segments')
      .select('*')
      .eq('container_no', containerNo)
      .order('segment_no'),
    supabase
      .from('tcr_shipment_items')
      .select('*')
      .eq('container_no', containerNo),
    supabase
      .from('tcr_risk_alerts')
      .select('*')
      .eq('container_no', containerNo),
  ])

  if (ctrRes.error || !ctrRes.data) {
    return res.status(404).json({ ok: false, error: 'Container not found' })
  }

  return res.json({
    ok:        true,
    container: ctrRes.data,
    segments:  segRes.data  ?? [],
    items:     itemRes.data ?? [],
    alerts:    alertRes.data ?? [],
  })
}
