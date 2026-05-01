import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useMessageStore, MSG_SELECT, normaliseMsgs } from '../stores/messageStore'
import { useRoomStore } from '../stores/roomStore'
import type { Message, Attachment } from '../types/chat'

export function useRealtimeMessages(roomId: string | null) {
  const { upsertMessage, addAttachment, refetchSinceLastSeen } = useMessageStore()
  const updateMemberReadAt = useRoomStore(s => s.updateMemberReadAt)
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
        // room_members UPDATE: 멤버의 last_read_at 변경 → 읽음 표시 즉시 반영
        // room_id=eq 필터로 검증된 패턴 사용 (neq 대신)
        { event: 'UPDATE', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` },
        payload => {
          const row = payload.new as { room_id: string; user_id: string; last_read_at: string | null }
          if (row.room_id && row.user_id && row.last_read_at) {
            updateMemberReadAt(row.room_id, row.user_id, row.last_read_at)
          }
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
  }, [roomId, upsertMessage, addAttachment, refetchSinceLastSeen, updateMemberReadAt])
}
