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
      className={`
        w-full flex items-center gap-3 px-3 py-3 text-left
        transition-colors duration-100 border-b
        border-gray-100 dark:border-[#1f2c33]
        ${isSelected
          ? 'bg-gray-100 dark:bg-surface-hover'
          : 'hover:bg-gray-50 dark:hover:bg-[#1f2c33]'
        }
      `}
    >
      {/* 아바타 */}
      <div className="flex-shrink-0">
        {room.room_type === 'group' ? (
          <div className="w-10 h-10 rounded-full bg-mtl-slate dark:bg-surface-hover
                          flex items-center justify-center">
            <Users size={18} className="text-gray-400 dark:text-[#8696a0]" />
          </div>
        ) : (
          <Avatar name={avatar.name} avatarUrl={avatar.avatarUrl} size="md" />
        )}
      </div>

      {/* 텍스트 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-1">
          <span className="text-sm font-semibold truncate text-gray-900 dark:text-[#e9edef]">
            {displayName}
          </span>
          <span className={`text-[11px] flex-shrink-0 ${
            unread > 0
              ? 'text-accent dark:text-accent font-semibold'
              : 'text-gray-400 dark:text-[#8696a0]'
          }`}>
            {formatRoomTime(room.last_message_at)}
          </span>
        </div>

        <div className="flex items-center justify-between mt-0.5 gap-1">
          <p className="text-xs truncate text-gray-400 dark:text-[#8696a0]">
            {room.last_message ?? <span className="italic">메시지 없음</span>}
          </p>
          {unread > 0 && (
            <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1
                             rounded-full bg-accent text-white
                             text-[10px] font-bold flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
