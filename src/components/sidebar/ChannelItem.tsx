import type { RoomListItem } from '../../types/chat'

interface Props {
  room:           RoomListItem
  selectedRoomId: string | null
  onSelect:       (id: string) => void
}

export function ChannelItem({ room, selectedRoomId, onSelect }: Props) {
  const isSelected = room.id === selectedRoomId
  const unread     = room.unread_count ?? 0
  const name       = room.name ?? '채널'

  return (
    <button
      type="button"
      onClick={() => onSelect(room.id)}
      className="w-full flex items-center justify-between pl-6 pr-3 py-1.5 text-left transition-colors"
      style={{
        background: isSelected ? '#E6F1FB' : 'transparent',
        color:      isSelected ? '#0C447C'  : 'var(--side-text)',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--side-hover)' }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className="text-[13px] flex-shrink-0"
          style={{ color: isSelected ? '#0C447C' : 'var(--side-mute)' }}
        >
          #
        </span>
        <span
          className="text-[13px] truncate"
          style={{ fontWeight: isSelected || unread > 0 ? 600 : 400 }}
        >
          {name}
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
