import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useMessageStore, MSG_SELECT, normaliseMsgs } from '../stores/messageStore'
import { useRoomStore } from '../stores/roomStore'
import { useAuth } from './useAuth'
import type { Message, Attachment } from '../types/chat'

export function useRealtimeMessages(roomId: string | null) {
  const { upsertMessage, addAttachment, refetchSinceLastSeen } = useMessageStore()
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
          // Optimistically show with partial data
          upsertMessage(roomId, {
            ...msg,
            _status:       'sent',
            sender:        null,
            attachments:   [],
            reply_message: null,
          })
          // Fetch full data with joins (sender, reply_message)
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
        // room_members UPDATE: 자신의 last_read_at 변경 시 → 브로드캐스트로 다른 멤버에게 relay
        // RLS로 인해 타인의 UPDATE는 전달 안 되므로, 자신 것만 받아서 broadcast로 전파
        { event: 'UPDATE', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` },
        payload => {
          const row = payload.new as { room_id: string; user_id: string; last_read_at: string | null }
          if (!row.room_id || !row.user_id || !row.last_read_at) return

          if (row.user_id === user?.id) {
            // 자신의 last_read_at 변경 → 같은 방의 다른 멤버에게 broadcast로 전달
            console.log('[READ-3] 자신의 room_members UPDATE 수신, broadcast relay', { userId: row.user_id, lastReadAt: row.last_read_at })
            channel.send({
              type:    'broadcast',
              event:   'read_receipt',
              payload: { userId: row.user_id, lastReadAt: row.last_read_at },
            }).then(result => {
              console.log('[READ-4] broadcast relay 결과', result)
            }).catch(err => {
              console.error('[READ-4] broadcast relay 오류', err)
            })
          } else {
            // 타인의 UPDATE가 드물게 전달될 때 직접 반영 (RLS가 허용하는 경우)
            updateMemberReadAt(row.room_id, row.user_id, row.last_read_at)
          }
        },
      )
      .on(
        'broadcast',
        { event: 'read_receipt' },
        ({ payload }) => {
          console.log('[READ-6] broadcast read_receipt 수신', payload)
          const { userId, lastReadAt } = payload as { userId: string; lastReadAt: string }
          if (userId && lastReadAt) updateMemberReadAt(roomId, userId, lastReadAt)
        },
      )
      .subscribe((status, err) => {
        console.log('[READ-7] channel 구독 상태', status)
        if (status === 'SUBSCRIBED') refetchSinceLastSeen(roomId).catch(console.error)
        if (err) console.error('[Realtime] messages error:', err)
      })

    channelRef.current = channel
    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [roomId, upsertMessage, addAttachment, refetchSinceLastSeen, updateMemberReadAt, user?.id])
}
