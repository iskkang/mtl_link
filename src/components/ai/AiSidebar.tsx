import { Plus, MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAiConversations } from '../../hooks/useAiConversations'

interface Props {
  onNewChat: () => void
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function AiSidebar({ onNewChat }: Props) {
  const { t } = useTranslation()
  const { conversations, loading } = useAiConversations()

  const todayMs      = startOfDay(new Date())
  const yesterdayMs  = todayMs - 86_400_000
  const prev7Ms      = todayMs - 7  * 86_400_000
  const prev30Ms     = todayMs - 30 * 86_400_000

  function groupKey(created_at: string): string | null {
    const ms = startOfDay(new Date(created_at))
    if (ms >= todayMs)     return 'today'
    if (ms >= yesterdayMs) return 'yesterday'
    if (ms >= prev7Ms)     return 'prev7'
    if (ms >= prev30Ms)    return 'prev30'
    return null
  }

  const groups: { key: string; label: string }[] = [
    { key: 'today',     label: t('aiToday')     },
    { key: 'yesterday', label: t('aiYesterday') },
    { key: 'prev7',     label: t('aiPrev7Days') },
    { key: 'prev30',    label: t('aiPrev30Days') },
  ]

  const byGroup = conversations.reduce<Record<string, typeof conversations>>((acc, c) => {
    const k = groupKey(c.created_at)
    if (!k) return acc
    ;(acc[k] ??= []).push(c)
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full">
      {/* New chat button */}
      <div className="px-3 py-2 flex-shrink-0">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
                     text-sm font-semibold text-white transition-colors"
          style={{ background: 'var(--brand)' }}
          onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
          onMouseLeave={e => (e.currentTarget.style.filter = '')}
        >
          <Plus size={15} />
          {t('aiNewChat')}
        </button>
      </div>

      {/* Recent conversations */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-2 px-3 py-2">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="h-8 rounded-lg animate-pulse"
                style={{ background: 'var(--side-row)' }}
              />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center gap-3">
            <MessageSquare size={28} style={{ color: 'var(--side-mute)' }} />
            <p className="text-xs" style={{ color: 'var(--side-mute)' }}>
              {t('aiNoHistory')}
            </p>
          </div>
        ) : (
          groups.map(({ key, label }) => {
            const items = byGroup[key]
            if (!items?.length) return null
            return (
              <div key={key}>
                <p
                  className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--ink-4)' }}
                >
                  {label}
                </p>
                {items.map(conv => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={onNewChat}
                    className="w-full px-4 py-2 text-left text-sm truncate transition-colors"
                    style={{ color: 'var(--side-text)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    title={conv.question ?? ''}
                  >
                    {(conv.question ?? '').slice(0, 32) || '…'}
                  </button>
                ))}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
