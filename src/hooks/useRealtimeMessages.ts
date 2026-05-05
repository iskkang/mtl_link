import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useMessageStore, MSG_SELECT, normaliseMsgs } from '../stores/messageStore'
import { useRoomStore } from '../stores/roomStore'
import { useAuth } from './useAuth'
import type { Message, Attachment } from '../types/chat'

export function useRealtimeMessages(roomId: string | null) {
  const { upsertMessage, addAttachment, refetchSinceLastSeen, setReactions } = useMessageStore()
  const updateMemberReadAt = useRoomStore(s => s.updateMemberReadAt)
  const { user } = useAuth()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!roomId) return

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        async payload => {
          const msg = payload.new as Message
          if (msg.thread_root_id) return // thread replies handled by useThreadMessages
          upsertMessage(roomId, {
            ...msg,
            _status:       'sent',
            sender:        null,
            attachments:   [],
            reply_message: null,
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase.from('messages') as any)
            .select(MSG_SELECT)
            .eq('id', msg.id)
            .single()
          if (data) upsertMessage(roomId, normaliseMsgs([data])[0])
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
            _status:       'sent',
            sender:        null,
            attachments:   [],
            reply_message: null,
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reactions', filter: `room_id=eq.${roomId}` },
        async payload => {
          const { message_id } = payload.new as { message_id: string; room_id: string; user_id: string; emoji: string }
          const { data } = await supabase
            .from('message_reactions')
            .select('emoji, user_id')
            .eq('message_id', message_id)
          if (data) setReactions(roomId, message_id, data)
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'message_reactions', filter: `room_id=eq.${roomId}` },
        async payload => {
          const { message_id } = payload.old as { message_id: string }
          const { data } = await supabase
            .from('message_reactions')
            .select('emoji, user_id')
            .eq('message_id', message_id)
          if (data) setReactions(roomId, message_id, data)
        },
      )
      .on(
        'broadcast',
        { event: 'read_receipt' },
        ({ payload }) => {
          const { userId, lastReadAt } = payload as { userId: string; lastReadAt: string }
          if (userId && lastReadAt) updateMemberReadAt(roomId, userId, lastReadAt)
        },
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          refetchSinceLastSeen(roomId).catch(console.error)
          if (user?.id) {
            channel.send({
              type:    'broadcast',
              event:   'read_receipt',
              payload: { userId: user.id, lastReadAt: new Date().toISOString() },
            }).catch(console.error)
          }
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[Realtime] ${status} on room:${roomId}, refetching messages`)
          refetchSinceLastSeen(roomId).catch(console.error)
        }
        if (err) console.error('[Realtime] messages error:', err)
      })

    channelRef.current = channel
    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [roomId, upsertMessage, addAttachment, refetchSinceLastSeen, updateMemberReadAt, setReactions, user?.id])
}
