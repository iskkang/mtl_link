import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useMessageStore } from '../stores/messageStore'
import type { Message, Attachment } from '../types/chat'

export function useRealtimeMessages(roomId: string | null) {
  const { upsertMessage, addAttachment, refetchSinceLastSeen } = useMessageStore()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!roomId) return

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        payload => {
          const msg = payload.new as Message
          upsertMessage(roomId, {
            ...msg,
            _status:     'sent',
            sender:      null,
            attachments: [],
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_attachments', filter: `room_id=eq.${roomId}` },
        payload => addAttachment(roomId, (payload.new as Attachment).message_id, payload.new as Attachment),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        payload => {
          const msg = payload.new as Message
          upsertMessage(roomId, {
            ...msg,
            _status:     'sent',
            sender:      null,
            attachments: [],
          })
        },
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') refetchSinceLastSeen(roomId).catch(console.error)
        if (err) console.error('[Realtime] messages error:', err)
      })

    channelRef.current = channel
    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [roomId, upsertMessage, addAttachment, refetchSinceLastSeen])
}
