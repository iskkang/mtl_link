import { useEffect, useRef, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import { formatDateSeparator, isSameDayStr } from '../../lib/date'
import type { MessageWithSender } from '../../types/chat'

interface Props {
  messages:          MessageWithSender[]
  loading:           boolean
  hasMore:           boolean
  currentUserId:     string
  isGroupRoom:       boolean
  onLoadMore:        () => void
  onReply:           (msg: MessageWithSender) => void
  onScrollToMessage: (messageId: string) => void
}

export function MessageList({ messages, loading, hasMore, currentUserId, isGroupRoom, onLoadMore, onReply, onScrollToMessage }: Props) {
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

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto scrollbar-thin py-2
                 bg-[#efeae2] dark:bg-surface-chat"
      style={{
        backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
      }}
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
                <span className="text-[11px] px-3 py-1 rounded-full
                                 bg-white/70 dark:bg-surface-panel/80
                                 text-gray-500 dark:text-[#8696a0]
                                 shadow-sm backdrop-blur-sm">
                  {formatDateSeparator(msg.created_at)}
                </span>
              </div>
            )}
            {msg.message_type === 'system' ? (
              <div className="flex justify-center my-1.5 px-3">
                <span className="text-[11px] px-3 py-1 rounded-full
                                 bg-white/70 dark:bg-surface-panel/80
                                 text-gray-400 dark:text-[#8696a0]
                                 shadow-sm backdrop-blur-sm italic">
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
              />
            )}
          </div>
        )
      })}

      <div ref={bottomRef} />
    </div>
  )
}
