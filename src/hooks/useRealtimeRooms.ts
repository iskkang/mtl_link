import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRoomStore } from '../stores/roomStore'
import type { Room } from '../types/chat'

export function useRealtimeRooms(userId: string | undefined) {
  const { updateLastMessage } = useRoomStore()

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
      .subscribe((_status, err) => {
        if (err) console.error('[Realtime] rooms error:', err)
      })

    return () => { channel.unsubscribe() }
  }, [userId, updateLastMessage])
}
