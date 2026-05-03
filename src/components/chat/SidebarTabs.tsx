import { MessageSquare, Users, CheckSquare, Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type SidebarTab = 'chat' | 'members' | 'tasks' | 'requests'

interface Props {
  active:         SidebarTab
  onChange:       (tab: SidebarTab) => void
  totalUnread?:   number
  taskCount?:     number
  requestCount?:  number
}

export function SidebarTabs({ active, onChange, totalUnread = 0, taskCount = 0, requestCount = 0 }: Props) {
  const { t } = useTranslation()

  const tabs: { id: SidebarTab; Icon: React.ElementType; label: string; badge: number }[] = [
    { id: 'chat',     Icon: MessageSquare, label: t('tabChat'),     badge: totalUnread  },
    { id: 'members',  Icon: Users,         label: t('tabFriends'),  badge: 0            },
    { id: 'tasks',    Icon: CheckSquare,   label: t('tabTasks'),    badge: taskCount    },
    { id: 'requests', Icon: Inbox,         label: t('tabRequests'), badge: requestCount },
  ]

  return (
    <div className="flex flex-shrink-0 border-b" style={{ borderColor: 'var(--side-line)' }}>
      {tabs.map(({ id, Icon, label, badge }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className="flex-1 flex items-center justify-center gap-1 py-2.5
                       text-xs font-semibold border-b-2 transition-colors"
            style={{
              borderColor: isActive ? 'var(--brand)' : 'transparent',
              color: isActive ? 'var(--side-text)' : 'var(--side-mute)',
            }}
            onMouseEnter={e => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--side-text)'
            }}
            onMouseLeave={e => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--side-mute)'
            }}
          >
            <Icon size={14} />
            {label}
            {badge > 0 && (
              <span
                className="min-w-[16px] h-[16px] px-1 rounded-full
                           text-white text-[9px] font-bold
                           flex items-center justify-center leading-none"
                style={{ background: id === 'chat' ? '#EF3F1A' : 'var(--brand)' }}
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
