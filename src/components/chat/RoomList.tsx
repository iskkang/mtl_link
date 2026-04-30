import { RoomListItemView } from './RoomListItem'
import type { RoomListItem } from '../../types/chat'

interface Props {
  rooms:          RoomListItem[]
  loading:        boolean
  selectedRoomId: string | null
  currentUserId:  string
  onSelectRoom:   (id: string) => void
}

export function RoomList({ rooms, loading, selectedRoomId, currentUserId, onSelectRoom }: Props) {
  if (loading && !rooms.length) {
    return <RoomListSkeleton />
  }

  if (!rooms.length) return null

  return (
    <div className="flex flex-col">
      {rooms.map(room => (
        <RoomListItemView
          key={room.id}
          room={room}
          isSelected={room.id === selectedRoomId}
          currentUserId={currentUserId}
          onClick={() => onSelectRoom(room.id)}
        />
      ))}
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
