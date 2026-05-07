import { useState } from 'react'
import { SquarePen, Search, MessageSquare, ArrowLeft, Megaphone, Calendar, FolderOpen, Hash, Bot, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useRooms } from '../../hooks/useRooms'
import { RoomList } from '../chat/RoomList'
import { FriendsList } from '../chat/FriendsList'
import { ActionItemList } from '../actionitems/ActionItemList'
import { RequestList } from '../requests/RequestList'
import { AiSidebar } from '../ai/AiSidebar'
import { Button } from '../ui/Button'
import { BOT_USER_ID } from '../../constants/bot'
import type { Section } from './MenuRail'
import type { ActionItem } from '../../services/actionItemService'

interface Props {
  activeSection:   Section
  onSectionChange: (s: Section) => void
  selectedRoomId:  string | null
  onSelectRoom:    (id: string) => void
  onNewChat:       () => void
  onSelectFriend:  (userId: string) => void
  onSelectRequest: (roomId: string, messageId: string) => void
  // Action items data — owned by DesktopColumns in AppLayout (single subscription)
  received: ActionItem[]
  created:  ActionItem[]
  done:     ActionItem[]
  onReload: () => void
}

export function ChatSidebar({
  activeSection, onSectionChange,
  selectedRoomId, onSelectRoom,
  onNewChat, onSelectFriend, onSelectRequest,
  received, created, done, onReload,
}: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { rooms, loading } = useRooms()

  const SECTION_TITLE: Partial<Record<Section, string>> = {
    chat:          t('tabChat'),
    members:       t('tabFriends'),
    tasks:         t('tabTasks'),
    requests:      t('tabRequests'),
    announcements: t('menuRailAnnouncements'),
    calendar:      t('menuRailCalendar'),
    files:         t('menuRailFiles'),
    channels:      t('menuRailChannels'),
    bots:          t('menuRailBots'),
    ai:            'MTL AI',
    settings:      t('menuRailSettings'),
  }

  const title = SECTION_TITLE[activeSection] ?? activeSection

  return (
    <div
      className="flex flex-col h-full"
      style={{ width: 280, flexShrink: 0, background: 'var(--side-bg)' }}
    >
      {/* Section header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b"
        style={{ borderColor: 'var(--side-line)' }}
      >
        <h2 className="text-[13px] font-bold" style={{ color: 'var(--side-text)' }}>
          {title}
        </h2>
        {activeSection === 'chat' && (
          <button
            onClick={onNewChat}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--side-mute)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            aria-label={t('newChatBtn')}
          >
            <SquarePen size={16} />
          </button>
        )}
      </div>

      {/* ── Chat section ── */}
      {activeSection === 'chat' && (
        <>
          <div className="px-3 py-2 flex-shrink-0">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'var(--side-row)' }}
            >
              <Search size={13} className="flex-shrink-0" style={{ color: 'var(--side-mute)' }} />
              <input
                type="text"
                placeholder={t('searchChat')}
                readOnly
                className="flex-1 bg-transparent text-sm outline-none cursor-default"
                style={{ color: 'var(--side-text)' }}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {rooms.length === 0 && !loading
              ? <EmptyRoomList onNewChat={onNewChat} t={t} />
              : (
                <RoomList
                  rooms={rooms}
                  loading={loading}
                  selectedRoomId={selectedRoomId}
                  currentUserId={user?.id ?? ''}
                  onSelectRoom={onSelectRoom}
                />
              )
            }
          </div>
        </>
      )}

      {/* ── Members section ── */}
      {activeSection === 'members' && (
        <div className="flex flex-col flex-1 min-h-0">
          <FriendsList onSelectFriend={onSelectFriend} />
        </div>
      )}

      {/* ── Tasks section ── */}
      {activeSection === 'tasks' && (
        <div className="flex flex-col flex-1 min-h-0">
          <TasksPanel received={received} created={created} done={done} onReload={onReload} />
        </div>
      )}

      {/* ── Requests section ── */}
      {activeSection === 'requests' && (
        <div className="flex flex-col flex-1 min-h-0">
          <RequestList onSelectRequest={onSelectRequest} />
        </div>
      )}

      {/* ── AI section ── */}
      {activeSection === 'ai' && (
        <AiSidebar onNewChat={() => onSelectFriend(BOT_USER_ID)} />
      )}

      {/* ── Placeholder sections ── */}
      {(['announcements', 'files', 'channels', 'bots', 'settings'] as Section[]).includes(activeSection) && (
        <ComingSoon label={title} section={activeSection} onSectionChange={onSectionChange} />
      )}
    </div>
  )
}

