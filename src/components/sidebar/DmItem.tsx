import { getRoomDisplayName, getRoomAvatarInfo } from '../../services/roomService'
import type { RoomListItem } from '../../types/chat'

interface Props {
  room:           RoomListItem
  currentUserId:  string
  selectedRoomId: string | null
  onSelect:       (id: string) => void
}

function getInitials(name: string): string {
  if (!name) return '?'
  if (/[一-鿿぀-ヿ]/.test(name[0])) return name.slice(0, 2)
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function DmItem({ room, currentUserId, selectedRoomId, onSelect }: Props) {
  const isSelected  = room.id === selectedRoomId
  const displayName = getRoomDisplayName(room, currentUserId)
  const avatar      = getRoomAvatarInfo(room, currentUserId)
  const unread      = room.unread_count ?? 0

  return (
    <button
      type="button"
      onClick={() => onSelect(room.id)}
      className="w-full flex items-center justify-between pl-4 pr-3 py-1.5 text-left transition-colors"
      style={{
        background: isSelected ? '#E6F1FB' : 'transparent',
        color:      isSelected ? '#0C447C'  : 'var(--side-text)',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--side-hover)' }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* 8px rounded square avatar */}
        <div
          className="w-[22px] h-[22px] flex-shrink-0 flex items-center justify-center
                     text-white font-semibold text-[10px]"
          style={{
            background:   avatar.avatarColor ?? '#7F77DD',
            borderRadius: '6px',
          }}
        >
          {getInitials(avatar.name)}
        </div>
        <span
          className="text-[13px] truncate"
          style={{ fontWeight: isSelected || unread > 0 ? 600 : 400 }}
        >
          {displayName}
        </span>
      </div>
      {!isSelected && unread > 0 && (
        <span
          className="text-[10px] font-semibold px-1.5 py-px rounded-full flex-shrink-0"
          style={{ background: '#FCEBEB', color: '#A32D2D' }}
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}
