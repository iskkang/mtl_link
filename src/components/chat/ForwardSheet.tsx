import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Share2, Search, X, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRoomStore } from '../../stores/roomStore'
import { useAuth } from '../../hooks/useAuth'
import { getRoomDisplayName } from '../../services/roomService'
import { forwardMessage } from '../../lib/forwardMessage'
import type { MessageWithSender } from '../../types/chat'

const MAX_SELECT = 5

interface Props {
  message:        MessageWithSender
  currentRoomId?: string
  onClose:        () => void
  onSuccess:      (count: number) => void
}

export function ForwardSheet({ message, currentRoomId, onClose, onSuccess }: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const allRooms = useRoomStore(s => s.rooms)

  const [query,       setQuery]       = useState('')
  const [debouncedQ,  setDebouncedQ]  = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSending,   setIsSending]   = useState(false)
  const [toast,       setToast]       = useState<string | null>(null)

  const toastTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartY  = useRef(0)
  const onCloseRef   = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  // PWA back button
  useEffect(() => {
    window.history.pushState({ forwardSheet: true }, '')
    const onPop = () => onCloseRef.current()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Debounce search query
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(query), 200)
    return () => clearTimeout(id)
  }, [query])

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }

  const filteredRooms = debouncedQ
    ? allRooms.filter(r =>
        getRoomDisplayName(r, user?.id ?? '').toLowerCase().includes(debouncedQ.toLowerCase()),
      )
    : allRooms

  const toggleRoom = (roomId: string) => {
    if (!selectedIds.has(roomId) && selectedIds.size >= MAX_SELECT) {
      showToast(t('forwardMaxLimit'))
      return
    }
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(roomId)) next.delete(roomId)
      else next.add(roomId)
      return next
    })
  }

  const handleForward = async () => {
    if (selectedIds.size === 0 || isSending) return
    setIsSending(true)
    try {
      await forwardMessage(message.id, [...selectedIds])
      onSuccess(selectedIds.size)
      onClose()
    } catch (e) {
      showToast(e instanceof Error ? e.message : '전달 실패')
      setIsSending(false)
    }
  }

  const previewSenderName =
    message.forwarded_from_user_name ??
    (message.sender as { name: string } | null)?.name ??
    '...'

  const previewContent = (() => {
    if (message.content) {
      return message.content.length > 120
        ? message.content.slice(0, 120) + '…'
        : message.content
    }
    if (message.message_type === 'image')            return '📷 사진'
    if (message.message_type === 'file')             return '📎 파일'
    if (message.message_type === 'voice_translated') return '🎙 음성'
    return null
  })()

  return createPortal(
    <div
      className="fixed inset-0 z-50"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Sheet body */}
      <div
        className="fixed flex flex-col
          inset-x-0 bottom-0 rounded-t-2xl max-h-[85dvh]
          md:inset-auto md:rounded-2xl
          md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
          md:w-[480px] md:h-[600px]"
        style={{ background: 'var(--card)', boxShadow: 'var(--shadow-lg)' }}
        onTouchStart={e => { touchStartY.current = e.touches[0].clientY }}
        onTouchEnd={e => {
          if (e.changedTouches[0].clientY - touchStartY.current > 80) onClose()
        }}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--line)' }} />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: 'var(--line)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
            {t('forwardTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
            style={{ color: 'var(--ink-3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Message preview */}
        <div
          className="mx-4 mt-3 mb-2 p-3 rounded-xl border flex-shrink-0"
          style={{ background: 'var(--bg)', borderColor: 'var(--line)' }}
        >
          <div className="flex items-center gap-1 mb-1">
            <Share2 size={11} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
            <span style={{ fontSize: '10px', color: 'var(--ink-3)' }}>
              {t('forwardedFrom', { name: previewSenderName })}
            </span>
          </div>
          {previewContent && (
            <p
              className="text-sm line-clamp-2 leading-relaxed"
              style={{ color: 'var(--ink)' }}
            >
              {previewContent}
            </p>
          )}
        </div>

        {/* Search */}
        <div className="px-4 pb-2 flex-shrink-0">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
          >
            <Search size={14} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('forwardSearch')}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: 'var(--ink)' }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{ color: 'var(--ink-4)' }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Room list */}
        <div className="flex-1 overflow-y-auto">
          {filteredRooms.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--ink-3)' }}>
              {t('forwardNoResults')}
            </p>
          ) : (
            filteredRooms.map(room => {
              const displayName = getRoomDisplayName(room, user?.id ?? '')
              const isSelected  = selectedIds.has(room.id)
              const isCurrent   = room.id === currentRoomId

              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => toggleRoom(room.id)}
                  className="flex items-center gap-3 px-4 py-3 w-full text-left transition-colors"
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Circle checkbox */}
                  <div
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{
                      background:  isSelected ? 'var(--brand)' : 'transparent',
                      borderColor: isSelected ? 'var(--brand)' : 'var(--ink-4)',
                    }}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6L5 9L10 3"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>

                  {/* Room name */}
                  <span
                    className="flex-1 text-sm truncate"
                    style={{ color: 'var(--ink)' }}
                  >
                    {room.room_type === 'channel' ? `#${displayName}` : displayName}
                  </span>

                  {/* Current room badge */}
                  {isCurrent && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ color: 'var(--brand)', background: 'var(--blue-soft)' }}
                    >
                      {t('forwardCurrentRoom')}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-3 border-t flex-shrink-0"
          style={{
            borderColor:   'var(--line)',
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          }}
        >
          <button
            type="button"
            onClick={handleForward}
            disabled={selectedIds.size === 0 || isSending}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            style={
              selectedIds.size > 0
                ? { background: 'var(--brand)', color: 'white' }
                : { background: 'var(--bg)', color: 'var(--ink-3)', cursor: 'not-allowed' }
            }
          >
            {isSending && <Loader2 size={14} className="animate-spin" />}
            {isSending
              ? '전달 중…'
              : selectedIds.size > 0
                ? t('forwardSendCount', { count: selectedIds.size })
                : t('forwardSend')}
          </button>
        </div>

        {/* In-sheet toast (max limit / error) */}
        {toast && (
          <div
            className="absolute bottom-20 left-1/2 -translate-x-1/2 whitespace-nowrap
                       px-4 py-2 rounded-xl text-sm font-medium shadow-lg pointer-events-none"
            style={{
              background: 'var(--card)',
              border:     '1px solid var(--line)',
              color:      'var(--ink)',
            }}
          >
            {toast}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
