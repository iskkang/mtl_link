import { Clock, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  needsResponse:    boolean
  responseReceived: boolean
  hoursSince:       number
}

export function FollowupBadge({ needsResponse, responseReceived, hoursSince }: Props) {
  const { t } = useTranslation()

  if (!needsResponse) return null

  if (responseReceived) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px]" style={{ color: '#22c55e' }}>
        <Check size={9} />
        {t('followupReceived')}
      </span>
    )
  }

  if (hoursSince < 24) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px]" style={{ color: 'var(--yellow, #ca8a04)' }}>
        <Clock size={9} />
        {t('followupWaiting')}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold" style={{ color: 'var(--red)' }}>
      <Clock size={9} />
      {t('followupOverdue', { hours: hoursSince })}
    </span>
  )
}
