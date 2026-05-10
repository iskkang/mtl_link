import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pin, Loader2, Megaphone, Trash2, Send } from 'lucide-react'
import { useAnnouncements } from '../../hooks/useAnnouncements'
import { useAuth } from '../../hooks/useAuth'
import { formatRoomTime } from '../../lib/date'
import type { AnnouncementItem } from '../../types/announcement'

export function AnnouncementsPanel() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const isAdmin = profile?.is_admin === true
  const { items, loading, error, create, remove } = useAnnouncements()

  const [draft,       setDraft]       = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = async () => {
    const trimmed = draft.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await create(trimmed)
      setDraft('')
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : t('announcementsSubmitError'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleSubmit()
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 공지 목록 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 flex flex-col gap-2 min-h-0">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--side-mute)' }} />
          </div>
        )}

        {error && !loading && (
          <div className="text-sm text-center py-8" style={{ color: 'var(--side-mute)' }}>
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <Megaphone size={32} style={{ color: 'var(--side-mute)' }} />
            <p className="text-sm" style={{ color: 'var(--side-mute)' }}>
              {t('announcementsEmpty')}
            </p>
          </div>
        )}

        {!loading && items.map(item => (
          <AnnouncementCard
            key={item.id}
            item={item}
            lang={i18n.language}
            isAdmin={isAdmin}
            onDelete={remove}
          />
        ))}
      </div>

      {/* 관리자 작성 폼 */}
      {isAdmin && (
        <div
          className="flex-shrink-0 p-3 flex flex-col gap-2"
          style={{ borderTop: '1px solid var(--side-line)' }}
        >
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('announcementsWritePlaceholder')}
            rows={3}
            maxLength={1000}
            className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: 'var(--side-row)',
              border:     '1px solid var(--side-line)',
              color:      'var(--side-text)',
            }}
          />

          {submitError && (
            <p className="text-xs" style={{ color: '#ef4444' }}>
              {submitError}
            </p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--side-mute)' }}>
              {draft.length}/1000 · Ctrl+Enter
            </span>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!draft.trim() || submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: draft.trim() ? 'var(--brand)' : 'var(--side-row)',
                color:      draft.trim() ? '#fff'         : 'var(--side-mute)',
                border:     `1px solid ${draft.trim() ? 'var(--brand)' : 'var(--side-line)'}`,
                cursor:     draft.trim() ? 'pointer'      : 'not-allowed',
              }}
            >
              {submitting
                ? <Loader2 size={13} className="animate-spin" />
                : <Send size={13} />
              }
              {t('announcementsSubmit')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AnnouncementCard({
  item,
  lang,
  isAdmin,
  onDelete,
}: {
  item:     AnnouncementItem
  lang:     string
  isAdmin:  boolean
  onDelete: (id: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const isLong = item.content.length > 200

  const handleDelete = () => {
    if (!window.confirm(t('announcementsDeleteConfirm'))) return
    void onDelete(item.id)
  }

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2 relative"
      style={{
        background: item.is_pinned ? 'var(--blue-soft)' : 'var(--side-row)',
        border:     `1px solid ${item.is_pinned ? 'var(--brand)' : 'var(--side-line)'}`,
      }}
    >
      {/* 삭제 버튼 (관리자만) */}
      {isAdmin && (
        <button
          type="button"
          onClick={handleDelete}
          className="absolute top-3 right-3 p-1 rounded transition-opacity opacity-30 hover:opacity-100"
          style={{ color: 'var(--side-mute)' }}
          title={t('announcementsDelete')}
        >
          <Trash2 size={14} />
        </button>
      )}

      {/* 배지 */}
      {(item.is_pinned || item.author?.is_admin) && (
        <div className="flex items-center gap-2">
          {item.is_pinned && (
            <span
              className="flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded"
              style={{ background: 'var(--brand)', color: '#fff' }}
            >
              <Pin size={10} />
              {t('announcementsPinned')}
            </span>
          )}
          {item.author?.is_admin && (
            <span
              className="text-[11px] px-1.5 py-0.5 rounded"
              style={{ color: 'var(--side-mute)', border: '1px solid var(--side-line)' }}
            >
              {t('announcementsAdmin')}
            </span>
          )}
        </div>
      )}

      {/* 본문 */}
      <p
        className="text-sm whitespace-pre-wrap"
        style={{
          color: 'var(--side-text)',
          ...(isLong && !expanded
            ? {
                display:         '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow:        'hidden',
              }
            : {}),
        }}
      >
        {item.content}
      </p>

      {/* 더 보기 / 접기 */}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="text-xs self-start"
          style={{ color: 'var(--brand)' }}
        >
          {expanded ? t('announcementsShowLess') : t('announcementsShowMore')}
        </button>
      )}

      {/* 하단: 작성자 · 날짜 */}
      <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--side-mute)' }}>
        {item.author?.name && (
          <>
            <span>{item.author.name}</span>
            <span>·</span>
          </>
        )}
        <span>{formatRoomTime(item.created_at, lang)}</span>
      </div>
    </div>
  )
}
