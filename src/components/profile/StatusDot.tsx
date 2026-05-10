import type { Database } from '../../types/database'

export type PresenceStatus = Database['public']['Tables']['profiles']['Row']['presence_status']

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online:  '#22c55e',
  away:    '#eab308',
  dnd:     '#ef4444',
  offline: '#9ca3af',
}

interface Props {
  status:       PresenceStatus
  size?:        number
  className?:   string
  showOffline?: boolean
}

export function StatusDot({
  status,
  size = 8,
  className = '',
  showOffline = false,
}: Props) {
  if (status === 'offline' && !showOffline) return null

  return (
    <span
      className={`inline-block rounded-full flex-shrink-0 ${className}`}
      style={{
        width:      size,
        height:     size,
        background: STATUS_COLOR[status],
        border:     '1.5px solid var(--card)',
      }}
    />
  )
}
