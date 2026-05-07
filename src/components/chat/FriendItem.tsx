import { Avatar } from '../ui/Avatar'
import { Cell } from '../ui/Cell'
import type { FriendProfile } from '../../services/friendsService'

interface Props {
  friend:        FriendProfile
  isOnline:      boolean
  onViewProfile: () => void
}

export function FriendItem({ friend, isOnline, onViewProfile }: Props) {
  const leading = (
    <div className="relative">
      <Avatar name={friend.name} avatarUrl={friend.avatar_url} avatarColor={friend.avatar_color} size="sm" />
      <span
        className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
        style={{
          background:  isOnline ? '#10B981' : 'var(--side-mute)',
          borderColor: 'var(--side-bg)',
        }}
      />
    </div>
  )

  return (
    <Cell
      variant="twoLined"
      leading={leading}
      title={friend.name}
      subtitle={friend.position ?? ''}
      onClick={onViewProfile}
    />
  )
}
