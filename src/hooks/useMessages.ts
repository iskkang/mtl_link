import { useEffect } from 'react'
import { useMessageStore } from '../stores/messageStore'
import { useRoomStore } from '../stores/roomStore'
import { markAsRead } from '../services/roomService'
import { sendTextMessage } from '../services/messageService'
import { useRealtimeMessages } from './useRealtimeMessages'
import { useAuth } from './useAuth'
import type { ReplyRef } from '../types/chat'

export function useMessages(roomId: string | null) {
  const store = useMessageStore()
  const resetUnread = useRoomStore(s => s.resetUnread)
  const { profile } = useAuth()

  useEffect(() => {
    if (!roomId) return
    // 첫 진입: 메시지 미로드 시 fetch
    if (!store.messagesByRoom[roomId]) {
      store.fetchMessages(roomId).catch(console.error)
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
    send: (content: string, replyToId?: string | null, replyMessage?: ReplyRef | null) =>
      sendTextMessage(roomId!, content, profile?.preferred_language, replyToId, replyMessage),
    loadMore,
  }
}
