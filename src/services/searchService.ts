import { supabase } from '../lib/supabase'

// ── Legacy flat type (GlobalSearchPanel — Phase C extended) ───────────────────
export interface LegacySearchResult {
  id:               string
  room_id:          string
  room_name:        string | null
  content:          string | null
  content_original: string | null
  created_at:       string
  sender_name:      string | null
  // Phase C optional fields for UI differentiation
  _attachment?: {
    file_name:       string
    attachment_type: string | null
    mime_type:       string | null
  }
  _translatedMatch?: string
}

// ── Phase B+ structured types ─────────────────────────────────────────────────
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

// message_translations has Relationships: [] — no PostgREST join available
// so we only select direct columns and fetch messages separately
export interface TranslationSearchHit {
  message_id:      string
  room_id:         string
  translated_text: string
  language:        string
}

export interface SearchResult {
  messages:     MessageSearchHit[]
  attachments:  AttachmentSearchHit[]
  translations: TranslationSearchHit[]
}

// ── Core: three parallel queries ──────────────────────────────────────────────
export async function searchAllRooms(query: string): Promise<SearchResult> {
  const q = query.trim()
  if (!q) return { messages: [], attachments: [], translations: [] }

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

  // Direct select only — no join (Relationships: [] in type definition)
  const translationsPromise = supabase
    .from('message_translations')
    .select('message_id, room_id, translated_text, language')
    .ilike('translated_text', `%${safe}%`)
    .limit(60)

  const [messagesRes, attachmentsRes, translationsRes] = await Promise.all([
    messagesPromise,
    attachmentsPromise,
    translationsPromise,
  ])

  if (messagesRes.error) {
    console.error('[searchAllRooms] messages error:', messagesRes.error)
    throw messagesRes.error
  }
  if (attachmentsRes.error) {
    console.error('[searchAllRooms] attachments error:', attachmentsRes.error)
    throw attachmentsRes.error
  }
  if (translationsRes.error) {
    // Translation search failure is non-fatal — fall back to empty
    console.error('[searchAllRooms] translations error:', translationsRes.error)
  }

  return {
    messages:     (messagesRes.data    ?? []) as unknown as MessageSearchHit[],
    attachments:  (attachmentsRes.data ?? []) as unknown as AttachmentSearchHit[],
    translations: (translationsRes.error
      ? []
      : (translationsRes.data ?? [])) as unknown as TranslationSearchHit[],
  }
}

// ── Legacy wrapper: dedup + merge + sort ──────────────────────────────────────
export async function searchAllRoomsLegacy(query: string): Promise<LegacySearchResult[]> {
  const r = await searchAllRooms(query)

  // message IDs already covered by direct message-content match
  const matchedMessageIds = new Set(r.messages.map(m => m.id))

  // Translation-only hits: exclude already-matched message IDs
  const translationOnly = r.translations.filter(t => !matchedMessageIds.has(t.message_id))

  // Fetch full message rows for translation-only hits (sequential, conditional)
  let translationMessages: MessageSearchHit[] = []
  const translationTextMap = new Map<string, string>()
  if (translationOnly.length > 0) {
    const ids = translationOnly.map(t => t.message_id)
    translationOnly.forEach(t => translationTextMap.set(t.message_id, t.translated_text))

    const { data } = await supabase
      .from('messages')
      .select(`
        id, room_id, content, content_original, created_at, message_type,
        sender:profiles!messages_sender_id_fkey(name, avatar_url),
        room:rooms!messages_room_id_fkey(name)
      `)
      .in('id', ids)
      .is('deleted_at', null)
    translationMessages = (data ?? []) as unknown as MessageSearchHit[]
  }

  const msgs: LegacySearchResult[] = r.messages.map(m => ({
    id:               m.id,
    room_id:          m.room_id,
    room_name:        m.room?.name ?? null,
    content:          m.content,
    content_original: m.content_original,
    created_at:       m.created_at,
    sender_name:      m.sender?.name ?? null,
  }))

  const translations: LegacySearchResult[] = translationMessages.map(m => ({
    id:               m.id,
    room_id:          m.room_id,
    room_name:        m.room?.name ?? null,
    content:          m.content,
    content_original: m.content_original,
    created_at:       m.created_at,
    sender_name:      m.sender?.name ?? null,
    _translatedMatch: translationTextMap.get(m.id),
  }))

  const atts: LegacySearchResult[] = r.attachments.map(a => ({
    id:               a.message_id,
    room_id:          a.room_id,
    room_name:        a.room?.name ?? null,
    content:          `📎 ${a.file_name}`,
    content_original: a.file_name,
    created_at:       a.message?.created_at ?? '',
    sender_name:      a.message?.sender?.name ?? null,
    _attachment: {
      file_name:       a.file_name,
      attachment_type: a.attachment_type,
      mime_type:       a.mime_type,
    },
  }))

  return [...msgs, ...translations, ...atts]
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
}
