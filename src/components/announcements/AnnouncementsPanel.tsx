import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pin, Loader2, Megaphone } from 'lucide-react'
import { useAnnouncements } from '../../hooks/useAnnouncements'
import { formatRoomTime } from '../../lib/date'
import type { AnnouncementItem } from '../../types/announcement'

export function AnnouncementsPanel() {
  const { t, i18n } = useTranslation()
  const { items, loading, error } = useAnnouncements()

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 flex flex-col gap-2">
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
          <AnnouncementCard key={item.id} item={item} lang={i18n.language} />
        ))}
      </div>
    </div>
  )
}

function AnnouncementCard({ item, lang }: { item: AnnouncementItem; lang: string }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const isLong = item.content.length > 200

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{
        background: item.is_pinned ? 'var(--blue-soft)' : 'var(--side-row)',
        border:     `1px solid ${item.is_pinned ? 'var(--brand)' : 'var(--side-line)'}`,
      }}
    >
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

      <p
        className="text-sm whitespace-pre-wrap"
        style={{
          color: 'var(--side-text)',
          ...(isLong && !expanded
            ? {
                display:           '-webkit-box',
                WebkitLineClamp:   3,
                WebkitBoxOrient:   'vertical',
                overflow:          'hidden',
              }
            : {}),
        }}
      >
        {item.content}
      </p>

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
