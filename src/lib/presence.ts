import type { PresenceStatus } from '../components/profile/StatusDot'

interface UserLike {
  id:               string
  is_bot?:          boolean | null
  presence_status?: PresenceStatus | string | null
}

export function getEffectiveStatus(
  user: UserLike,
  onlineIds: Set<string>,
): PresenceStatus {
  if (user.is_bot) return 'online'

  const dbStatus = (user.presence_status ?? 'online') as PresenceStatus

  if (dbStatus === 'dnd')     return 'dnd'
  if (dbStatus === 'away')    return 'away'
  if (dbStatus === 'offline') return 'offline'

  // DB says online but WebSocket disconnected → treat as offline
  if (!onlineIds.has(user.id)) return 'offline'

  return 'online'
}
