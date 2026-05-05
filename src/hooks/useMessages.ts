import { useEffect } from 'react'
import { useMessageStore } from '../stores/messageStore'
import { useRoomStore } from '../stores/roomStore'
import { markAsRead } from '../services/roomService'
import { sendTextMessage } from '../services/messageService'
import { useRealtimeMessages } from './useRealtimeMessages'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import type { ReplyRef, MessageWithSender } from '../types/chat'

function msgPreview(msg: MessageWithSender): string | null {
  switch (msg.message_type) {
    case 'image':            return '[사진]'
    case 'file':             return '[파일]'
    case 'voice_translated': return '[음성 메시지]'
    default:                 return msg.content
  }
}

export function useMessages(roomId: string | null) {
  const store = useMessageStore()
  const resetUnread = useRoomStore(s => s.resetUnread)
  const { profile } = useAuth()

  useEffect(() => {
    if (!roomId) return
    // 첫 진입: 메시지 미로드 시 fetch
    if (!store.messagesByRoom[roomId]) {
      store.fetchMessages(roomId)
        .then(async () => {
          // DB의 rooms.last_message가 null인 경우 로드된 메시지로 동기화
          const msgs = useMessageStore.getState().messagesByRoom[roomId]
          if (!msgs?.length) return
          for (let i = msgs.length - 1; i >= 0; i--) {
            const m = msgs[i]
            if (m.message_type === 'system' || m.deleted_at) continue
            const preview = msgPreview(m)
            if (preview) {
              useRoomStore.getState().updateLastMessage(roomId, preview, m.created_at)
              break
            }
          }
          // reactions는 MSG_SELECT join에서 분리해 별도 로드 (join이 channel 구독에 영향 주는 것을 방지)
          const messageIds = msgs.map(m => m.id)
          if (messageIds.length > 0) {
            const { data: reactionRows } = await supabase
              .from('message_reactions')
              .select('message_id, emoji, user_id')
              .in('message_id', messageIds)
            if (reactionRows && reactionRows.length > 0) {
              const byMsg = new Map<string, { emoji: string; user_id: string }[]>()
              for (const r of reactionRows) {
                if (!byMsg.has(r.message_id)) byMsg.set(r.message_id, [])
                byMsg.get(r.message_id)!.push({ emoji: r.emoji, user_id: r.user_id })
              }
              const storeState = useMessageStore.getState()
              for (const [msgId, reactions] of byMsg) {
                storeState.setReactions(roomId, msgId, reactions)
              }
            }
          }
        })
        .catch(console.error)
    }
    markAsRead(roomId).catch(console.error)
    resetUnread(roomId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  useRealtimeMessages(roomId)

  const loadMore = () => {
    if (!roomId) return
    const msgs = store.messagesByRoom[roomId] ?? []
    const oldest = msgs[0]
    if (oldest && store.hasMoreByRoom[roomId]) {
      store.fetchMessages(roomId, oldest.created_at).catch(console.error)
    }
  }

  return {
    messages: roomId ? (store.messagesByRoom[roomId] ?? []) : [],
    loading:  roomId ? (store.loadingByRoom[roomId] ?? false) : false,
    hasMore:  roomId ? (store.hasMoreByRoom[roomId] ?? false) : false,
    send: (content: string, replyToId?: string | null, replyMessage?: ReplyRef | null, needsResponse?: boolean, mentions?: string[]) =>
      sendTextMessage(roomId!, content, profile?.preferred_language, replyToId, replyMessage, needsResponse, undefined, mentions),
    loadMore,
  }
}
