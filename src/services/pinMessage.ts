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

/** 핀 패널용 풀 데이터 (Phase C에서 사용)
 *  pinned_by → auth.users FK라 profiles 직접 join 불가 → 2단계 fetch
 */
export async function fetchPinnedMessages(roomId: string): Promise<PinnedMessageWithDetails[]> {
  // 1단계: pinned_messages + 메시지(sender 포함)
  const { data: rawRows, error: e1 } = await db()
    .select(`
      id,
      message_id,
      pinned_at,
      pinned_by,
      message:messages!pinned_messages_message_id_fkey (
        id, content, sender_id, created_at, message_type,
        sender:profiles!messages_sender_id_fkey ( name )
      )
    `)
    .eq('room_id', roomId)
    .order('pinned_at', { ascending: false })
    .limit(PIN_MAX)
  if (e1) throw e1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (rawRows ?? []) as any[]
  if (rows.length === 0) return []

  // 2단계: pinned_by user_id → profiles 일괄 fetch
  const userIds = [...new Set<string>(rows.map((r: { pinned_by: string }) => r.pinned_by).filter(Boolean))]
  const { data: profilesData, error: e2 } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', userIds)
  if (e2) throw e2

  const profileMap = new Map((profilesData ?? []).map(p => [p.id, p]))

  return rows.map(r => ({
    id:               r.id,
    message_id:       r.message_id,
    pinned_at:        r.pinned_at,
    pinned_by:        r.pinned_by,
    pinned_by_profile: profileMap.get(r.pinned_by) ?? null,
    message:          r.message ?? null,
  })) as PinnedMessageWithDetails[]
}
