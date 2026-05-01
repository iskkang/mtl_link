import { supabase } from '../lib/supabase'

export interface SearchResult {
  id:               string
  room_id:          string
  room_name:        string | null
  content:          string | null
  content_original: string | null
  created_at:       string
  sender_name:      string | null
}

type RawRow = {
  id:               string
  room_id:          string
  content:          string | null
  content_original: string | null
  created_at:       string
  sender: { name: string } | null
  room:   { name: string | null } | null
}

export async function searchAllRooms(query: string): Promise<SearchResult[]> {
  const q = query.trim()
  if (!q) return []

  const { data, error } = await supabase
    .from('messages')
    .select('id, room_id, content, content_original, created_at, sender:profiles!messages_sender_id_fkey(name), room:rooms!messages_room_id_fkey(name)')
    .is('deleted_at', null)
    .or(`content.ilike.%${q}%,content_original.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(60) as { data: RawRow[] | null; error: unknown }

  if (error) {
    console.error('[searchAllRooms]', error)
    return []
  }

  return (data ?? []).map(d => ({
    id:               d.id,
    room_id:          d.room_id,
    room_name:        d.room?.name ?? null,
    content:          d.content,
    content_original: d.content_original,
    created_at:       d.created_at,
    sender_name:      d.sender?.name ?? null,
  }))
}
