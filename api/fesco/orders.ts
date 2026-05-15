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

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })

  const limit  = Math.min(Math.max(parseInt(String(req.query.limit  ?? '50'), 10) || 50, 1), 100)
  const offset = Math.max(parseInt(String(req.query.offset ?? '0'),  10) || 0, 0)
  const q      = req.query.q      ? String(req.query.q).trim()      : null
  const status = req.query.status ? String(req.query.status).trim() : null
  const region = req.query.region ? String(req.query.region).trim() : null

  // Select only the columns needed for the list view — omit tracking/segments (large, unused here)
  let query = supabase
    .from('fesco_orders')
    .select(
      'id, external_1c_number, status, external_1c_status, type, req_type, ' +
      'client_name, email, manager, manager_email, route_latin, ' +
      'containers, bills, fesco_created_at, last_synced_at',
      { count: 'exact' },
    )
    .order('last_synced_at',   { ascending: false })
    .order('fesco_created_at', { ascending: false })
    .order('id',               { ascending: false })

  if (status) query = query.eq('status', status)
  if (region) query = query.eq('region', region)
  if (q) {
    query = query.or(
      `external_1c_number.ilike.%${q}%,` +
      `route_latin.ilike.%${q}%,` +
      `client_name.ilike.%${q}%,` +
      `manager.ilike.%${q}%`,
    )
  }

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('[fesco/orders] Supabase error:', error.message)
    return res.status(500).json({ ok: false, error: error.message })
  }

  return res.status(200).json({
    ok:     true,
    total:  count ?? 0,
    limit,
    offset,
    data:   data ?? [],
  })
}
