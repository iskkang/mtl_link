import { supabase } from '../lib/supabase'
import type { AnnouncementItem, AnnouncementRoom } from '../types/announcement'

export async function getAnnouncementRoom(): Promise<AnnouncementRoom | null> {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, name, is_announcement')
    .eq('is_announcement', true)
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('[announcement] getRoom error:', error)
    return null
  }
  return data as AnnouncementRoom
}

export async function fetchAnnouncements(roomId: string): Promise<AnnouncementItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: msgs, error: msgErr } = await (supabase as any)
    .from('messages')
    .select(`
      id, content, created_at, updated_at, room_id,
      sender:profiles!messages_sender_id_fkey(id, name, avatar_url, is_admin)
    `)
    .eq('room_id', roomId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (msgErr) {
    console.error('[announcement] fetchAnnouncements error:', msgErr)
    throw msgErr
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pinned } = await (supabase as any)
    .from('pinned_messages')
    .select('message_id')
    .eq('room_id', roomId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pinnedSet = new Set<string>((pinned ?? []).map((p: any) => p.message_id as string))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (msgs ?? []).map((msg: any) => ({
    id:         msg.id,
    content:    msg.content ?? '',
    created_at: msg.created_at,
    updated_at: msg.updated_at ?? null,
    room_id:    msg.room_id,
    author:     msg.sender
      ? {
          id:         msg.sender.id,
          name:       msg.sender.name,
          avatar_url: msg.sender.avatar_url,
          is_admin:   msg.sender.is_admin ?? false,
        }
      : null,
    is_pinned: pinnedSet.has(msg.id),
  })) as AnnouncementItem[]
}

export async function createAnnouncement(roomId: string, content: string): Promise<void> {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('공지 내용을 입력해주세요')

  const { error } = await supabase
    .from('messages')
    .insert({
      room_id:      roomId,
      content:      trimmed,
      message_type: 'text',
    } as never)

  if (error) {
    console.error('[announcement] create error:', error)
    throw error
  }
}

export async function deleteAnnouncement(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', messageId)

  if (error) {
    console.error('[announcement] delete error:', error)
    throw error
  }
}
