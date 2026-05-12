import { ChevronDown, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { CountryFlag, getOfficeLabel } from '../../lib/country/flags'

const PRESENCE_COLOR: Record<string, string> = {
  online:  '#1D9E75',
  away:    '#F59E0B',
  dnd:     '#EF4444',
  offline: '#9CA3AF',
}

export function WorkspaceHeader() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  if (!profile) return null

  const dept      = profile.department ?? ''
  const initial   = (dept[0] ?? 'M').toUpperCase()
  const dotColor  = PRESENCE_COLOR[profile.presence_status ?? 'online'] ?? '#1D9E75'

  return (
    <div
      className="px-4 py-3 flex-shrink-0 border-b"
      style={{ borderColor: 'var(--side-line)' }}
    >
      <div className="flex items-center justify-between gap-2">

        {/* Logo block + flag badge */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex-shrink-0">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold text-[14px]"
              style={{ background: '#185FA5' }}
            >
              {initial}
            </div>
            <div
              className="absolute -bottom-[3px] -right-[3px] w-[18px] h-[18px] bg-white
                         rounded-full flex items-center justify-center overflow-hidden"
              style={{ boxShadow: '0 0 0 1.5px white, 0 0 0 2.5px var(--side-line)' }}
            >
              <CountryFlag code={dept} size={13} />
            </div>
          </div>

          {/* Office label + name / status */}
          <div className="min-w-0">
            <div className="flex items-center gap-0.5">
              <span
                className="text-[14px] font-semibold truncate"
                style={{ color: 'var(--side-text)' }}
              >
                {getOfficeLabel(dept)}
              </span>
              <ChevronDown size={12} style={{ color: 'var(--side-mute)', flexShrink: 0 }} />
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] truncate" style={{ color: 'var(--side-mute)' }}>
                {profile.name}
              </span>
              <span
                className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                style={{ background: dotColor }}
                title={t('statusOnline')}
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          className="flex-shrink-0 p-1 rounded transition-colors"
          style={{ color: 'var(--side-mute)' }}
          aria-label={t('editProfile')}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--side-text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--side-mute)')}
        >
          <Pencil size={14} />
        </button>
      </div>
    </div>
  )
}
