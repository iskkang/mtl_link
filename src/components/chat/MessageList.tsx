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
  onOpenThread?:     (messageId: string) => void
  onScrollToMessage: (messageId: string) => void
  searchQuery?:      string
  currentResultId?:  string | null
  targetLanguage?:   string
  roomId?:           string
}

export function MessageList({ messages, loading, hasMore, currentUserId, isGroupRoom, members, onLoadMore, onReply, onOpenThread, onScrollToMessage, searchQuery = '', currentResultId = null, targetLanguage, roomId }: Props) {
  const { t } = useTranslation()
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const prevLenRef = useRef(0)

  // 방 전환 시 스크롤 ref 초기화 → 초기 로드 스크롤 재트리거
  useEffect(() => {
    prevLenRef.current = 0
  }, [roomId])

  // 메시지 변경 시 스크롤 처리
  useEffect(() => {
    if (!messages.length) return
    if (messages.length > prevLenRef.current) {
      const isInitialLoad = prevLenRef.current === 0
      if (isInitialLoad) {
        // 초기 로드(방 전환 포함): isOwn 조건 없이 무조건 최신 메시지로 이동
        bottomRef.current?.scrollIntoView()
      } else {
        // Realtime 새 메시지: nearBottom이거나 내 메시지일 때만 스크롤
        const container = containerRef.current
        if (container) {
          const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200
          if (nearBottom || messages[messages.length - 1]?.sender_id === currentUserId) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
          }
        }
      }
    }
    prevLenRef.current = messages.length
  }, [messages, currentUserId])

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
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ink-3)' }} />
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
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--ink-3)' }} />
        </div>
      )}

      {messages.map((msg, idx) => {
        const prev    = idx > 0 ? messages[idx - 1] : null
        const showDate = !prev || !isSameDayStr(prev.created_at, msg.created_at)

        return (
          <div key={msg._localId ?? msg.id} data-message-id={msg.id}>
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
            {msg.message_type === 'system' ? (
              <div className="flex justify-center my-2 px-3">
                <span
                  className="text-[11px] px-3 py-0.5"
                  style={{ color: 'var(--ink-4)' }}
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
                onOpenThread={onOpenThread ? () => onOpenThread(msg.id) : undefined}
                onScrollToMessage={onScrollToMessage}
                members={members}
                currentUserId={currentUserId}
                isGroup={isGroupRoom}
                searchQuery={searchQuery}
                isCurrentResult={msg.id === currentResultId}
                targetLanguage={targetLanguage}
              />
            )}
          </div>
        )
      })}

      <div ref={bottomRef} />
    </div>
  )
}
