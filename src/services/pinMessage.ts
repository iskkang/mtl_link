import { supabase } from '../lib/supabase'

export interface PinnedMessageRow {
  id: string
  message_id: string
  pinned_by: string
  pinned_at: string
}

export interface PinnedMessageWithDetails {
  id: string
  message_id: string
  pinned_at: string
  pinned_by: string
  pinned_by_profile: { name: string | null } | null
  message: {
    id: string
    content: string | null
    sender_id: string
    created_at: string
    message_type: string | null
    sender: { name: string | null } | null
  } | null
}

export const PIN_MAX = 5

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => (supabase as any).from('pinned_messages')

export async function pinMessage(roomId: string, messageId: string, userId: string) {
  const { data, error } = await db()
    .insert({ room_id: roomId, message_id: messageId, pinned_by: userId })
    .select()
    .single()
  if (error) throw error
  return data as PinnedMessageRow
}

export async function unpinMessage(roomId: string, messageId: string) {
  const { error } = await db()
    .delete()
    .eq('room_id', roomId)
    .eq('message_id', messageId)
  if (error) throw error
}

export async function fetchPinnedIds(roomId: string): Promise<PinnedMessageRow[]> {
  const { data, error } = await db()
    .select('id, message_id, pinned_by, pinned_at')
    .eq('room_id', roomId)
    .order('pinned_at', { ascending: false })
    .limit(PIN_MAX * 2)
  if (error) throw error
  return (data ?? []) as PinnedMessageRow[]
}

/** 핀 패널용 풀 데이터 (Phase C에서 사용) */
export async function fetchPinnedMessages(roomId: string): Promise<PinnedMessageWithDetails[]> {
  const { data, error } = await db()
    .select(`
      id,
      message_id,
      pinned_at,
      pinned_by,
      pinned_by_profile:profiles!pinned_messages_pinned_by_fkey ( name ),
      message:messages!pinned_messages_message_id_fkey (
        id, content, sender_id, created_at, message_type,
        sender:profiles!messages_sender_id_fkey ( name )
      )
    `)
    .eq('room_id', roomId)
    .order('pinned_at', { ascending: false })
    .limit(PIN_MAX)
  if (error) throw error
  return (data ?? []) as PinnedMessageWithDetails[]
}
