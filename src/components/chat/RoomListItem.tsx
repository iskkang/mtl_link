import { Users } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { formatRoomTime } from '../../lib/date'
import { getRoomDisplayName, getRoomAvatarInfo } from '../../services/roomService'
import { getLangFlag } from '../../lib/langFlags'
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

  // 고유 언어 코드 (현재 유저 제외)
  const memberLangs = [...new Set(
    room.members
      .filter(m => m.id !== currentUserId)
      .map(m => m.preferred_language)
      .filter(Boolean)
  )]

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors duration-100"
      style={{
        background: isSelected ? 'var(--side-active)' : 'transparent',
      }}
      onMouseEnter={e => {
        if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--side-row)'
      }}
      onMouseLeave={e => {
        if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
      }}
    >
      {/* 아바타 */}
      <div className="flex-shrink-0 relative">
        {room.room_type === 'group' ? (
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
          >
            {(room.name ?? '그룹').slice(0, 2)}
          </div>
        ) : (
          <Avatar name={avatar.name} avatarUrl={avatar.avatarUrl} size="md" />
        )}
      </div>

      {/* 텍스트 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-1">
          <span
            className="text-[13px] font-semibold truncate"
            style={{ color: 'var(--side-text)' }}
          >
            {displayName}
          </span>
          <span
            className="text-[11px] flex-shrink-0 font-mono-ui"
            style={{ color: unread > 0 ? 'var(--blue)' : 'var(--side-mute)', fontWeight: unread > 0 ? 600 : 400 }}
          >
            {formatRoomTime(room.last_message_at)}
          </span>
        </div>

        <div className="flex items-center justify-between mt-0.5 gap-1">
          <p
            className="text-[12px] truncate leading-snug"
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

        {/* 언어 배지 (깃발 이모지) */}
        {memberLangs.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {memberLangs.map(lang => (
              <span
                key={lang}
                className="text-[13px] leading-none"
                title={lang.toUpperCase()}
              >
                {getLangFlag(lang)}
              </span>
            ))}
            {room.room_type === 'group' && (
              <span
                className="text-[10px] font-bold font-mono-ui leading-none px-1 py-0.5 rounded"
                style={{
                  background: 'rgba(99,102,241,0.12)',
                  color: '#818CF8',
                  border: '1px solid rgba(99,102,241,0.2)',
                }}
              >
                <Users size={8} className="inline mr-0.5" />
                {room.members.length}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  )
}
