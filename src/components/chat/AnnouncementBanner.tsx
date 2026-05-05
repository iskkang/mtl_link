import { X, Megaphone } from 'lucide-react'
import type { AnnouncementData } from '../../hooks/useAnnouncement'

interface Props {
  announcement: AnnouncementData
  onDismiss:    () => void
  onNavigate:   (roomId: string) => void
}

export function AnnouncementBanner({ announcement, onDismiss, onNavigate }: Props) {
  return (
    <button
      type="button"
      className="w-full flex items-center gap-2 px-3 py-2 flex-shrink-0 text-left"
      style={{
        background:   'rgba(245,158,11,0.08)',
        borderBottom: '1px solid rgba(245,158,11,0.18)',
      }}
      onClick={() => onNavigate(announcement.roomId)}
    >
      <Megaphone size={13} className="flex-shrink-0" style={{ color: '#D97706' }} />
      <p
        className="flex-1 text-xs truncate"
        style={{ color: 'var(--ink-2)' }}
      >
        {announcement.content}
      </p>
      <span
        role="button"
        className="flex-shrink-0 p-0.5 rounded"
        style={{ color: 'var(--ink-4)' }}
        onClick={e => { e.stopPropagation(); onDismiss() }}
        onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onDismiss() } }}
        tabIndex={0}
        aria-label="닫기"
      >
        <X size={12} />
      </span>
    </button>
  )
}
