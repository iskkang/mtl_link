import { useTranslation } from 'react-i18next'
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
  const { i18n } = useTranslation()
  const rawName     = getRoomDisplayName(room, currentUserId)
  const displayName = room.room_type === 'channel' ? `#${rawName}` : rawName
  const avatar      = getRoomAvatarInfo(room, currentUserId)
  const unread      = room.unread_count ?? 0

  return (
    <button
      onClick={onClick}
      className="ui-cell w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-100"
      style={{
        background: isSelected ? 'var(--side-active)' : 'transparent',
      }}
      onMouseEnter={e => {
        if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--side-hover)'
      }}
      onMouseLeave={e => {
        if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
      }}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {room.room_type === 'channel' ? (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[18px] font-bold flex-shrink-0"
            style={{
              background: room.is_announcement
                ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                : 'linear-gradient(135deg, #3B82F6, #6366F1)',
              color: 'white',
            }}
          >
            #
          </div>
        ) : room.room_type === 'group' ? (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
          >
            {(room.name ?? '그룹').slice(0, 2)}
          </div>
        ) : (
          <Avatar name={avatar.name} avatarUrl={avatar.avatarUrl} avatarColor={avatar.avatarColor} size="md" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-1">
          <span
            className="text-headline-2 truncate"
            style={{ color: isSelected ? 'var(--side-active-text)' : 'var(--side-text)' }}
          >
            {displayName}
          </span>
          <span
            className="text-caption-2 flex-shrink-0 font-mono-ui"
            style={{
              color:      isSelected ? 'var(--side-active-text-sub)' : unread > 0 ? 'var(--brand)' : 'var(--side-mute)',
              fontWeight: unread > 0 ? 600 : 400,
            }}
          >
            {formatRoomTime(room.last_message_at, i18n.language)}
          </span>
        </div>

        <div className="flex items-center justify-between mt-0.5 gap-1">
          <p
            className="text-subtitle-2 truncate"
            style={{
              color:      isSelected ? 'var(--side-active-text-sub)' : 'var(--side-mute)',
              fontWeight: unread > 0 ? 500 : 400,
            }}
          >
            {room.last_message ?? <span className="italic">메시지 없음</span>}
          </p>
          {unread > 0 && (
            <span
              className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full
                         text-white text-[10px] font-bold flex items-center justify-center"
              style={{ background: isSelected ? 'var(--side-active-badge-bg)' : 'var(--brand)' }}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
