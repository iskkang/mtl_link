import { useState } from 'react'
import { SquarePen, ArrowLeft, Megaphone, Calendar, FolderOpen, Hash, Bot } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useRooms } from '../../hooks/useRooms'
import { NotificationPermissionCard } from '../notifications/NotificationPermissionCard'
import { FriendsList } from '../chat/FriendsList'
import { ActionItemList } from '../actionitems/ActionItemList'
import { RequestList } from '../requests/RequestList'
import { AiSidebar } from '../ai/AiSidebar'
import { CalendarHolidayList } from '../calendar/CalendarHolidayList'
import { Button } from '../ui/Button'
import { FilesPanel } from '../files/FilesPanel'
import { AnnouncementsPanel } from '../announcements/AnnouncementsPanel'
import { ChannelsPanel } from '../channels/ChannelsPanel'
import { WorkspaceHeader } from '../sidebar/WorkspaceHeader'
import { NotificationHub } from '../sidebar/NotificationHub'
import { CollapsibleSection } from '../sidebar/CollapsibleSection'
import { ChannelItem } from '../sidebar/ChannelItem'
import { DmItem } from '../sidebar/DmItem'
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
  // Calendar month sync
  calendarYear:   number
  calendarMonth:  number
  onCalPrevMonth: () => void
  onCalNextMonth: () => void
  // AI session
  activeSessionId:  string | null
  onSelectSession:  (id: string) => void
  aiSidebarVersion: number
  onEditProfile?:   () => void
}

export function ChatSidebar({
  activeSection, onSectionChange,
  selectedRoomId, onSelectRoom,
  onNewChat, onSelectFriend, onSelectRequest,
  received, created, done, onReload,
  calendarYear, calendarMonth, onCalPrevMonth, onCalNextMonth,
  activeSessionId, onSelectSession, aiSidebarVersion,
  onEditProfile,
}: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { rooms, loading } = useRooms()

  const SECTION_TITLE: Partial<Record<Section, string>> = {
    members:       t('tabFriends'),
    tasks:         t('tabTasks'),
    requests:      t('tabRequests'),
    announcements: t('menuRailAnnouncements'),
    calendar:      t('calendarSidebarTitle'),
    files:         t('menuRailFiles'),
    channels:      t('menuRailChannels'),
    bots:          t('menuRailBots'),
    ai:            'MINT',
  }

  const title = SECTION_TITLE[activeSection] ?? activeSection

  // Split rooms into channels and DMs for the new chat section layout
  const channelRooms = rooms.filter(r => r.room_type === 'channel')
  const dmRooms = rooms.filter(r => {
    if (r.room_type === 'channel') return false
    // Exclude legacy bot direct DMs from sidebar (MINT appears only as mint_dm)
    if (r.room_type === 'direct') {
      const other = r.members.find(m => m.id !== (user?.id ?? ''))
      return !other?.is_bot
    }
    return true
  })

  return (
    <div
      className="flex flex-col h-full"
      style={{ width: 280, flexShrink: 0, background: 'var(--side-bg)' }}
    >
      {/* ── Chat section (new Slack-style layout) ── */}
      {(['chat', 'all-unread', 'threads'] as Section[]).includes(activeSection) && (
        <>
          <WorkspaceHeader onEditProfile={onEditProfile} />
          <NotificationHub activeSection={activeSection} onSectionChange={onSectionChange} />
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <NotificationPermissionCard />
            <div className="py-2">
              <CollapsibleSection
                id="channels"
                label={t('sectionChannels')}
                onAdd={onNewChat}
              >
                {loading && channelRooms.length === 0
                  ? <RoomSkeleton />
                  : channelRooms.map(room => (
                      <ChannelItem
                        key={room.id}
                        room={room}
                        selectedRoomId={selectedRoomId}
                        onSelect={onSelectRoom}
                      />
                    ))
                }
              </CollapsibleSection>
            </div>
            <div
              className="mx-3 border-t"
              style={{ borderColor: 'var(--side-line)' }}
            />
            <div className="py-2">
              <CollapsibleSection
                id="dms"
                label={t('sectionDMs')}
                onAdd={onNewChat}
              >
                {dmRooms.map(room => (
                  <DmItem
                    key={room.id}
                    room={room}
                    currentUserId={user?.id ?? ''}
                    selectedRoomId={selectedRoomId}
                    onSelect={onSelectRoom}
                  />
                ))}
              </CollapsibleSection>
            </div>
          </div>
        </>
      )}

      {/* ── Non-chat sections: shared header ── */}
      {!(['chat', 'all-unread', 'threads'] as Section[]).includes(activeSection) && (
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b"
          style={{ borderColor: 'var(--side-line)' }}
        >
          <h2 className="text-[13px] font-bold" style={{ color: 'var(--side-text)' }}>
            {title}
          </h2>
          {activeSection === 'members' && (
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

      {/* ── Calendar section ── */}
      {activeSection === 'calendar' && (
        <div className="flex flex-col flex-1 min-h-0">
          <CalendarHolidayList
            year={calendarYear}
            month={calendarMonth}
            onPrevMonth={onCalPrevMonth}
            onNextMonth={onCalNextMonth}
          />
        </div>
      )}

      {/* ── AI section ── */}
      {activeSection === 'ai' && (
        <AiSidebar key={aiSidebarVersion} activeSessionId={activeSessionId} onSelectSession={onSelectSession} />
      )}

      {/* ── Files section ── */}
      {activeSection === 'files' && (
        <div className="flex flex-col flex-1 min-h-0">
          <FilesPanel onJump={onSelectRequest} />
        </div>
      )}

      {/* ── Announcements section ── */}
      {activeSection === 'announcements' && (
        <AnnouncementsPanel />
      )}

      {/* ── Channels section ── */}
      {activeSection === 'channels' && (
        <div className="flex flex-col flex-1 min-h-0">
          <ChannelsPanel
            onSelectRoom={onSelectRoom}
            onEnterRoom={roomId => {
              onSelectRoom(roomId)
              onSectionChange('chat')
            }}
          />
        </div>
      )}

      {/* ── Placeholder sections ── */}
      {(['bots'] as Section[]).includes(activeSection) && (
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
      <h3 className="text-[13px] font-semibold" style={{ color: 'var(--side-text)' }}>
        {label}
      </h3>
      <p className="text-[11px] font-medium" style={{ color: 'var(--side-mute)' }}>
        {t('placeholderTitle')}
      </p>
      <p className="text-[11px]" style={{ color: 'var(--side-mute)', opacity: 0.6 }}>
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

/* ── Room loading skeleton ────────────────────────── */
function RoomSkeleton() {
  return (
    <>
      {[1, 2, 3].map(i => (
        <div key={i} className="h-7 mx-3 my-1 rounded-md animate-pulse" style={{ background: 'var(--side-row)' }} />
      ))}
    </>
  )
}
