import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRoomStore } from '../stores/roomStore'
import type { Room } from '../types/chat'

export function useRealtimeRooms(userId: string | undefined) {
  const { updateLastMessage, removeRoom } = useRoomStore()

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('realtime:rooms')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms' },
        payload => {
          const room = payload.new as Room
          updateLastMessage(room.id, room.last_message, room.last_message_at)
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
      .subscribe((_status, err) => {
        if (err) console.error('[Realtime] rooms error:', err)
      })

    return () => { channel.unsubscribe() }
  }, [userId, updateLastMessage, removeRoom])
}
