import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Sun, Moon, Bell, BellOff, Globe, KeyRound, LogOut,
  Megaphone, Calendar, FolderOpen, Hash, Bot, ChevronRight,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../hooks/useAuth'
import { SUPPORTED_LANGS } from '../../lib/i18n'
import { Avatar } from '../ui/Avatar'
import { LanguagePickerModal } from '../ui/LanguagePickerModal'
import type { Section } from './MenuRail'

interface Props {
  open:            boolean
  onClose:         () => void
  onSectionChange: (s: Section) => void
  notifEnabled:    boolean
  onToggleNotif:   () => void
}

const INFO_ITEMS: { id: Section; Icon: React.ElementType; labelKey: string }[] = [
  { id: 'announcements', Icon: Megaphone,  labelKey: 'menuRailAnnouncements' },
  { id: 'calendar',      Icon: Calendar,   labelKey: 'menuRailCalendar'      },
  { id: 'files',         Icon: FolderOpen, labelKey: 'menuRailFiles'         },
  { id: 'channels',      Icon: Hash,       labelKey: 'menuRailChannels'      },
  { id: 'bots',          Icon: Bot,        labelKey: 'menuRailBots'          },
]

export function MoreSheet({ open, onClose, onSectionChange, notifEnabled, onToggleNotif }: Props) {
  const { t, i18n } = useTranslation()
  const { mode, toggle: toggleTheme } = useTheme()
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [langOpen, setLangOpen] = useState(false)

  const currentLang = SUPPORTED_LANGS.find(l => i18n.language.startsWith(l.code))

  const handleSectionClick = (s: Section) => {
    onSectionChange(s)
    onClose()
  }

  const handleChangePw = () => {
    onClose()
    navigate('/change-password')
  }

  const handleSignOut = async () => {
    onClose()
    await signOut()
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[49] bg-black/50 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 rounded-t-2xl flex flex-col
          transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          background: 'var(--card)',
          maxHeight:  '88dvh',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background: 'var(--line)' }} />
        </div>

        {/* Profile header */}
        <div
          className="flex items-center gap-3 px-4 py-3 flex-shrink-0 border-b"
          style={{ borderColor: 'var(--line)' }}
        >
          {profile && <Avatar name={profile.name} avatarUrl={profile.avatar_url} size="md" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
              {profile?.name ?? ''}
            </p>
            {(profile?.department || profile?.position) && (
              <p className="text-xs truncate" style={{ color: 'var(--ink-3)' }}>
                {[profile?.department, profile?.position].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg flex-shrink-0 transition-colors"
            style={{ color: 'var(--ink-3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Info section */}
          <SectionLabel label={t('moreInfo')} />
          {INFO_ITEMS.map(({ id, Icon, labelKey }) => (
            <SheetRow
              key={id}
              icon={<Icon size={18} />}
              label={t(labelKey)}
              onClick={() => handleSectionClick(id)}
              right={<ChevronRight size={15} />}
              muted
            />
          ))}

          {/* Settings section */}
          <div className="border-t mt-1" style={{ borderColor: 'var(--line)' }} />
          <SectionLabel label={t('moreSettings')} />
          <SheetRow
            icon={mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            label={t('chatHeaderTheme')}
            onClick={toggleTheme}
            right={
              <span className="text-xs" style={{ color: 'var(--ink-3)' }}>
                {mode === 'dark' ? t('chatHeaderDarkMode') : t('chatHeaderLightMode')}
              </span>
            }
          />
          <SheetRow
            icon={notifEnabled ? <Bell size={18} /> : <BellOff size={18} />}
            label={t('chatHeaderNotifications')}
            onClick={onToggleNotif}
            right={
              <span className="text-xs" style={{ color: 'var(--ink-3)' }}>
                {notifEnabled ? t('chatHeaderNotificationsOn') : t('chatHeaderNotificationsOff')}
              </span>
            }
          />
          <SheetRow
            icon={<Globe size={18} />}
            label={t('chatHeaderLanguage')}
            onClick={() => setLangOpen(true)}
            right={
              <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--ink-3)' }}>
                {currentLang?.flag}
                <ChevronRight size={15} />
              </span>
            }
          />
          <SheetRow
            icon={<KeyRound size={18} />}
            label={t('morePw')}
            onClick={handleChangePw}
            right={<ChevronRight size={15} />}
            muted
          />

          {/* Logout */}
          <div className="border-t my-1" style={{ borderColor: 'var(--line)' }} />
          <SheetRow
            icon={<LogOut size={18} />}
            label={t('moreLogout')}
            onClick={handleSignOut}
            danger
          />
        </div>
      </div>

      {langOpen && <LanguagePickerModal onClose={() => setLangOpen(false)} />}
    </>,
    document.body,
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p
      className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider"
      style={{ color: 'var(--ink-4)' }}
    >
      {label}
    </p>
  )
}

function SheetRow({
  icon, label, onClick, right, danger, muted,
}: {
  icon:    React.ReactNode
  label:   string
  onClick: () => void
  right?:  React.ReactNode
  danger?: boolean
  muted?:  boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 transition-colors"
      style={{ color: danger ? 'var(--red)' : 'var(--ink)', minHeight: 52 }}
      onMouseEnter={e => (e.currentTarget.style.background = danger ? 'rgba(239,63,26,0.06)' : 'var(--bg)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ color: danger ? 'var(--red)' : muted ? 'var(--ink-3)' : 'var(--ink-2)', display: 'flex', flexShrink: 0 }}>
        {icon}
      </span>
      <span className="flex-1 text-left text-sm">{label}</span>
      {right && (
        <span style={{ color: 'var(--ink-3)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {right}
        </span>
      )}
    </button>
  )
}
