import { useState } from 'react'
import { SquarePen, LogOut, Search, MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useRooms } from '../../hooks/useRooms'
import { Avatar } from '../ui/Avatar'
import { RoomList } from '../chat/RoomList'
import { FriendsList } from '../chat/FriendsList'
import { SidebarTabs, type SidebarTab } from '../chat/SidebarTabs'
import { LanguageSwitcher } from '../ui/LanguageSwitcher'
import { NotificationToggle } from '../ui/NotificationToggle'
import { ActionItemList } from '../actionitems/ActionItemList'
import { useActionItems } from '../../hooks/useActionItems'
import { useDueDateNotifications } from '../../hooks/useDueDateNotifications'
import { RequestList } from '../requests/RequestList'
import { useRequestStore } from '../../stores/requestStore'

interface Props {
  selectedRoomId:   string | null
  onSelectRoom:     (id: string) => void
  onNewChat:        () => void
  activeTab:        SidebarTab
  onTabChange:      (tab: SidebarTab) => void
  onSelectFriend:   (userId: string) => void
  totalUnread:      number
  notifEnabled:     boolean
  onToggleNotif:    () => void
  onSelectRequest:  (roomId: string, messageId: string) => void
}

export function Sidebar({
  selectedRoomId, onSelectRoom, onNewChat,
  activeTab, onTabChange, onSelectFriend, onSelectRequest,
  totalUnread, notifEnabled, onToggleNotif,
}: Props) {
  const { t } = useTranslation()
  const { profile, user, signOut } = useAuth()
  const { rooms, loading } = useRooms()
  const { received, created, done, reload } = useActionItems()
  const pendingCount = received.length + created.length
  const requestCount = useRequestStore(s => s.receivedCount)

  useDueDateNotifications(received)

  return (
    <div className="flex flex-col h-full sidebar-panel">

      {/* ── 헤더 ─────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-4 py-3.5 flex-shrink-0 border-b"
        style={{ borderColor: 'var(--side-line)' }}
      >
        <div className="flex items-center gap-2.5">
          {/* Brand mark */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #EF3F1A, #B83113)' }}
          >
            <span className="text-white text-[11px] font-black tracking-tight leading-none">M</span>
          </div>
          <div>
            <span
              className="font-bold text-[14px] leading-none block"
              style={{ color: 'var(--side-text)' }}
            >
              MTL LINK
            </span>
            <span
              className="text-[9px] leading-none font-mono-ui tracking-widest uppercase mt-0.5 block"
              style={{ color: 'var(--side-mute)' }}
            >
              multilingual chat
            </span>
          </div>
        </div>
        <button
          onClick={onNewChat}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--side-mute)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          aria-label="새 채팅"
        >
          <SquarePen size={18} />
        </button>
      </header>

      {/* ── 탭 ───────────────────────────────────────── */}
      <SidebarTabs
        active={activeTab}
        onChange={onTabChange}
        totalUnread={totalUnread}
        taskCount={pendingCount}
        requestCount={requestCount}
      />

      {/* ── 채팅 탭 ──────────────────────────────────── */}
      {activeTab === 'chat' && (
        <>
          <div className="px-3 py-2 flex-shrink-0">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'var(--side-row)' }}
            >
              <Search size={14} className="flex-shrink-0" style={{ color: 'var(--side-mute)' }} />
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

      {/* ── 친구 탭 ──────────────────────────────────── */}
      {activeTab === 'friends' && (
        <div className="flex flex-col flex-1 min-h-0">
          <FriendsList onSelectFriend={onSelectFriend} />
        </div>
      )}

      {/* ── 할 일 탭 ─────────────────────────────────── */}
      {activeTab === 'tasks' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* sub-tabs: received / created / done */}
          <TasksPanel
            received={received}
            created={created}
            done={done}
            onReload={reload}
          />
        </div>
      )}

      {/* ── 요청 탭 ──────────────────────────────────── */}
      {activeTab === 'requests' && (
        <div className="flex flex-col flex-1 min-h-0">
          <RequestList
            onSelectRequest={onSelectRequest}
          />
        </div>
      )}

      {/* ── 프로필 푸터 ──────────────────────────────── */}
      {profile && (
        <footer
          className="flex items-center gap-3 px-4 py-3 flex-shrink-0 border-t"
          style={{ background: 'var(--side-deep)', borderColor: 'var(--side-line)' }}
        >
          <Avatar name={profile.name} avatarUrl={profile.avatar_url} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--side-text)' }}>
              {profile.name}
            </p>
            {(profile.department || profile.position) && (
              <p className="text-xs truncate" style={{ color: 'var(--side-mute)' }}>
                {[profile.department, profile.position].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <NotificationToggle enabled={notifEnabled} onToggle={onToggleNotif} />
          <LanguageSwitcher />
          <button
            onClick={signOut}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--side-mute)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            aria-label="로그아웃"
          >
            <LogOut size={16} />
          </button>
        </footer>
      )}
    </div>
  )
}

/* ── TasksPanel ─────────────────────────────────── */
import type { ActionItem } from '../../services/actionItemService'

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
    { id: 'created',  label: t('taskTabCreated'),  count: created.length },
    { id: 'done',     label: t('taskTabDone') },
  ]

  const items = tab === 'received' ? received : tab === 'created' ? created : done

  return (
    <>
      {/* sub tab bar */}
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
                color: isActive ? 'var(--side-text)' : 'var(--side-mute)',
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
        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold
                   text-white transition-colors"
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
