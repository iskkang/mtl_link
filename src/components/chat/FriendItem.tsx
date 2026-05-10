import { Avatar } from '../ui/Avatar'
import { Cell } from '../ui/Cell'
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
        size="sm"
      />
      <span className="absolute -bottom-0.5 -right-0.5">
        <StatusDot status={effectiveStatus} size={10} showOffline />
      </span>
    </div>
  )

  return (
    <Cell
      variant="twoLined"
      leading={leading}
      title={friend.name}
      subtitle={friend.status_message || friend.position || ''}
      onClick={onViewProfile}
    />
  )
}
