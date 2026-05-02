import { AlertCircle, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RequestItem } from '../../services/requestService'

function formatAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 60)  return `${mins}분 전`
  if (hours < 24) return `${hours}시간 전`
  if (days === 1) return '어제'
  return `${days}일 전`
}

interface Props {
  request: RequestItem
  onClick: () => void
}

export function RequestListItem({ request, onClick }: Props) {
  const { t } = useTranslation()
  const isOverdue = request.hours_since >= 24

  return (
    <button
      onClick={onClick}
      className="w-full px-3 py-2.5 text-left transition-colors flex items-start gap-2.5 border-b"
      style={{ borderColor: 'var(--side-line)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* 아바타 */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 mt-0.5"
        style={{ background: isOverdue ? 'var(--red)' : 'var(--blue)' }}
      >
        {request.sender.name.charAt(0).toUpperCase()}
      </div>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--side-text)' }}>
            {request.sender.name}
          </span>
          <span className="text-[10px] flex-shrink-0 flex items-center gap-0.5" style={{ color: isOverdue ? 'var(--red)' : 'var(--side-mute)' }}>
            {isOverdue ? <AlertCircle size={9} /> : <Clock size={9} />}
            {formatAgo(request.created_at)}
          </span>
        </div>
        <p className="text-[11px] truncate leading-snug" style={{ color: 'var(--side-mute)' }}>
          {request.content}
        </p>
        <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--side-mute)', opacity: 0.6 }}>
          {request.room.name ?? t('reqDirectMessage')}
        </p>
      </div>
    </button>
  )
}
