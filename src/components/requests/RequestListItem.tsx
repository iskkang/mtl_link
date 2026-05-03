import { AlertCircle, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Cell } from '../ui/Cell'
import type { RequestItem } from '../../services/requestService'

function formatAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
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

  const leading = (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
      style={{ background: isOverdue ? 'var(--red)' : 'var(--brand)' }}
    >
      {request.sender.name.charAt(0).toUpperCase()}
    </div>
  )

  const trailing = (
    <span
      className="flex items-center gap-0.5 text-[10px]"
      style={{ color: isOverdue ? 'var(--red)' : 'var(--side-mute)' }}
    >
      {isOverdue ? <AlertCircle size={9} /> : <Clock size={9} />}
      {formatAgo(request.created_at)}
    </span>
  )

  return (
    <Cell
      variant="threeLined"
      leading={leading}
      title={request.sender.name}
      subtitle={request.content}
      description={request.room.name ?? t('reqDirectMessage')}
      trailing={trailing}
      onClick={onClick}
    />
  )
}
