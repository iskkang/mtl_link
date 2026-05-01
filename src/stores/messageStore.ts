import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { MessageWithSender, Attachment, ReplyRef } from '../types/chat'

interface MessageStore {
  messagesByRoom:  Record<string, MessageWithSender[]>
  loadingByRoom:   Record<string, boolean>
  hasMoreByRoom:   Record<string, boolean>

  fetchMessages:        (roomId: string, before?: string) => Promise<void>
  upsertMessage:        (roomId: string, msg: MessageWithSender) => void
  addAttachment:        (roomId: string, messageId: string, att: Attachment) => void
  updateStatus:         (roomId: string, localIdOrId: string, status: MessageWithSender['_status']) => void
  refetchSinceLastSeen: (roomId: string) => Promise<void>
}

export const MSG_SELECT = `
  *,
  sender:profiles!sender_id(id, name, avatar_url),
  attachments:message_attachments(*),
  reply_message:messages!messages_reply_to_id_fkey(
    id,
    content,
    message_type,
    deleted_at,
    sender:profiles!messages_sender_id_fkey(id, name)
  )
` as const

type RawReplyMessage = {
  id:           string
  content:      string | null
  message_type: string
  deleted_at:   string | null
  sender:       { id: string; name: string } | { id: string; name: string }[] | null
}

export function normaliseMsgs(raw: unknown[]): MessageWithSender[] {
  return (raw as MessageWithSender[]).map(m => {
    const rawReply = m.reply_message as RawReplyMessage | null
    let reply_message: ReplyRef | null = null
    if (rawReply) {
      const rawSender = rawReply.sender
      const sender = Array.isArray(rawSender)
        ? (rawSender[0] ?? null)
        : rawSender
      reply_message = {
        id:           rawReply.id,
        content:      rawReply.content,
        message_type: rawReply.message_type,
        deleted_at:   rawReply.deleted_at,
        sender,
      }
    }
    return {
      ...m,
      _status:       'sent' as const,
      attachments:   (m.attachments as Attachment[] | null) ?? [],
      reply_message,
    }
  })
}

export const useMessageStore = create<MessageStore>((set, get) => ({
  messagesByRoom: {},
  loadingByRoom:  {},
  hasMoreByRoom:  {},

  // ─── 메시지 불러오기 ────────────────────────────────────────
  fetchMessages: async (roomId, before) => {
    set(s => ({ loadingByRoom: { ...s.loadingByRoom, [roomId]: true } }))
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase.from('messages') as any)
        .select(MSG_SELECT)
        .eq('room_id', roomId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50)

      if (before) q = q.lt('created_at', before)

      const { data, error } = await q
      if (error) throw error

      const msgs = normaliseMsgs(data ?? []).reverse()
      const hasMore = msgs.length === 50

      set(s => ({
        loadingByRoom: { ...s.loadingByRoom, [roomId]: false },
        hasMoreByRoom: { ...s.hasMoreByRoom, [roomId]: hasMore },
        messagesByRoom: {
          ...s.messagesByRoom,
          [roomId]: before
            ? [...msgs, ...(s.messagesByRoom[roomId] ?? [])]
            : msgs,
        },
      }))
    } catch (err) {
      set(s => ({ loadingByRoom: { ...s.loadingByRoom, [roomId]: false } }))
      throw err
    }
  },

  // ─── Realtime/Optimistic dedupe ─────────────────────────────
  upsertMessage: (roomId, incoming) => set(s => {
    const list = s.messagesByRoom[roomId] ?? []

    // 1) DB id 일치 → merge (attachment, sender, reply_message 유지)
    const idIdx = list.findIndex(m => m.id === incoming.id)
    if (idIdx >= 0) {
      const next = [...list]
      next[idIdx] = {
        ...next[idIdx],
        ...incoming,
        attachments:   next[idIdx].attachments,
        sender:        incoming.sender        ?? next[idIdx].sender,
        reply_message: incoming.reply_message ?? next[idIdx].reply_message,
      }
      return { messagesByRoom: { ...s.messagesByRoom, [roomId]: next } }
    }

    // 2) localId 일치 → optimistic → real 교체
    if (incoming._localId) {
      const localIdx = list.findIndex(m => m._localId === incoming._localId)
      if (localIdx >= 0) {
        const next = [...list]
        next[localIdx] = { ...next[localIdx], ...incoming }
        return { messagesByRoom: { ...s.messagesByRoom, [roomId]: next } }
      }
    }

    // 3) 신규 메시지 추가
    return {
      messagesByRoom: {
        ...s.messagesByRoom,
        [roomId]: [...list, incoming].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        ),
      },
    }
  }),

  addAttachment: (roomId, messageId, att) => set(s => {
    const list = s.messagesByRoom[roomId] ?? []
    const idx = list.findIndex(m => m.id === messageId)
    if (idx < 0) return {}
    const next = [...list]
    const msg = next[idx]
    if (!msg.attachments.find(a => a.id === att.id)) {
      next[idx] = { ...msg, attachments: [...msg.attachments, att] }
    }
    return { messagesByRoom: { ...s.messagesByRoom, [roomId]: next } }
  }),

  updateStatus: (roomId, localIdOrId, status) => set(s => {
    const list = s.messagesByRoom[roomId] ?? []
    const idx = list.findIndex(m => m.id === localIdOrId || m._localId === localIdOrId)
    if (idx < 0) return {}
    const next = [...list]
    next[idx] = { ...next[idx], _status: status }
    return { messagesByRoom: { ...s.messagesByRoom, [roomId]: next } }
  }),

  // ─── 재연결 후 누락 메시지 복구 ─────────────────────────────
  refetchSinceLastSeen: async (roomId) => {
    const messages = get().messagesByRoom[roomId] ?? []
    const lastMsg  = messages[messages.length - 1]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('messages') as any)
      .select(MSG_SELECT)
      .eq('room_id', roomId)
      .is('deleted_at', null)
      .gt('created_at', lastMsg?.created_at ?? '1970-01-01T00:00:00Z')
      .order('created_at', { ascending: true })

    for (const msg of normaliseMsgs(data ?? [])) {
      get().upsertMessage(roomId, msg)
    }
  },
}))
