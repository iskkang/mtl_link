import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useRoomStore } from '../stores/roomStore'
import type { RoomListItem } from '../types/chat'

interface Props {
  onBack:       () => void
  onSelectRoom: (id: string) => void
}

export function UnreadAllPage({ onBack, onSelectRoom }: Props) {
  const { t }    = useTranslation()
  const { user } = useAuth()

  const rooms = useRoomStore(s => s.rooms)
  const [unreadRooms, setUnreadRooms] = useState<RoomListItem[]>([])

  useEffect(() => {
    setUnreadRooms(rooms.filter(r => (r.unread_count ?? 0) > 0))
  }, [rooms])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--chat-bg)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
      >
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-lg"
          style={{ color: 'var(--ink-3)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-[14px] font-bold" style={{ color: 'var(--ink-1)' }}>
          {t('navAllUnread')}
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {unreadRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <CheckCheck size={40} style={{ color: 'var(--ink-4)' }} />
            <p className="text-sm" style={{ color: 'var(--ink-3)' }}>{t('noUnread')}</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto flex flex-col gap-3">
            {unreadRooms.map(room => {
              const isChannel = room.room_type === 'channel'
              const name      = isChannel
                ? `# ${room.name ?? '채널'}`
                : room.members.find(m => m.id !== user?.id)?.name ?? room.name ?? '채팅'

              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => onSelectRoom(room.id)}
                  className="flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors"
                  style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}
                >
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--ink-1)' }}>
                      {name}
                    </p>
                    {room.last_message && (
                      <p className="text-[12px] mt-0.5 line-clamp-1" style={{ color: 'var(--ink-3)' }}>
                        {room.last_message}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white ml-3 flex-shrink-0"
                    style={{ background: '#D85A30' }}
                  >
                    {room.unread_count}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
