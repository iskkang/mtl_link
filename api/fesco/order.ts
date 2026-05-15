import ws from 'ws'
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

  const rawId = req.query.id
  if (!rawId || rawId === '') {
    return res.status(400).json({ ok: false, error: 'Missing required parameter: id' })
  }

  const id = parseInt(String(rawId), 10)
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'Invalid id: must be a positive integer' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })

  const { data, error } = await supabase
    .from('fesco_orders')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    // PGRST116 = no rows returned
    if (error.code === 'PGRST116') {
      return res.status(404).json({ ok: false, error: 'Order not found' })
    }
    console.error('[fesco/order] Supabase error:', error.message)
    return res.status(500).json({ ok: false, error: error.message })
  }

  return res.status(200).json({ ok: true, data })
}
