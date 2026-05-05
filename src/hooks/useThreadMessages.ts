import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { MSG_SELECT, normaliseMsgs } from '../stores/messageStore'
import { sendTextMessage, sendFileMessage } from '../services/messageService'
import type { MessageWithSender, ReplyRef } from '../types/chat'

export function useThreadMessages(rootMessageId: string | null) {
  const [rootMessage, setRootMessage] = useState<MessageWithSender | null>(null)
  const [replies,     setReplies]     = useState<MessageWithSender[]>([])
  const [loading,     setLoading]     = useState(false)

  const fetchThread = useCallback(async (rootId: string) => {
    setLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rootData } = await (supabase.from('messages') as any)
        .select(MSG_SELECT)
        .eq('id', rootId)
        .single()

      if (rootData) {
        setRootMessage(normaliseMsgs([rootData])[0] ?? null)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: repliesData } = await (supabase.from('messages') as any)
        .select(MSG_SELECT)
        .eq('thread_root_id', rootId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      setReplies(normaliseMsgs(repliesData ?? []))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!rootMessageId) {
      setRootMessage(null)
      setReplies([])
      return
    }
    void fetchThread(rootMessageId)

    const ch = supabase
      .channel(`thread:${rootMessageId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_root_id=eq.${rootMessageId}` },
        () => { void fetchThread(rootMessageId) },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `id=eq.${rootMessageId}` },
        () => { void fetchThread(rootMessageId) },
      )
      .subscribe()

    return () => { void supabase.removeChannel(ch) }
  }, [rootMessageId, fetchThread])

  const sendReply = useCallback(async (
    roomId:        string,
    content:       string,
    sourceLanguage?: string,
    replyToId?:    string | null,
    replyMessage?: ReplyRef | null,
    mentions?:     string[],
  ) => {
    if (!rootMessageId) return
    await sendTextMessage(roomId, content, sourceLanguage, replyToId, replyMessage, false, rootMessageId, mentions)
  }, [rootMessageId])

  const sendFileReply = useCallback(async (
    roomId:        string,
    files:         File[],
    caption?:      string,
    replyToId?:    string | null,
    replyMessage?: ReplyRef | null,
  ) => {
    if (!rootMessageId) return
    await sendFileMessage(roomId, files, caption, replyToId, replyMessage, rootMessageId)
  }, [rootMessageId])

  return { rootMessage, replies, loading, sendReply, sendFileReply }
}
