import { useState } from 'react'
import {
  MessageSquare, Users, CheckSquare, Inbox,
  Bell, Calendar, FolderOpen, Hash, Bot, Settings,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { Avatar } from '../ui/Avatar'
import { ProfileMenu } from './ProfileMenu'

export type Section =
  | 'chat' | 'members' | 'tasks' | 'requests'
  | 'announcements' | 'calendar' | 'files' | 'channels' | 'bots'
  | 'settings' | 'profile'

export const MOBILE_SECTIONS = new Set<Section>(['chat', 'members', 'tasks', 'requests'])

interface Props {
  activeSection:   Section
  onSectionChange: (s: Section) => void
  totalUnread:     number
  taskCount:       number
  requestCount:    number
  notifEnabled:    boolean
  onToggleNotif:   () => void
}

export function MenuRail({
  activeSection, onSectionChange,
  totalUnread, taskCount, requestCount,
  notifEnabled, onToggleNotif,
}: Props) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)

  const DAILY: { id: Section; Icon: React.ElementType; label: string; badge: number; badgeColor: string }[] = [
    { id: 'chat',     Icon: MessageSquare, label: t('tabChat'),     badge: totalUnread,  badgeColor: '#EF3F1A'      },
    { id: 'members',  Icon: Users,         label: t('tabFriends'),  badge: 0,            badgeColor: 'var(--brand)' },
    { id: 'tasks',    Icon: CheckSquare,   label: t('tabTasks'),    badge: taskCount,    badgeColor: 'var(--brand)' },
    { id: 'requests', Icon: Inbox,         label: t('tabRequests'), badge: requestCount, badgeColor: 'var(--brand)' },
  ]

  const PLACEHOLDER: { id: Section; Icon: React.ElementType; label: string }[] = [
    { id: 'announcements', Icon: Bell,       label: t('menuRailAnnouncements') },
    { id: 'calendar',      Icon: Calendar,   label: t('menuRailCalendar')      },
    { id: 'files',         Icon: FolderOpen, label: t('menuRailFiles')         },
    { id: 'channels',      Icon: Hash,       label: t('menuRailChannels')      },
    { id: 'bots',          Icon: Bot,        label: t('menuRailBots')          },
  ]

  return (
    <div className="flex flex-col h-full" style={{ width: 60, background: 'var(--side-bg)' }}>

      {/* Logo — sticky top */}
      <div className="flex items-center justify-center flex-shrink-0 pt-3 pb-2">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #EF3F1A, #B83113)' }}
        >
          <span className="text-white text-[12px] font-black tracking-tight leading-none">M</span>
        </div>
      </div>

      {/* Scrollable nav items */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden menu-rail-scroll flex flex-col items-center py-1">
        <div className="flex flex-col items-center gap-0.5 w-full">
          {DAILY.map(({ id, Icon, label, badge, badgeColor }) => (
            <RailBtn
              key={id}
              Icon={Icon}
              label={label}
              active={activeSection === id}
              badge={badge}
              badgeColor={badgeColor}
              onClick={() => onSectionChange(id)}
            />
          ))}
        </div>

        <div className="w-8 my-1.5 border-t flex-shrink-0" style={{ borderColor: 'var(--side-line)' }} />

        <div className="flex flex-col items-center gap-0.5 w-full">
          {PLACEHOLDER.map(({ id, Icon, label }) => (
            <RailBtn
              key={id}
              Icon={Icon}
              label={label}
              active={activeSection === id}
              muted
              onClick={() => onSectionChange(id)}
            />
          ))}
        </div>
      </div>

      {/* Sticky bottom — Settings + Profile */}
      <div
        className="flex-shrink-0 border-t flex flex-col items-center py-2 gap-0.5"
        style={{ borderColor: 'var(--side-line)' }}
      >
        <RailBtn
          Icon={Settings}
          label={t('menuRailSettings')}
          active={activeSection === 'settings'}
          onClick={() => onSectionChange('settings')}
        />

        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileMenuOpen(v => !v)}
            className="flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
            style={profileMenuOpen
              ? { background: 'var(--side-row)' }
              : { background: 'transparent' }
            }
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
            onMouseLeave={e => { if (!profileMenuOpen) e.currentTarget.style.background = 'transparent' }}
            title={profile?.name ?? 'Profile'}
            aria-label="프로필 메뉴"
          >
            {profile
              ? <Avatar name={profile.name} avatarUrl={profile.avatar_url} size="sm" />
              : <div className="w-8 h-8 rounded-full" style={{ background: 'var(--side-row)' }} />
            }
          </button>

          {profileMenuOpen && (
            <ProfileMenu
              notifEnabled={notifEnabled}
              onToggleNotif={onToggleNotif}
              onClose={() => setProfileMenuOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Rail icon button ─────────────────────────────── */
function RailBtn({
  Icon, label, active, badge, badgeColor, muted, onClick,
}: {
  Icon:        React.ElementType
  label:       string
  active:      boolean
  badge?:      number
  badgeColor?: string
  muted?:      boolean
  onClick:     () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors duration-100 mx-auto"
      style={{
        background: active ? 'var(--side-active)'      : 'transparent',
        color:      active ? 'var(--side-active-icon)' : 'var(--side-mute)',
        opacity:    muted && !active ? 0.45 : 1,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--side-hover)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <Icon size={18} />
      {badge !== undefined && badge > 0 && (
        <span
          className="absolute top-0 right-0 min-w-[14px] h-[14px] px-0.5 rounded-full
                     text-white text-[9px] font-bold flex items-center justify-center leading-none"
          style={{ background: badgeColor ?? 'var(--brand)' }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}
