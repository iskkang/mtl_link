import { MessageSquare, Users, CheckSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type SidebarTab = 'chat' | 'friends' | 'tasks'

interface Props {
  active:       SidebarTab
  onChange:     (tab: SidebarTab) => void
  totalUnread?: number
  taskCount?:   number
}

export function SidebarTabs({ active, onChange, totalUnread = 0, taskCount = 0 }: Props) {
  const { t } = useTranslation()

  const tabs: { id: SidebarTab; Icon: React.ElementType; label: string; badge: number }[] = [
    { id: 'chat',    Icon: MessageSquare, label: t('tabChat'),    badge: totalUnread },
    { id: 'friends', Icon: Users,         label: t('tabFriends'), badge: 0 },
    { id: 'tasks',   Icon: CheckSquare,   label: t('tabTasks'),   badge: taskCount },
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
                style={{ background: id === 'chat' ? '#EF3F1A' : 'var(--blue)' }}
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
