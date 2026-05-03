import { useEffect, useRef, useCallback } from 'react'
import { Loader2, MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MessageBubble } from './MessageBubble'
import { formatDateSeparator, isSameDayStr } from '../../lib/date'
import { EmptyState } from '../ui/EmptyState'
import type { MessageWithSender, RoomListItem } from '../../types/chat'

interface Props {
  messages:          MessageWithSender[]
  loading:           boolean
  hasMore:           boolean
  currentUserId:     string
  isGroupRoom:       boolean
  members:           RoomListItem['members']
  onLoadMore:        () => void
  onReply:           (msg: MessageWithSender) => void
  onScrollToMessage: (messageId: string) => void
  searchQuery?:      string
  currentResultId?:  string | null
}

export function MessageList({ messages, loading, hasMore, currentUserId, isGroupRoom, members, onLoadMore, onReply, onScrollToMessage, searchQuery = '', currentResultId = null }: Props) {
  const { t } = useTranslation()
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const prevLenRef = useRef(0)

  // 새 메시지 수신 시 하단 스크롤
  useEffect(() => {
    if (!messages.length) return
    // 새 메시지(아래쪽에 추가)가 있을 때만 스크롤 (페이지네이션으로 위에 추가된 경우 제외)
    if (messages.length > prevLenRef.current) {
      const container = containerRef.current
      if (container) {
        const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200
        if (nearBottom || messages[messages.length - 1]?.sender_id === currentUserId) {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
      }
    }
    prevLenRef.current = messages.length
  }, [messages, currentUserId])

  // 초기 로드 시 맨 아래로
  useEffect(() => {
    if (!loading && messages.length && prevLenRef.current === 0) {
      bottomRef.current?.scrollIntoView()
      prevLenRef.current = messages.length
    }
  }, [loading, messages.length])

  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container || !hasMore || loading) return
    if (container.scrollTop < 80) {
      onLoadMore()
    }
  }, [hasMore, loading, onLoadMore])

  if (loading && !messages.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-300 dark:text-[#8696a0]" />
      </div>
    )
  }

  if (!loading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--chat-bg)' }}>
        <EmptyState
          icon={MessageCircle}
          title={t('emptyMsgsTitle')}
          description={t('emptyMsgsDesc')}
        />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto scrollbar-thin py-2"
      style={{ background: 'var(--chat-bg)' }}
    >
      {/* 이전 메시지 로딩 */}
      {loading && messages.length > 0 && (
        <div className="flex justify-center py-2">
          <Loader2 size={18} className="animate-spin text-gray-400 dark:text-[#8696a0]" />
        </div>
      )}

      {messages.map((msg, idx) => {
        const prev    = idx > 0 ? messages[idx - 1] : null
        const showDate = !prev || !isSameDayStr(prev.created_at, msg.created_at)

        return (
          <div key={msg._localId ?? msg.id} data-message-id={msg.id}>
            {showDate && (
              <div className="flex justify-center my-3">
                <span
                className="text-[11px] px-3 py-1 rounded-full shadow-sm backdrop-blur-sm"
                style={{ background: 'var(--card)', color: 'var(--ink-3)', border: '1px solid var(--line)' }}
              >
                {formatDateSeparator(msg.created_at)}
              </span>
              </div>
            )}
            {msg.message_type === 'system' ? (
              <div className="flex justify-center my-1.5 px-3">
                <span
                className="text-[11px] px-3 py-1 rounded-full shadow-sm backdrop-blur-sm italic"
                style={{ background: 'var(--card)', color: 'var(--ink-4)', border: '1px solid var(--line)' }}
              >
                {msg.content}
              </span>
              </div>
            ) : (
              <MessageBubble
                message={msg}
                isOwn={msg.sender_id === currentUserId}
                showSenderInfo={isGroupRoom}
                prevMessage={prev}
                onReply={() => onReply(msg)}
                onScrollToMessage={onScrollToMessage}
                members={members}
                currentUserId={currentUserId}
                isGroup={isGroupRoom}
                searchQuery={searchQuery}
                isCurrentResult={msg.id === currentResultId}
              />
            )}
          </div>
        )
      })}

      <div ref={bottomRef} />
    </div>
  )
}
