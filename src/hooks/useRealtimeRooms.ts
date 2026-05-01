import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRoomStore } from '../stores/roomStore'
import type { Room, Message } from '../types/chat'

function msgPreview(msg: Message): string | null {
  switch (msg.message_type) {
    case 'image':            return '[사진]'
    case 'file':             return '[파일]'
    case 'voice_translated': return '[음성 메시지]'
    default:                 return msg.content
  }
}

export function useRealtimeRooms(userId: string | undefined) {
  const { updateLastMessage, removeRoom, updateMemberReadAt } = useRoomStore()

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('realtime:rooms')
      // rooms UPDATE: DB 트리거가 last_message 업데이트했을 때 반영 (RLS 통과 시)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms' },
        payload => {
          const room = payload.new as Room
          updateLastMessage(room.id, room.last_message, room.last_message_at)
        },
      )
      // messages INSERT: rooms UPDATE RLS가 동작 안 할 때 보완 경로 (receiver 측)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        payload => {
          const msg = payload.new as Message
          if (!msg.room_id || msg.message_type === 'system' || msg.sender_id === userId) return
          updateLastMessage(msg.room_id, msgPreview(msg), msg.created_at)
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'rooms' },
        payload => {
          const id = (payload.old as { id: string }).id
          if (id) removeRoom(id)
        },
      )
      .on(
        'postgres_changes',
        // REPLICA IDENTITY FULL 설정으로 old row에 room_id 포함됨
        { event: 'DELETE', schema: 'public', table: 'room_members', filter: `user_id=eq.${userId}` },
        payload => {
          const roomId = (payload.old as { room_id?: string }).room_id
          if (roomId) removeRoom(roomId)
        },
      )
      .on(
        'postgres_changes',
        // 다른 멤버의 last_read_at 변경 감지 → 읽음 표시 즉시 반영
        { event: 'UPDATE', schema: 'public', table: 'room_members', filter: `user_id=neq.${userId}` },
        payload => {
          const { room_id, user_id, last_read_at } = payload.new as {
            room_id:      string
            user_id:      string
            last_read_at: string | null
          }
          if (room_id && user_id && last_read_at) {
            updateMemberReadAt(room_id, user_id, last_read_at)
          }
        },
      )
      .subscribe((_status, err) => {
        if (err) console.error('[Realtime] rooms error:', err)
      })

    return () => { channel.unsubscribe() }
  }, [userId, updateLastMessage, removeRoom, updateMemberReadAt])
}
