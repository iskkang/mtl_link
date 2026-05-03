import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { MenuRail } from './MenuRail'
import { ChatSidebar } from './ChatSidebar'
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
  taskCount:       number
  requestCount:    number
  notifEnabled:    boolean
  onToggleNotif:   () => void
}

const MOBILE_SECTION_MAP = new Set<Section>(['chat', 'members', 'tasks', 'requests'])

export function AppLayout({
  children, showChat = false,
  activeSection, onSectionChange,
  selectedRoomId, onSelectRoom, onNewChat,
  onSelectFriend, onSelectRequest,
  totalUnread, taskCount, requestCount,
  notifEnabled, onToggleNotif,
}: Props) {
  // If activeSection is a desktop-only section, fall back to 'chat' for mobile SidebarTabs
  const mobileTab: SidebarTab = MOBILE_SECTION_MAP.has(activeSection)
    ? (activeSection as SidebarTab)
    : 'chat'

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── Mobile sidebar (< md): full-width, shown/hidden by showChat ── */}
      <aside
        className={`w-full flex-shrink-0 flex flex-col md:hidden border-r ${showChat ? 'hidden' : 'flex'}`}
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
          notifEnabled={notifEnabled}
          onToggleNotif={onToggleNotif}
          onSelectRequest={onSelectRequest}
        />
      </aside>

      {/* ── Desktop MenuRail (>= md): 60px icon rail ── */}
      <div
        className="hidden md:flex flex-shrink-0 flex-col border-r"
        style={{ borderColor: 'var(--side-line)' }}
      >
        <MenuRail
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          totalUnread={totalUnread}
          taskCount={taskCount}
          requestCount={requestCount}
          notifEnabled={notifEnabled}
          onToggleNotif={onToggleNotif}
        />
      </div>

      {/* ── Desktop ChatSidebar (>= md): 280px section panel ── */}
      <div
        className="hidden md:flex flex-col border-r"
        style={{ borderColor: 'var(--side-line)' }}
      >
        <ChatSidebar
          activeSection={activeSection}
          selectedRoomId={selectedRoomId}
          onSelectRoom={onSelectRoom}
          onNewChat={onNewChat}
          onSelectFriend={onSelectFriend}
          onSelectRequest={onSelectRequest}
        />
      </div>

      {/* ── Main content ── */}
      <main
        className={`flex-1 flex flex-col min-w-0 ${showChat ? 'flex' : 'hidden md:flex'}`}
        style={{ background: 'var(--chat-bg)' }}
      >
        {children}
      </main>
    </div>
  )
}
