import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Pin, X, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { fetchPinnedMessages, unpinMessage, type PinnedMessageWithDetails } from '../../services/pinMessage'
import { formatMessageTime } from '../../lib/date'

interface Props {
  roomId:          string
  currentUserId:   string
  onClose:         () => void
  onJumpToMessage: (messageId: string) => void
  onUnpinSuccess?: () => void
}

export function PinnedMessagesPanel({ roomId, currentUserId, onClose, onJumpToMessage, onUnpinSuccess }: Props) {
  const { t } = useTranslation()
  const [items,   setItems]   = useState<PinnedMessageWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  const reload = async () => {
    setLoading(true)
    try {
      const data = await fetchPinnedMessages(roomId)
      setItems(data)
    } catch (err) {
      console.error('[PinnedMessagesPanel] fetch failed', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [roomId])

  // PWA back button
  useEffect(() => {
    window.history.pushState({ pinPanel: true }, '')
    const onPop = () => onCloseRef.current()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // 패널 자체 Realtime 구독
  useEffect(() => {
    const ch = supabase
      .channel(`pinned_panel:${roomId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'pinned_messages',
        filter: `room_id=eq.${roomId}`,
      }, () => { reload() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [roomId])

  const handleUnpin = async (messageId: string) => {
    try {
      await unpinMessage(roomId, messageId)
      reload()
      onUnpinSuccess?.()
    } catch (err) {
      console.error('[PinnedMessagesPanel] unpin failed', err)
    }
  }

  const handleItemClick = (messageId: string) => {
    onJumpToMessage(messageId)
    onClose()
  }

  const touchStartY = useRef(0)

  return createPortal(
    <div
      className="fixed inset-0 z-50"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="fixed flex flex-col
          inset-x-0 bottom-0 rounded-t-2xl max-h-[85dvh]
          md:inset-auto md:rounded-2xl
          md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
          md:w-[480px] md:max-h-[600px]"
        style={{ background: 'var(--card)', boxShadow: 'var(--shadow-lg)' }}
        onTouchStart={e => { touchStartY.current = e.touches[0].clientY }}
        onTouchEnd={e => {
          if (e.changedTouches[0].clientY - touchStartY.current > 80) onClose()
        }}
      >
        {/* 모바일 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--line)' }} />
        </div>

        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: 'var(--line)' }}
        >
          <div className="flex items-center gap-2">
            <Pin size={15} style={{ color: 'var(--ink-3)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
              {t('pinPanelTitle')}
            </h2>
            {items.length > 0 && (
              <span className="text-xs" style={{ color: 'var(--ink-3)' }}>
                {items.length}/5
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
            style={{ color: 'var(--ink-3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            aria-label={t('pinClose')}
          >
            <X size={16} />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-10">
              <Loader2 size={22} className="animate-spin" style={{ color: 'var(--ink-3)' }} />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 gap-3">
              <Pin size={32} style={{ color: 'var(--ink-4)' }} />
              <p className="text-sm text-center" style={{ color: 'var(--ink-3)' }}>
                {t('pinEmpty')}
              </p>
            </div>
          ) : (
            items.map(item => (
              <PinnedItem
                key={item.id}
                item={item}
                isMine={item.pinned_by === currentUserId}
                onJump={() => handleItemClick(item.message_id)}
                onUnpin={() => handleUnpin(item.message_id)}
                t={t}
              />
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ── 핀 항목 ─────────────────────────────────────────────── */
function PinnedItem({
  item, isMine, onJump, onUnpin, t,
}: {
  item:    PinnedMessageWithDetails
  isMine:  boolean
  onJump:  () => void
  onUnpin: () => void
  t:       (key: string) => string
}) {
  const senderName = item.message?.sender?.name ?? '—'

  const preview = (() => {
    const c = item.message?.content
    if (c) return c.length > 100 ? c.slice(0, 100) + '…' : c
    const type = item.message?.message_type
    if (type === 'image')            return '📷 사진'
    if (type === 'file')             return '📎 파일'
    if (type === 'voice_translated') return '🎙 음성'
    return '—'
  })()

  return (
    <button
      type="button"
      onClick={onJump}
      className="w-full text-left px-4 py-3.5 flex items-start gap-3 border-b transition-colors"
      style={{ borderColor: 'var(--line)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* 핀 아이콘 */}
      <div
        className="mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--blue-soft)' }}
      >
        <Pin size={13} style={{ color: 'var(--brand)' }} />
      </div>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold truncate" style={{ color: 'var(--ink)' }}>
            {senderName}
          </span>
          <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--ink-4)' }}>
            {item.message?.created_at ? formatMessageTime(item.message.created_at) : ''}
          </span>
        </div>
        <p className="text-sm line-clamp-2 leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          {preview}
        </p>
        <p className="text-[10px] mt-1" style={{ color: 'var(--ink-4)' }}>
          {t('pinJumpToMessage')}
        </p>
      </div>

      {/* 해제 버튼 — 본인이 핀한 경우만 */}
      {isMine && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onUnpin() }}
          className="flex-shrink-0 text-xs px-2.5 py-1 rounded-lg transition-colors"
          style={{ color: 'var(--ink-3)', border: '1px solid var(--line)' }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--red)'
            e.currentTarget.style.borderColor = 'var(--red)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--ink-3)'
            e.currentTarget.style.borderColor = 'var(--line)'
          }}
        >
          {t('unpinMessage')}
        </button>
      )}
    </button>
  )
}
