import { useState, useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useThreadMessages } from '../../hooks/useThreadMessages'
import { useAuth } from '../../hooks/useAuth'
import { getUserFriendlyMessage } from '../../lib/errors'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { ReplyPreview } from './ReplyPreview'
import { formatDateSeparator, isSameDayStr } from '../../lib/date'
import type { MessageWithSender, ReplyRef, RoomListItem } from '../../types/chat'

interface Props {
  open:           boolean
  roomId:         string
  rootMessageId:  string
  currentUserId:  string
  members:        RoomListItem['members']
  targetLanguage?: string | null
  isGroup:        boolean
  onClose:        () => void
}

export function ThreadSheet({ open, roomId, rootMessageId, currentUserId, members, targetLanguage, isGroup, onClose }: Props) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { rootMessage, replies, loading, sendReply } = useThreadMessages(open ? rootMessageId : null)

  const [draft,       setDraft]     = useState('')
  const [replyTo,     setReplyTo]   = useState<MessageWithSender | null>(null)
  const [fileError,   setFileError] = useState<string | null>(null)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const prevLenRef = useRef(0)

  useEffect(() => {
    if (!open) {
      prevLenRef.current = 0
      setDraft('')
      setReplyTo(null)
    }
  }, [open])

  useEffect(() => {
    if (replies.length > prevLenRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: prevLenRef.current === 0 ? 'instant' as ScrollBehavior : 'smooth' })
    }
    prevLenRef.current = replies.length
  }, [replies])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  const handleSend = useCallback(async (content: string, mentions: string[]) => {
    const current = replyTo
    const ref: ReplyRef | null = current
      ? { id: current.id, content: current.content, message_type: current.message_type, deleted_at: current.deleted_at, sender: current.sender }
      : null
    setReplyTo(null)
    try {
      await sendReply(roomId, content, profile?.preferred_language, current?.id ?? null, ref, mentions)
    } catch (err) {
      setFileError(getUserFriendlyMessage(err))
    }
  }, [replyTo, sendReply, roomId, profile?.preferred_language])

  const scrollToMessage = useCallback((messageId: string) => {
    const el = document.querySelector<HTMLElement>(`[data-thread-message-id="${messageId}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('highlight-pulse')
    setTimeout(() => el.classList.remove('highlight-pulse'), 1500)
  }, [])

  if (!open) return null

  const allMessages = rootMessage ? [rootMessage, ...replies] : replies

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl flex flex-col animate-sheet-up"
        style={{
          height: '75vh',
          background: 'var(--chat-bg)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--line)' }} />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0"
          style={{ borderColor: 'var(--line)' }}
        >
          <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
            {t('threadTitle')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg"
            style={{ color: 'var(--ink-3)' }}
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
          {loading && !rootMessage && (
            <div className="flex justify-center py-8">
              <span className="w-5 h-5 border-2 border-current/20 border-t-current rounded-full animate-spin" style={{ color: 'var(--ink-3)' }} />
            </div>
          )}

          {allMessages.map((msg, idx) => {
            const prev     = idx > 0 ? allMessages[idx - 1] : null
            const showDate = !prev || !isSameDayStr(prev.created_at, msg.created_at)
            const isRoot   = msg.id === rootMessage?.id

            return (
              <div key={msg._localId ?? msg.id} data-thread-message-id={msg.id}>
                {showDate && (
                  <div className="flex justify-center my-4">
                    <span
                      className="text-[11px] font-medium px-3.5 py-1 rounded-full shadow-sm"
                      style={{ background: 'var(--card)', color: 'var(--ink-3)', border: '1px solid var(--line)' }}
                    >
                      {formatDateSeparator(msg.created_at)}
                    </span>
                  </div>
                )}
                {isRoot && replies.length > 0 && (
                  <div className="flex items-center gap-2 px-4 my-2">
                    <div className="flex-1 border-t" style={{ borderColor: 'var(--line)' }} />
                    <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--ink-4)' }}>
                      {t('threadReplies', { count: replies.length })}
                    </span>
                    <div className="flex-1 border-t" style={{ borderColor: 'var(--line)' }} />
                  </div>
                )}
                {isRoot && replies.length === 0 && !loading && (
                  <div className="flex items-center gap-2 px-4 my-2">
                    <div className="flex-1 border-t" style={{ borderColor: 'var(--line)' }} />
                    <span className="text-[11px] flex-shrink-0 italic" style={{ color: 'var(--ink-4)' }}>
                      {t('threadNoReplies')}
                    </span>
                    <div className="flex-1 border-t" style={{ borderColor: 'var(--line)' }} />
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  isOwn={msg.sender_id === currentUserId}
                  showSenderInfo={true}
                  prevMessage={null}
                  onReply={() => setReplyTo(msg)}
                  onScrollToMessage={scrollToMessage}
                  members={members}
                  currentUserId={currentUserId}
                  isGroup={isGroup}
                />
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Send error */}
        {fileError && (
          <div className="mx-3 mb-1 px-3 py-1.5 rounded-lg text-xs text-white bg-red-500 flex items-center justify-between flex-shrink-0">
            <span>{fileError}</span>
            <button onClick={() => setFileError(null)} className="ml-2">✕</button>
          </div>
        )}

        {/* Reply preview */}
        {replyTo && (
          <ReplyPreview replyTo={replyTo} onCancel={() => setReplyTo(null)} />
        )}

        {/* Input */}
        <div style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}>
          <MessageInput
            value={draft}
            onChange={setDraft}
            onSend={handleSend}
            targetLanguage={targetLanguage ?? null}
            placeholder={t('threadInputPlaceholder')}
            autoFocus
            members={members}
          />
        </div>
      </div>
    </>
  )
}
