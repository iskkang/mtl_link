import { supabase } from '../lib/supabase'

export interface RequestItem {
  message_id:      string
  room_id:         string
  content:         string
  source_language: string | null
  created_at:      string
  hours_since:     number
  translations:    { language: string; translated_text: string }[]
  sender: {
    id:           string
    name:         string
    avatar_url:   string | null
    avatar_color: string | null
  }
  room: {
    id:        string
    name:      string | null
    room_type: string
  }
}

const SELECT = `
  id,
  room_id,
  content,
  source_language,
  created_at,
  sender:profiles!sender_id(id, name, avatar_url, avatar_color),
  room:rooms(id, name, room_type),
  translations:message_translations(language, translated_text)
` as const

function toItem(m: Record<string, unknown>, now: number): RequestItem {
  return {
    message_id:      m.id as string,
    room_id:         m.room_id as string,
    content:         (m.content as string | null) ?? '',
    source_language: (m.source_language as string | null) ?? null,
    created_at:      m.created_at as string,
    hours_since:     Math.floor((now - new Date(m.created_at as string).getTime()) / 3_600_000),
    translations:    (m.translations as { language: string; translated_text: string }[] | null) ?? [],
    sender:          m.sender as RequestItem['sender'],
    room:            m.room as RequestItem['room'],
  }
}

/** 내가 답해야 할 다른 사람의 질문 */
export async function getReceivedRequests(): Promise<RequestItem[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('messages')
    .select(SELECT)
    .neq('sender_id', user.id)
    .eq('needs_response', true)
    .eq('response_received', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) { console.error('[requestService] received:', error); return [] }

  const now = Date.now()
  return (data ?? []).map(m => toItem(m as Record<string, unknown>, now))
}

/** 요청 플래그 토글 */
export async function toggleRequestFlag(messageId: string, value: boolean): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ needs_response: value })
    .eq('id', messageId)
  if (error) throw error
}

/** 내가 보냈는데 아직 답변 못 받은 질문 */
export async function getSentRequests(): Promise<RequestItem[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('messages')
    .select(SELECT)
    .eq('sender_id', user.id)
    .eq('needs_response', true)
    .eq('response_received', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) { console.error('[requestService] sent:', error); return [] }

  const now = Date.now()
  return (data ?? []).map(m => toItem(m as Record<string, unknown>, now))
}
