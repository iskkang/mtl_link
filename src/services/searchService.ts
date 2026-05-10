import { supabase } from '../lib/supabase'

// ── Legacy flat type (GlobalSearchPanel until Phase C) ────────────────────────
export interface LegacySearchResult {
  id:               string
  room_id:          string
  room_name:        string | null
  content:          string | null
  content_original: string | null
  created_at:       string
  sender_name:      string | null
}

// ── Phase B structured types ──────────────────────────────────────────────────
export interface MessageSearchHit {
  id:               string
  room_id:          string
  content:          string | null
  content_original: string | null
  created_at:       string
  message_type:     string | null
  sender:           { name: string | null; avatar_url: string | null } | null
  room:             { name: string | null } | null
}

export interface AttachmentSearchHit {
  id:              string
  message_id:      string
  room_id:         string
  file_name:       string
  mime_type:       string | null
  attachment_type: string | null
  message: {
    id:         string
    content:    string | null
    created_at: string
    sender:     { name: string | null; avatar_url: string | null } | null
  } | null
  room: { name: string | null } | null
}

export interface SearchResult {
  messages:    MessageSearchHit[]
  attachments: AttachmentSearchHit[]
}

// ── Core: two parallel queries ────────────────────────────────────────────────
export async function searchAllRooms(query: string): Promise<SearchResult> {
  const q = query.trim()
  if (!q) return { messages: [], attachments: [] }

  // Escape ILIKE special chars to prevent unintended wildcard matching
  const safe = q.replace(/[%_\\]/g, ch => '\\' + ch)

  const messagesPromise = supabase
    .from('messages')
    .select(`
      id, room_id, content, content_original, created_at, message_type,
      sender:profiles!messages_sender_id_fkey(name, avatar_url),
      room:rooms!messages_room_id_fkey(name)
    `)
    .is('deleted_at', null)
    .or(`content.ilike.%${safe}%,content_original.ilike.%${safe}%`)
    .order('created_at', { ascending: false })
    .limit(60)

  const attachmentsPromise = supabase
    .from('message_attachments')
    .select(`
      id, message_id, room_id, file_name, mime_type, attachment_type,
      message:messages!message_attachments_message_id_fkey(
        id, content, created_at,
        sender:profiles!messages_sender_id_fkey(name, avatar_url)
      ),
      room:rooms!message_attachments_room_id_fkey(name)
    `)
    .ilike('file_name', `%${safe}%`)
    .limit(30)

  const [messagesRes, attachmentsRes] = await Promise.all([
    messagesPromise,
    attachmentsPromise,
  ])

  if (messagesRes.error) {
    console.error('[searchAllRooms] messages error:', messagesRes.error)
    throw messagesRes.error
  }
  if (attachmentsRes.error) {
    console.error('[searchAllRooms] attachments error:', attachmentsRes.error)
    throw attachmentsRes.error
  }

  return {
    messages:    (messagesRes.data    ?? []) as unknown as MessageSearchHit[],
    attachments: (attachmentsRes.data ?? []) as unknown as AttachmentSearchHit[],
  }
}

// ── Legacy wrapper: flattens both into old flat shape (used by GlobalSearchPanel) ─
export async function searchAllRoomsLegacy(query: string): Promise<LegacySearchResult[]> {
  const r = await searchAllRooms(query)

  const msgs: LegacySearchResult[] = r.messages.map(m => ({
    id:               m.id,
    room_id:          m.room_id,
    room_name:        m.room?.name ?? null,
    content:          m.content,
    content_original: m.content_original,
    created_at:       m.created_at,
    sender_name:      m.sender?.name ?? null,
  }))

  const atts: LegacySearchResult[] = r.attachments.map(a => ({
    id:               a.message_id,
    room_id:          a.room_id,
    room_name:        a.room?.name ?? null,
    content:          `📎 ${a.file_name}`,
    content_original: a.file_name,
    created_at:       a.message?.created_at ?? '',
    sender_name:      a.message?.sender?.name ?? null,
  }))

  return [...msgs, ...atts]
}
