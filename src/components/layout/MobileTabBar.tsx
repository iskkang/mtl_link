import { MessageSquare, Users, CheckSquare, Inbox, MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SidebarTab } from '../chat/SidebarTabs'

interface Props {
  activeTab:    SidebarTab
  onTabChange:  (tab: SidebarTab) => void
  totalUnread:  number
  taskCount:    number
  requestCount: number
  onMoreClick:  () => void
}

export function MobileTabBar({
  activeTab, onTabChange,
  totalUnread, taskCount, requestCount,
  onMoreClick,
}: Props) {
  const { t } = useTranslation()

  const TABS: { id: SidebarTab; Icon: React.ElementType; label: string; badge: number; red?: boolean }[] = [
    { id: 'chat',     Icon: MessageSquare, label: t('tabChat'),     badge: totalUnread,  red: true },
    { id: 'members',  Icon: Users,         label: t('tabFriends'),  badge: 0                      },
    { id: 'tasks',    Icon: CheckSquare,   label: t('tabTasks'),    badge: taskCount              },
    { id: 'requests', Icon: Inbox,         label: t('tabRequests'), badge: requestCount           },
  ]

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40"
      style={{
        background:    'var(--side-bg)',
        borderTop:     '1px solid var(--side-line)',
        height:        'calc(56px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        display:       'flex',
      }}
    >
      {TABS.map(({ id, Icon, label, badge, red }) => {
        const isActive = activeTab === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
            style={{ color: isActive ? 'var(--brand)' : 'var(--side-mute)' }}
          >
            <div className="relative">
              <Icon size={22} />
              {badge > 0 && (
                <span
                  className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-0.5
                             rounded-full text-white text-[9px] font-bold
                             flex items-center justify-center leading-none"
                  style={{ background: red ? '#EF3F1A' : 'var(--brand)' }}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </div>
            <span
              className="text-[10px] leading-none"
              style={{ fontWeight: isActive ? 600 : 400 }}
            >
              {label}
            </span>
          </button>
        )
      })}

      {/* More */}
      <button
        type="button"
        onClick={onMoreClick}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
        style={{ color: 'var(--side-mute)' }}
      >
        <MoreHorizontal size={22} />
        <span className="text-[10px] leading-none">{t('moreTab')}</span>
      </button>
    </nav>
  )
}
