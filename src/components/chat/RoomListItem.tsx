import { Users } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { formatRoomTime } from '../../lib/date'
import { getRoomDisplayName, getRoomAvatarInfo } from '../../services/roomService'
import type { RoomListItem } from '../../types/chat'

interface Props {
  room:          RoomListItem
  isSelected:    boolean
  currentUserId: string
  onClick:       () => void
}

export function RoomListItemView({ room, isSelected, currentUserId, onClick }: Props) {
  const displayName = getRoomDisplayName(room, currentUserId)
  const avatar      = getRoomAvatarInfo(room, currentUserId)
  const unread      = room.unread_count ?? 0

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 text-left transition-colors duration-100 border-b"
      style={{
        background: isSelected ? 'var(--side-active)' : 'transparent',
        borderColor: 'var(--side-line)',
      }}
      onMouseEnter={e => {
        if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--side-row)'
      }}
      onMouseLeave={e => {
        if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
      }}
    >
      {/* 아바타 */}
      <div className="flex-shrink-0">
        {room.room_type === 'group' ? (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
          >
            <Users size={16} className="text-white" />
          </div>
        ) : (
          <Avatar name={avatar.name} avatarUrl={avatar.avatarUrl} size="md" />
        )}
      </div>

      {/* 텍스트 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-1">
          <span
            className="text-sm font-semibold truncate"
            style={{ color: 'var(--side-text)' }}
          >
            {displayName}
          </span>
          <span
            className={`text-[10px] flex-shrink-0 font-mono-ui`}
            style={{ color: unread > 0 ? 'var(--blue)' : 'var(--side-mute)', fontWeight: unread > 0 ? 600 : 400 }}
          >
            {formatRoomTime(room.last_message_at)}
          </span>
        </div>

        <div className="flex items-center justify-between mt-0.5 gap-1">
          <p
            className="text-xs truncate"
            style={{ color: 'var(--side-mute)', fontWeight: unread > 0 ? 500 : 400 }}
          >
            {room.last_message ?? <span className="italic">메시지 없음</span>}
          </p>
          {unread > 0 && (
            <span
              className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full
                         text-white text-[10px] font-bold flex items-center justify-center"
              style={{ background: 'var(--blue)' }}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
