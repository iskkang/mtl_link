import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Inbox } from 'lucide-react'
import { DashboardCard } from './DashboardCard'
import { getReceivedRequests } from '../../services/requestService'
import type { RequestItem } from '../../services/requestService'
import type { Section } from '../layout/MenuRail'

interface Props {
  onSectionChange: (s: Section) => void
}

function timeAgo(hours: number, t: (k: string, opts?: Record<string, unknown>) => string): string {
  if (hours < 1) return t('dashReqJustNow')
  if (hours < 24) return t('dashReqHoursAgo', { n: hours })
  return t('dashReqDaysAgo', { n: Math.floor(hours / 24) })
}

export function RequestsCard({ onSectionChange }: Props) {
  const { t } = useTranslation()
  const [items,   setItems]   = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getReceivedRequests().then(data => {
      if (!cancelled) { setItems(data); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [])

  const shown = items.slice(0, 3)
  const extra = items.length - shown.length

  return (
    <DashboardCard
      title={t('dashRequests')}
      icon={Inbox}
      action={items.length > 0 ? { label: t('dashReqViewAll'), onClick: () => onSectionChange('requests') } : undefined}
    >
      {loading ? (
        <div className="flex flex-col gap-3 pt-1">
          {[0, 1].map(i => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full animate-pulse flex-shrink-0" style={{ background: 'var(--side-row)' }} />
              <div className="flex-1 flex flex-col gap-1.5 pt-0.5">
                <div className="w-24 h-3 rounded animate-pulse" style={{ background: 'var(--side-row)' }} />
                <div className="w-full h-3 rounded animate-pulse" style={{ background: 'var(--side-row)' }} />
              </div>
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="text-xs pt-1" style={{ color: 'var(--ink-4)' }}>{t('dashReqEmpty')}</p>
      ) : (
        <div className="flex flex-col gap-3 pt-1">
          {shown.map(item => (
            <button
              key={item.message_id}
              type="button"
              className="flex items-start gap-3 text-left w-full hover:opacity-80 transition-opacity"
              onClick={() => onSectionChange('requests')}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white"
                style={{ background: 'var(--brand)' }}
              >
                {item.sender.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold truncate" style={{ color: 'var(--ink)' }}>
                    {item.sender.name}
                  </span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--ink-4)' }}>
                    {timeAgo(item.hours_since, t)}
                  </span>
                </div>
                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--ink-3)' }}>
                  {item.content}
                </p>
              </div>
            </button>
          ))}
          {extra > 0 && (
            <button
              type="button"
              onClick={() => onSectionChange('requests')}
              className="text-[11px] text-left transition-opacity hover:opacity-70 pt-0.5"
              style={{ color: 'var(--brand)' }}
            >
              +{extra} more
            </button>
          )}
        </div>
      )}
    </DashboardCard>
  )
}
