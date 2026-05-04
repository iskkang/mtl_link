import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Inbox } from 'lucide-react'
import { DashboardCard } from './DashboardCard'
import { getReceivedRequests } from '../../services/requestService'
import { translateMessage } from '../../services/translationService'
import { useAuth } from '../../hooks/useAuth'
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
  const { profile } = useAuth()
  const [items,        setItems]        = useState<RequestItem[]>([])
  const [loading,      setLoading]      = useState(true)
  const [translated,   setTranslated]   = useState<Map<string, string>>(new Map())

  const myLang = profile?.preferred_language ?? 'ko'

  useEffect(() => {
    let cancelled = false

    getReceivedRequests().then(async data => {
      if (cancelled) return
      setItems(data)
      setLoading(false)

      // 번역이 필요한 항목만 처리 (병렬)
      // - myLang이 'ko'면 번역 불필요 (한국어 사용자 or 언어 미설정)
      // - source_language가 null인 메시지는 'ko'로 간주 (레거시 메시지 대응)
      const effectiveSrc = (item: RequestItem) => item.source_language ?? 'ko'

      const needsTranslation = myLang === 'ko' ? [] : data.filter(
        item => item.content && effectiveSrc(item) !== myLang,
      )

      const results = await Promise.allSettled(
        needsTranslation.map(async item => {
          // DB 캐시 우선
          const cached = item.translations.find(tr => tr.language === myLang)
          if (cached) return { id: item.message_id, text: cached.translated_text }

          // Edge Function 호출
          const text = await translateMessage({
            message_id:      item.message_id,
            room_id:         item.room_id,
            source_text:     item.content,
            source_language: effectiveSrc(item),
            target_language: myLang,
          })
          return { id: item.message_id, text }
        }),
      )

      if (cancelled) return

      setTranslated(prev => {
        const next = new Map(prev)
        for (const r of results) {
          if (r.status === 'fulfilled') next.set(r.value.id, r.value.text)
        }
        return next
      })
    })

    return () => { cancelled = true }
  }, [myLang])

  return (
    <DashboardCard
      title={t('dashRequests')}
      icon={Inbox}
      badge={items.length > 0 ? items.length : undefined}
      action={items.length > 0 ? { label: t('dashReqViewAll'), onClick: () => onSectionChange('requests') } : undefined}
      scrollable
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
      ) : items.length === 0 ? (
        <p className="text-xs pt-1" style={{ color: 'var(--ink-4)' }}>{t('dashReqEmpty')}</p>
      ) : (
        <div className="flex flex-col gap-3 pt-1">
          {items.map(item => {
            const displayContent = translated.get(item.message_id) ?? item.content
            return (
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
                    {displayContent}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </DashboardCard>
  )
}
