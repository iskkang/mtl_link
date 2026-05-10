import { useTranslation } from 'react-i18next'
import type { Database } from '../../types/database'

export type PresenceStatus = Database['public']['Tables']['profiles']['Row']['presence_status']

export const STATUS_OPTIONS: { value: PresenceStatus; color: string; labelKey: string }[] = [
  { value: 'online',  color: '#22C55E', labelKey: 'statusOnline'  },
  { value: 'away',    color: '#F59E0B', labelKey: 'statusAway'    },
  { value: 'dnd',     color: '#EF4444', labelKey: 'statusDnd'     },
  { value: 'offline', color: '#9CA3AF', labelKey: 'statusOffline' },
]

interface DropdownProps {
  current:  PresenceStatus
  onSelect: (s: PresenceStatus) => void
}

export function StatusDropdown({ current, onSelect }: DropdownProps) {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-4 gap-1 px-3 py-2">
      {STATUS_OPTIONS.map(({ value, color, labelKey }) => {
        const active = current === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            className="flex flex-col items-center gap-1.5 py-2 px-1 rounded-xl text-[10px] transition-colors"
            style={{
              background: active ? 'var(--bg)' : 'transparent',
              color:      active ? 'var(--ink)' : 'var(--ink-3)',
              fontWeight: active ? 600 : 400,
              border:     `1.5px solid ${active ? color : 'transparent'}`,
            }}
            onMouseEnter={e => {
              if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)'
            }}
            onMouseLeave={e => {
              if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            }}
          >
            <span
              className="rounded-full flex-shrink-0"
              style={{ width: 10, height: 10, background: color }}
            />
            <span className="leading-tight text-center">{t(labelKey)}</span>
          </button>
        )
      })}
    </div>
  )
}

export function StatusDot({
  status,
  size = 10,
  className = '',
}: {
  status: PresenceStatus
  size?: number
  className?: string
}) {
  const color = STATUS_OPTIONS.find(o => o.value === status)?.color ?? '#9CA3AF'
  return (
    <span
      className={`rounded-full flex-shrink-0 block ${className}`}
      style={{ width: size, height: size, background: color }}
    />
  )
}
