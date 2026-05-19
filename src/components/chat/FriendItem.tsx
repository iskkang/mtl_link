import { Avatar } from '../ui/Avatar'
import { StatusDot } from '../profile/StatusDot'
import type { PresenceStatus } from '../profile/StatusDot'
import type { FriendProfile } from '../../services/friendsService'

interface Props {
  friend:          FriendProfile
  effectiveStatus: PresenceStatus
  onViewProfile:   () => void
}

export function FriendItem({ friend, effectiveStatus, onViewProfile }: Props) {
  const leading = (
    <div className="relative">
      <Avatar
        name={friend.name}
        avatarUrl={friend.avatar_url}
        avatarColor={friend.avatar_color}
        size="xs"
      />
      <span className="absolute -bottom-0.5 -right-0.5">
        <StatusDot status={effectiveStatus} size={10} showOffline />
      </span>
    </div>
  )

  return (
    <button
      type="button"
      onClick={onViewProfile}
      className="w-full flex items-center gap-2 pl-4 pr-3 py-1.5 text-left transition-colors hover:bg-surfaceLight-hover dark:hover:bg-surface-hover"
    >
      {leading}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] truncate" style={{ color: 'var(--text-primary)' }}>
          {friend.name}
        </p>
        {(friend.status_message || friend.position) && (
          <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>
            {friend.status_message || friend.position}
          </p>
        )}
      </div>
    </button>
  )
}