/* ── TasksPanel ──────────────────────────────────── */
type TaskTab = 'received' | 'created' | 'done'

function TasksPanel({
  received, created, done, onReload,
}: {
  received: ActionItem[]
  created:  ActionItem[]
  done:     ActionItem[]
  onReload: () => void
}) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TaskTab>('received')

  const tabs: { id: TaskTab; label: string; count?: number }[] = [
    { id: 'received', label: t('taskTabReceived'), count: received.length },
    { id: 'created',  label: t('taskTabCreated'),  count: created.length  },
    { id: 'done',     label: t('taskTabDone') },
  ]

  const items = tab === 'received' ? received : tab === 'created' ? created : done

  return (
    <>
      <div className="flex flex-shrink-0 border-b text-xs" style={{ borderColor: 'var(--side-line)' }}>
        {tabs.map(({ id, label, count }) => {
          const isActive = tab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className="flex-1 flex items-center justify-center gap-1 py-2 font-semibold
                         border-b-2 transition-colors"
              style={{
                borderColor: isActive ? 'var(--brand)' : 'transparent',
                color:       isActive ? 'var(--side-text)' : 'var(--side-mute)',
              }}
            >
              {label}
              {count !== undefined && count > 0 && (
                <span
                  className="min-w-[14px] h-[14px] px-0.5 rounded-full text-white text-[9px]
                             font-bold flex items-center justify-center"
                  style={{ background: id === 'received' ? '#EF3F1A' : 'var(--brand)' }}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <ActionItemList items={items} onReload={onReload} view={tab} />
    </>
  )
}

/* ── Coming soon placeholder ─────────────────────── */
const PLACEHOLDER_ICONS: Partial<Record<Section, React.ElementType>> = {
  announcements: Megaphone,
  calendar:      Calendar,
  files:         FolderOpen,
  channels:      Hash,
  bots:          Bot,
  settings:      Settings,
}

function ComingSoon({
  label, section, onSectionChange,
}: {
  label:            string
  section:          Section
  onSectionChange:  (s: Section) => void
}) {
  const { t } = useTranslation()
  const Icon = PLACEHOLDER_ICONS[section]

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 text-center gap-2">
      {Icon && (
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mb-1"
          style={{ background: 'var(--side-row)' }}
        >
          <Icon size={22} style={{ color: 'var(--side-mute)' }} />
        </div>
      )}
      <h3 className="text-sm font-semibold" style={{ color: 'var(--side-text)' }}>
        {label}
      </h3>
      <p className="text-xs font-medium" style={{ color: 'var(--side-mute)' }}>
        {t('placeholderTitle')}
      </p>
      <p className="text-xs" style={{ color: 'var(--side-mute)', opacity: 0.6 }}>
        {t('placeholderSubtitle')}
      </p>
      <Button
        variant="text"
        size="sm"
        icon={ArrowLeft}
        iconPosition="left"
        onClick={() => onSectionChange('chat')}
        className="mt-3"
      >
        {t('placeholderBackToChat')}
      </Button>
    </div>
  )
}

/* ── Empty room list ─────────────────────────────── */
function EmptyRoomList({ onNewChat, t }: { onNewChat: () => void; t: (k: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ background: 'var(--side-row)' }}
      >
        <MessageSquare size={28} style={{ color: 'var(--side-mute)' }} />
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--side-mute)' }}>
        {t('noRooms')}
      </p>
      <p className="text-xs mb-5 leading-relaxed whitespace-pre-line" style={{ color: 'var(--side-mute)', opacity: 0.7 }}>
        {t('noRoomsDesc')}
      </p>
      <button
        onClick={onNewChat}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-white transition-colors"
        style={{ background: 'var(--brand)' }}
        onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.filter = '')}
      >
        <SquarePen size={13} />
        {t('newChatBtn')}
      </button>
    </div>
  )
}
