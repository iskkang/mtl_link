import { useEffect, useRef, useState } from 'react'
import { MoreVertical, Sun, Moon, Bell, BellOff, Globe, LogOut, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../contexts/ThemeContext'
import { SUPPORTED_LANGS } from '../../lib/i18n'
import { LanguagePickerModal } from '../ui/LanguagePickerModal'

interface Props {
  notifEnabled:    boolean
  onToggleNotif:   () => void
  isOwner:         boolean
  isDirect:        boolean
  isAnnouncement?: boolean
  onLeave:         () => void
  onDelete:        () => void
}

export function ChatHeaderMenu({
  notifEnabled, onToggleNotif,
  isOwner, isDirect, isAnnouncement, onLeave, onDelete,
}: Props) {
  const { t, i18n } = useTranslation()
  const { mode, toggle: toggleTheme } = useTheme()
  const [open, setOpen]         = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const currentLang = SUPPORTED_LANGS.find(l => i18n.language.startsWith(l.code))

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="p-2 rounded-lg transition-colors"
        style={{ color: open ? 'var(--brand)' : 'var(--ink-3)', background: 'transparent' }}
        onMouseEnter={e => { if (!open) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)' }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        aria-label="채팅 메뉴"
      >
        <MoreVertical size={18} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-xl py-1 text-sm border"
          style={{
            background:  'var(--card)',
            borderColor: 'var(--line)',
            boxShadow:   'var(--shadow-lg)',
          }}
        >
          {/* Section 1: App settings */}
          <MenuRow
            icon={mode === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            label={t('chatHeaderTheme')}
            value={mode === 'dark' ? t('chatHeaderDarkMode') : t('chatHeaderLightMode')}
            onClick={toggleTheme}
          />
          <MenuRow
            icon={notifEnabled ? <Bell size={15} /> : <BellOff size={15} />}
            label={t('chatHeaderNotifications')}
            value={notifEnabled ? t('chatHeaderNotificationsOn') : t('chatHeaderNotificationsOff')}
            onClick={onToggleNotif}
          />

          {/* Language — mobile only (desktop has ProfileMenu) */}
          <div className="md:hidden">
            <MenuRow
              icon={<Globe size={15} />}
              label={t('chatHeaderLanguage')}
              value={currentLang ? `${currentLang.flag} ${currentLang.label}` : ''}
              onClick={() => { setOpen(false); setLangOpen(true) }}
            />
          </div>

          {/* Divider */}
          <div className="my-1 border-t" style={{ borderColor: 'var(--line)' }} />

          {/* Section 2: Room actions (danger zone) */}
          {!isAnnouncement && (
            <MenuRow
              icon={<LogOut size={15} />}
              label={t('roomLeave')}
              onClick={() => { setOpen(false); onLeave() }}
              danger
            />
          )}
          {!isDirect && isOwner && (
            <MenuRow
              icon={<Trash2 size={15} />}
              label={t('roomDelete')}
              onClick={() => { setOpen(false); onDelete() }}
              danger
            />
          )}
        </div>
      )}

      {langOpen && <LanguagePickerModal onClose={() => setLangOpen(false)} />}
    </div>
  )
}

function MenuRow({
  icon, label, value, onClick, danger,
}: {
  icon:    React.ReactNode
  label:   string
  value?:  string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
      style={{ color: danger ? 'var(--red)' : 'var(--ink)' }}
      onMouseEnter={e => (e.currentTarget.style.background = danger ? 'rgba(239,63,26,0.06)' : 'var(--bg)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ color: danger ? 'var(--red)' : 'var(--ink-3)', display: 'flex' }}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {value && (
        <span className="text-xs flex-shrink-0" style={{ color: 'var(--ink-3)' }}>{value}</span>
      )}
    </button>
  )
}
