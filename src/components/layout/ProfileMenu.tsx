import { useRef, useEffect, useState } from 'react'
import { LogOut, Sun, Moon, Bell, BellOff, KeyRound, UserRound, Settings2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../contexts/ThemeContext'
import { useUserStatus } from '../../hooks/useUserStatus'
import { Avatar } from '../ui/Avatar'
import { SUPPORTED_LANGS, saveLanguage, type LangCode } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import { NotificationSettingsModal } from '../ui/NotificationSettingsModal'
import { StatusDropdown } from '../profile/StatusDropdown'

interface Props {
  notifEnabled:  boolean
  onToggleNotif: () => void
  onClose:       () => void
  onEditProfile: () => void
}

export function ProfileMenu({ notifEnabled, onToggleNotif, onClose, onEditProfile }: Props) {
  const { t, i18n } = useTranslation()
  const { profile, user, signOut } = useAuth()
  const { mode, toggle: toggleTheme } = useTheme()
  const { status, setStatus } = useUserStatus()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const [notifOpen, setNotifOpen] = useState(false)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleLangSelect = async (code: LangCode) => {
    await i18n.changeLanguage(code)
    saveLanguage(code)
    if (user) {
      supabase.from('profiles').update({ preferred_language: code }).eq('id', user.id).then(() => {})
    }
  }

  const handleSignOut = async () => {
    onClose()
    await signOut()
  }

  const handleChangePw = () => {
    onClose()
    navigate('/change-password')
  }

  if (!profile) return null

  return (
    <div
      ref={ref}
      className="absolute left-[68px] bottom-0 z-[100] w-64 rounded-2xl border shadow-xl overflow-hidden"
      style={{
        background:   'var(--card)',
        borderColor:  'var(--line)',
        boxShadow:    'var(--shadow-lg)',
      }}
    >
      {/* Profile header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b"
        style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
      >
        <Avatar name={profile.name} avatarUrl={profile.avatar_url} avatarColor={profile.avatar_color} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
            {profile.name}
          </p>
          {(profile.department || profile.position) && (
            <p className="text-xs truncate" style={{ color: 'var(--ink-3)' }}>
              {[profile.department, profile.position].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {/* Status picker */}
      <div className="border-b" style={{ borderColor: 'var(--line)' }}>
        <p
          className="px-4 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--ink-4)' }}
        >
          {t('myStatus')}
        </p>
        <StatusDropdown current={status} onSelect={setStatus} />
      </div>

      <div className="py-1">
        {/* Profile edit */}
        <MenuRow
          icon={<UserRound size={15} />}
          label={t('profileEdit')}
          onClick={onEditProfile}
        />

        {/* Theme toggle */}
        <MenuRow
          icon={mode === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          label={t(mode === 'dark' ? 'chatHeaderLightMode' : 'chatHeaderDarkMode')}
          onClick={toggleTheme}
        />

        {/* Notification toggle */}
        <MenuRow
          icon={notifEnabled ? <Bell size={15} /> : <BellOff size={15} />}
          label={notifEnabled ? t('notifOn') : t('notifOff')}
          onClick={onToggleNotif}
        />
        <MenuRow
          icon={<Settings2 size={15} />}
          label={t('notifSettings')}
          onClick={() => setNotifOpen(true)}
        />
      </div>

      {/* Language picker */}
      <div className="border-t" style={{ borderColor: 'var(--line)' }}>
        <p
          className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--ink-4)' }}
        >
          언어 / Language
        </p>
        <div className="grid grid-cols-3 gap-0.5 px-2 pb-2">
          {SUPPORTED_LANGS.map(lang => {
            const isActive = i18n.language.startsWith(lang.code)
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleLangSelect(lang.code)}
                className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] transition-colors"
                style={{
                  background: isActive ? 'rgba(51,144,236,0.10)' : 'transparent',
                  color:      isActive ? 'var(--brand)'          : 'var(--ink-3)',
                  fontWeight: isActive ? 600                     : 400,
                  border:     isActive ? '1px solid rgba(51,144,236,0.25)' : '1px solid transparent',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                <span className="text-base leading-none">{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Change password + Logout */}
      <div className="border-t py-1" style={{ borderColor: 'var(--line)' }}>
        <MenuRow
          icon={<KeyRound size={15} />}
          label={t('morePw')}
          onClick={handleChangePw}
        />
        <MenuRow
          icon={<LogOut size={15} />}
          label={t('pendingLogout')}
          onClick={handleSignOut}
          danger
        />
      </div>

      {notifOpen && <NotificationSettingsModal onClose={() => setNotifOpen(false)} />}
    </div>
  )
}

function MenuRow({
  icon, label, onClick, danger,
}: {
  icon:    React.ReactNode
  label:   string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
      style={{ color: danger ? 'var(--red)' : 'var(--ink)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
