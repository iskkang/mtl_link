import { useState, useEffect, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { MenuRail } from './MenuRail'
import { ChatSidebar } from './ChatSidebar'
import { MoreSheet } from './MoreSheet'
import { useActionItems } from '../../hooks/useActionItems'
import { useDueDateNotifications } from '../../hooks/useDueDateNotifications'
import { useRequestStore } from '../../stores/requestStore'
import type { Section } from './MenuRail'
import type { SidebarTab } from '../chat/SidebarTabs'

interface Props {
  children:        ReactNode
  showChat?:       boolean
  activeSection:   Section
  onSectionChange: (s: Section) => void
  selectedRoomId:  string | null
  onSelectRoom:    (id: string) => void
  onNewChat:       () => void
  onSelectFriend:  (userId: string) => void
  onSelectRequest: (roomId: string, messageId: string) => void
  totalUnread:     number
  requestCount:    number
  notifEnabled:    boolean
  onToggleNotif:   () => void
}

/** Reads window.matchMedia once + listens for changes — runs client-side only */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 768px)').matches
      : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isDesktop
}

const MOBILE_SECTION_MAP = new Set<Section>(['chat', 'members', 'tasks', 'requests'])

export function AppLayout({
  children, showChat = false,
  activeSection, onSectionChange,
  selectedRoomId, onSelectRoom, onNewChat,
  onSelectFriend, onSelectRequest,
  totalUnread, requestCount,
  notifEnabled, onToggleNotif,
}: Props) {
  const isDesktop = useIsDesktop()
  const [moreOpen, setMoreOpen] = useState(false)

  const mobileTab: SidebarTab = MOBILE_SECTION_MAP.has(activeSection)
    ? (activeSection as SidebarTab)
    : 'chat'

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>

      {isDesktop ? (
        /* ── Desktop: MenuRail (60px) + ChatSidebar (280px) ── */
        <DesktopColumns
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          selectedRoomId={selectedRoomId}
          onSelectRoom={onSelectRoom}
          onNewChat={onNewChat}
          onSelectFriend={onSelectFriend}
          onSelectRequest={onSelectRequest}
          totalUnread={totalUnread}
          requestCount={requestCount}
          notifEnabled={notifEnabled}
          onToggleNotif={onToggleNotif}
        />
      ) : (
        /* ── Mobile: full-width Sidebar + MoreSheet ── */
        <>
          <aside
            className={`w-full flex-shrink-0 flex-col border-r ${showChat ? 'hidden' : 'flex'}`}
            style={{ background: 'var(--side-bg)', borderColor: 'var(--side-line)' }}
          >
            <Sidebar
              selectedRoomId={selectedRoomId}
              onSelectRoom={onSelectRoom}
              onNewChat={onNewChat}
              activeTab={mobileTab}
              onTabChange={tab => onSectionChange(tab as Section)}
              onSelectFriend={onSelectFriend}
              totalUnread={totalUnread}
              onSelectRequest={onSelectRequest}
              onMoreClick={() => setMoreOpen(true)}
            />
          </aside>
          <MoreSheet
            open={moreOpen}
            onClose={() => setMoreOpen(false)}
            onSectionChange={onSectionChange}
            notifEnabled={notifEnabled}
            onToggleNotif={onToggleNotif}
          />
        </>
      )}

      {/* ── Main content ── */}
      <main
        className={`flex-1 flex flex-col min-w-0 ${showChat || isDesktop ? 'flex' : 'hidden'}`}
        style={{ background: 'var(--chat-bg)' }}
      >
        {children}
      </main>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────
   DesktopColumns — only mounted on desktop.
   Owns the single useActionItems subscription for the desktop
   layout, then hands data down to ChatSidebar.
   ────────────────────────────────────────────────────────────── */
interface DesktopColumnsProps {
  activeSection:   Section
  onSectionChange: (s: Section) => void
  selectedRoomId:  string | null
  onSelectRoom:    (id: string) => void
  onNewChat:       () => void
  onSelectFriend:  (userId: string) => void
  onSelectRequest: (roomId: string, messageId: string) => void
  totalUnread:     number
  requestCount:    number
  notifEnabled:    boolean
  onToggleNotif:   () => void
}

function DesktopColumns({
  activeSection, onSectionChange,
  selectedRoomId, onSelectRoom, onNewChat,
  onSelectFriend, onSelectRequest,
  totalUnread, requestCount,
  notifEnabled, onToggleNotif,
}: DesktopColumnsProps) {
  const { received, created, done, reload } = useActionItems()
  const taskCount = received.length + created.length
  useDueDateNotifications(received)

  // requestCount is read from store here too so MenuRail stays self-consistent
  const storeRequestCount = useRequestStore(s => s.receivedCount)
  const effectiveRequestCount = storeRequestCount || requestCount

  return (
    <>
      {/* MenuRail — 60px */}
      <div
        className="flex-shrink-0 flex flex-col border-r"
        style={{ borderColor: 'var(--side-line)' }}
      >
        <MenuRail
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          totalUnread={totalUnread}
          taskCount={taskCount}
          requestCount={effectiveRequestCount}
          notifEnabled={notifEnabled}
          onToggleNotif={onToggleNotif}
        />
      </div>

      {/* ChatSidebar — 280px */}
      <div
        className="flex flex-col border-r"
        style={{ borderColor: 'var(--side-line)' }}
      >
        <ChatSidebar
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          selectedRoomId={selectedRoomId}
          onSelectRoom={onSelectRoom}
          onNewChat={onNewChat}
          onSelectFriend={onSelectFriend}
          onSelectRequest={onSelectRequest}
          received={received}
          created={created}
          done={done}
          onReload={reload}
        />
      </div>
    </>
  )
}
