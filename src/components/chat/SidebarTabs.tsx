import { MessageSquare, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type SidebarTab = 'chat' | 'friends'

interface Props {
  active:      SidebarTab
  onChange:    (tab: SidebarTab) => void
  totalUnread?: number
}

export function SidebarTabs({ active, onChange, totalUnread = 0 }: Props) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-shrink-0 border-b" style={{ borderColor: 'var(--side-line)' }}>
      {(['chat', 'friends'] as const).map(tab => {
        const isActive = active === tab
        const Icon     = tab === 'chat' ? MessageSquare : Users
        const label    = tab === 'chat' ? t('tabChat') : t('tabFriends')
        const badge    = tab === 'chat' && totalUnread > 0 ? totalUnread : 0
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5
                       text-sm font-semibold border-b-2 transition-colors"
            style={{
              borderColor: isActive ? 'var(--blue)' : 'transparent',
              color: isActive ? 'var(--side-text)' : 'var(--side-mute)',
            }}
            onMouseEnter={e => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--side-text)'
            }}
            onMouseLeave={e => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--side-mute)'
            }}
          >
            <Icon size={15} />
            {label}
            {badge > 0 && (
              <span
                className="min-w-[18px] h-[18px] px-1 rounded-full
                           text-white text-[10px] font-bold
                           flex items-center justify-center leading-none"
                style={{ background: '#EF3F1A' }}
              >
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
