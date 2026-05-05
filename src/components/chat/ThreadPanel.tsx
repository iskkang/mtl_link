import { useState, useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useThreadMessages } from '../../hooks/useThreadMessages'
import { useAuth } from '../../hooks/useAuth'
import { validateFiles } from '../../lib/fileValidation'
import { getUserFriendlyMessage } from '../../lib/errors'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { MessageActionBar } from './MessageActionBar'
import { ReplyPreview } from './ReplyPreview'
import { PendingFilesPreview } from './PendingFilesPreview'
import { formatDateSeparator, isSameDayStr } from '../../lib/date'
import type { MessageWithSender, ReplyRef, RoomListItem } from '../../types/chat'

interface Props {
  roomId:         string
  rootMessageId:  string
  currentUserId:  string
  members:        RoomListItem['members']
  targetLanguage?: string | null
  isGroup:        boolean
  onClose:        () => void
}

export function ThreadPanel({ roomId, rootMessageId, currentUserId, members, targetLanguage, isGroup, onClose }: Props) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { rootMessage, replies, loading, sendReply, sendFileReply } = useThreadMessages(rootMessageId)

  const [draft,         setDraft]         = useState('')
  const [replyTo,       setReplyTo]       = useState<MessageWithSender | null>(null)
  const [pendingFiles,  setPendingFiles]  = useState<File[]>([])
  const [fileUploading, setFileUploading] = useState(false)
  const [fileError,     setFileError]     = useState<string | null>(null)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const prevLenRef  = useRef(0)

  // scroll to bottom when new replies arrive
  useEffect(() => {
    if (replies.length > prevLenRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: prevLenRef.current === 0 ? 'instant' as ScrollBehavior : 'smooth' })
    }
    prevLenRef.current = replies.length
  }, [replies])

  // reset scroll ref when thread changes
  useEffect(() => {
    prevLenRef.current = 0
  }, [rootMessageId])

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    const combined = [...pendingFiles, ...newFiles]
    if (combined.length > 5) { setFileError('한 번에 최대 5개까지 첨부할 수 있습니다'); return }
    const v = validateFiles(newFiles)
    if (!v.ok) { setFileError(v.error ?? '파일 검증 실패'); return }
    setPendingFiles(combined)
  }, [pendingFiles])

  const handleSend = useCallback(async (content: string, mentions: string[]) => {
    const current  = replyTo
    const ref: ReplyRef | null = current
      ? { id: current.id, content: current.content, message_type: current.message_type, deleted_at: current.deleted_at, sender: current.sender }
      : null
    setReplyTo(null)

    if (pendingFiles.length > 0) {
      const files = [...pendingFiles]
      setPendingFiles([])
      setFileUploading(true)
      try {
        await sendFileReply(roomId, files, content.trim() || undefined, current?.id ?? null, ref)
      } catch (err) {
        setFileError(getUserFriendlyMessage(err))
      } finally {
        setFileUploading(false)
      }
    } else {
      await sendReply(roomId, content, profile?.preferred_language, current?.id ?? null, ref, mentions)
    }
  }, [replyTo, pendingFiles, sendReply, sendFileReply, roomId, profile?.preferred_language])

  const scrollToMessage = useCallback((messageId: string) => {
    const el = document.querySelector<HTMLElement>(`[data-thread-message-id="${messageId}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('highlight-pulse')
    setTimeout(() => el.classList.remove('highlight-pulse'), 1500)
  }, [])

  const allMessages = rootMessage ? [rootMessage, ...replies] : replies

  return (
    <div
      className="flex flex-col h-full border-l"
      style={{
        width: '320px',
        flexShrink: 0,
        background: 'var(--chat-bg)',
        borderColor: 'var(--line)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
      >
        <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
          {t('threadTitle')}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg transition-colors"
          style={{ color: 'var(--ink-3)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}
          aria-label="닫기"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-2" style={{ background: 'var(--chat-bg)' }}>
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
              {/* Divider between root and replies */}
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
                targetLanguage={targetLanguage ?? undefined}
              />
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* File error */}
      {fileError && (
        <div className="mx-3 mb-1 px-3 py-1.5 rounded-lg text-xs text-white bg-red-500 flex items-center justify-between">
          <span>{fileError}</span>
          <button onClick={() => setFileError(null)} className="ml-2">✕</button>
        </div>
      )}

      {/* Action bar */}
      <MessageActionBar
        roomId={roomId}
        onEmojiSelect={emoji => setDraft(prev => prev + emoji)}
        onError={setFileError}
        onFilesSelected={handleFilesSelected}
        uploading={fileUploading}
        targetLanguage={targetLanguage ?? null}
        peerLanguage={null}
        onOpenTranslationModal={() => {}}
      />

      {/* Pending files */}
      {pendingFiles.length > 0 && (
        <PendingFilesPreview
          files={pendingFiles}
          onRemove={idx => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
        />
      )}

      {/* Reply preview */}
      {replyTo && (
        <ReplyPreview replyTo={replyTo} onCancel={() => setReplyTo(null)} />
      )}

      {/* Input */}
      <MessageInput
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        hasPendingFiles={pendingFiles.length > 0}
        targetLanguage={targetLanguage ?? null}
        placeholder={t('threadInputPlaceholder')}
        autoFocus
        members={members}
      />
    </div>
  )
}
