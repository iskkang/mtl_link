import { useState, useEffect, type ReactNode } from 'react'
import { MessageSquare } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { MenuRail } from './MenuRail'
import { ChatSidebar } from './ChatSidebar'
import { MoreSheet } from './MoreSheet'
import { ProfileEditPage } from '../profile/ProfileEditPage'
import { useActionItems } from '../../hooks/useActionItems'
import { useDueDateNotifications } from '../../hooks/useDueDateNotifications'
import { usePresenceSubscription } from '../../hooks/usePresenceSubscription'
import { useRequestStore } from '../../stores/requestStore'
import { TcrIcon } from '../icons/TcrIcon'
import { FescoFIcon } from '../ui/FescoFIcon'
import { MintIcon } from '../ui/MarvisIcon'
import type { Section } from './MenuRail'
import type { SidebarTab } from '../chat/SidebarTabs'

interface Props {
  children:          ReactNode
  showChat?:         boolean
  activeSection:     Section
  onSectionChange:   (s: Section) => void
  selectedRoomId:    string | null
  onSelectRoom:      (id: string) => void
  onNewChat:         () => void
  onSelectFriend:    (userId: string) => void
  onSelectRequest:   (roomId: string, messageId: string) => void
  totalUnread:       number
  requestCount:      number
  notifEnabled:      boolean
  onToggleNotif:     () => void
  onLogoClick?:      () => void
  calendarYear:      number
  calendarMonth:     number
  onCalPrevMonth:    () => void
  onCalNextMonth:    () => void
  activeSessionId:   string | null
  onSelectSession:   (id: string) => void
  aiSidebarVersion:  number
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
  onLogoClick,
  calendarYear, calendarMonth, onCalPrevMonth, onCalNextMonth,
  activeSessionId, onSelectSession, aiSidebarVersion,
}: Props) {
  usePresenceSubscription()

  const isDesktop = useIsDesktop()
  const [moreOpen,        setMoreOpen]        = useState(false)
  const [profileEditOpen, setProfileEditOpen] = useState(false)

  const openProfileEdit = () => { setMoreOpen(false); setProfileEditOpen(true) }

  const mobileTab = MOBILE_SECTION_MAP.has(activeSection)
    ? (activeSection as SidebarTab)
    : activeSection

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
          onLogoClick={onLogoClick}
          onEditProfile={openProfileEdit}
          calendarYear={calendarYear}
          calendarMonth={calendarMonth}
          onCalPrevMonth={onCalPrevMonth}
          onCalNextMonth={onCalNextMonth}
          activeSessionId={activeSessionId}
          onSelectSession={onSelectSession}
          aiSidebarVersion={aiSidebarVersion}
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
              onLogoClick={onLogoClick}
            />
          </aside>
          <MoreSheet
            open={moreOpen}
            onClose={() => setMoreOpen(false)}
            onSectionChange={onSectionChange}
            notifEnabled={notifEnabled}
            onToggleNotif={onToggleNotif}
            onEditProfile={openProfileEdit}
          />
        </>
      )}

      {/* ── Main content ── */}
      <main
        className={`flex-1 flex flex-col min-w-0 ${showChat || isDesktop ? 'flex' : 'hidden'}`}
        style={{
          background:    'var(--chat-bg)',
          paddingBottom: !isDesktop && showChat ? 56 : undefined,
        }}
      >
        {children}
      </main>

      {/* ── Mobile bottom tab bar (full-screen sections only) ── */}
      {!isDesktop && showChat && (
        <MobileTabBar
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          totalUnread={totalUnread}
        />
      )}

      <ProfileEditPage open={profileEditOpen} onClose={() => setProfileEditOpen(false)} />
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
  onLogoClick?:    () => void
  onEditProfile:   () => void
  calendarYear:    number
  calendarMonth:   number
  onCalPrevMonth:  () => void
  onCalNextMonth:  () => void
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  aiSidebarVersion: number
}

function DesktopColumns({
  activeSection, onSectionChange,
  selectedRoomId, onSelectRoom, onNewChat,
  onSelectFriend, onSelectRequest,
  totalUnread, requestCount,
  notifEnabled, onToggleNotif,
  onLogoClick, onEditProfile,
  calendarYear, calendarMonth, onCalPrevMonth, onCalNextMonth,
  activeSessionId, onSelectSession, aiSidebarVersion,
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
          onLogoClick={onLogoClick}
          onEditProfile={onEditProfile}
        />
      </div>

      {/* ChatSidebar — 280px — hidden for full-width sections (e.g. tracking, tcr-tracking) */}
      {activeSection !== 'tracking' && activeSection !== 'tcr-tracking' && (
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
            calendarYear={calendarYear}
            calendarMonth={calendarMonth}
            onCalPrevMonth={onCalPrevMonth}
            onCalNextMonth={onCalNextMonth}
            activeSessionId={activeSessionId}
            onSelectSession={onSelectSession}
            aiSidebarVersion={aiSidebarVersion}
            onEditProfile={onEditProfile}
          />
        </div>
      )}
    </>
  )
}

/* ── Mobile bottom tab bar ─────────────────────────────────────── */
const MOBILE_TABS: { id: Section; Icon: React.ElementType; label: string; activeColor: string }[] = [
  { id: 'chat',         Icon: MessageSquare, label: '채팅',  activeColor: 'var(--brand)'  },
  { id: 'tracking',     Icon: FescoFIcon,    label: 'FESCO', activeColor: '#0d9488'       },
  { id: 'tcr-tracking', Icon: TcrIcon,       label: 'TCR',   activeColor: '#3b82f6'       },
  { id: 'ai',           Icon: MintIcon,      label: 'MINT+', activeColor: 'var(--brand)'  },
]

function MobileTabBar({
  activeSection, onSectionChange, totalUnread,
}: {
  activeSection:   Section
  onSectionChange: (s: Section) => void
  totalUnread:     number
}) {
  return (
    <nav
      style={{
        position:     'fixed',
        bottom:       0,
        left:         0,
        right:        0,
        height:       56,
        display:      'flex',
        alignItems:   'stretch',
        background:   'var(--rail-bg)',
        borderTop:    '1px solid var(--side-line)',
        zIndex:       200,
      }}
    >
      {MOBILE_TABS.map(({ id, Icon, label, activeColor }) => {
        const active = activeSection === id || (id === 'chat' && !['tracking', 'tcr-tracking', 'ai'].includes(activeSection))
        const showBadge = id === 'chat' && totalUnread > 0
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSectionChange(id)}
            aria-label={label}
            style={{
              flex:           1,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            2,
              background:     'transparent',
              border:         'none',
              cursor:         'pointer',
              color:          active ? activeColor : 'var(--side-mute)',
              position:       'relative',
              minHeight:      44,
            }}
          >
            <Icon size={20} />
            <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, lineHeight: 1, letterSpacing: '0.02em' }}>
              {label}
            </span>
            {showBadge && (
              <span
                style={{
                  position: 'absolute', top: 6, right: '25%',
                  minWidth: 14, height: 14, borderRadius: 7,
                  background: '#EF3F1A', color: '#fff',
                  fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px',
                }}
              >
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
