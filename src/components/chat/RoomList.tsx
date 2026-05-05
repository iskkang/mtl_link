import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { RoomListItemView } from './RoomListItem'
import type { RoomListItem } from '../../types/chat'

interface Props {
  rooms:           RoomListItem[]
  loading:         boolean
  selectedRoomId:  string | null
  currentUserId:   string
  onSelectRoom:    (id: string) => void
  onAddChannel?:   () => void
}

export function RoomList({ rooms, loading, selectedRoomId, currentUserId, onSelectRoom, onAddChannel }: Props) {
  const { t } = useTranslation()

  if (loading && !rooms.length) {
    return <RoomListSkeleton />
  }

  if (!rooms.length) return null

  const channels = rooms.filter(r => r.room_type === 'channel')
  const dms      = rooms.filter(r => r.room_type !== 'channel')

  return (
    <div className="flex flex-col">
      {channels.length > 0 && (
        <>
          <SectionHeader label={t('sectionChannels')} onAdd={onAddChannel} />
          {channels.map(room => (
            <RoomListItemView
              key={room.id}
              room={room}
              isSelected={room.id === selectedRoomId}
              currentUserId={currentUserId}
              onClick={() => onSelectRoom(room.id)}
            />
          ))}
        </>
      )}

      {dms.length > 0 && (
        <>
          <SectionHeader label={t('sectionDMs')} />
          {dms.map(room => (
            <RoomListItemView
              key={room.id}
              room={room}
              isSelected={room.id === selectedRoomId}
              currentUserId={currentUserId}
              onClick={() => onSelectRoom(room.id)}
            />
          ))}
        </>
      )}
    </div>
  )
}

function SectionHeader({ label, onAdd }: { label: string; onAdd?: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-1">
      <span
        className="text-[10px] font-semibold tracking-widest uppercase"
        style={{ color: 'var(--ink-4)' }}
      >
        {label}
      </span>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="p-0.5 rounded transition-colors"
          style={{ color: 'var(--ink-4)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-2)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-4)')}
          aria-label="채널 탐색"
        >
          <Plus size={13} />
        </button>
      )}
    </div>
  )
}

function RoomListSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3 border-b
                                 border-gray-100 dark:border-[#1f2c33]">
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-surface-hover animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between">
              <div className="h-3 w-28 bg-gray-200 dark:bg-surface-hover rounded animate-pulse" />
              <div className="h-3 w-10 bg-gray-100 dark:bg-[#374045] rounded animate-pulse" />
            </div>
            <div className="h-2.5 w-40 bg-gray-100 dark:bg-[#374045] rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}
