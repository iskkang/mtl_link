import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react'
import { AppLayout }          from '../components/layout/AppLayout'
import { ChatWindow }         from '../components/layout/ChatWindow'
import { NewRoomModal }       from '../components/chat/NewRoomModal'
import { NotificationPrompt } from '../components/ui/NotificationPrompt'
import { createDirectRoom, fetchRooms } from '../services/roomService'
import { BOT_USER_ID }        from '../constants/bot'
import { aiEvents, chatEvents } from '../lib/aiEvents'
import { useAuth }            from '../hooks/useAuth'
import { useRoomStore }       from '../stores/roomStore'
import { useRequestStore }    from '../stores/requestStore'
import { useGlobalMessageMonitor } from '../hooks/useGlobalMessageMonitor'
import { usePollingRefresh }  from '../hooks/usePollingRefresh'
import { useDynamicFavicon }  from '../hooks/useDynamicFavicon'
import type { Section }       from '../components/layout/MenuRail'

const UnreadAllPage     = lazy(() => import('./UnreadAllPage').then(m => ({ default: m.UnreadAllPage })))
const ThreadsPage       = lazy(() => import('./ThreadsPage').then(m => ({ default: m.ThreadsPage })))
const Dashboard         = lazy(() => import('./Dashboard').then(m => ({ default: m.Dashboard })))
const CalendarPage      = lazy(() => import('../components/calendar/CalendarPage').then(m => ({ default: m.CalendarPage })))
const QuotationPage     = lazy(() => import('../components/ai/QuotationPage').then(m => ({ default: m.QuotationPage })))
const MessageWriterPage = lazy(() => import('../components/ai/MessageWriterPage').then(m => ({ default: m.MessageWriterPage })))
const TransportPage     = lazy(() => import('../components/ai/TransportPage').then(m => ({ default: m.TransportPage })))
const CustomsPage       = lazy(() => import('../components/ai/CustomsPage').then(m => ({ default: m.CustomsPage })))
const HsCodePage        = lazy(() => import('../components/ai/HsCodePage').then(m => ({ default: m.HsCodePage })))
const KnowledgePage     = lazy(() => import('../components/ai/KnowledgePage').then(m => ({ default: m.KnowledgePage })))
const AdminApprovalPage = lazy(() => import('../components/ai/AdminApprovalPage').then(m => ({ default: m.AdminApprovalPage })))
const TrackingPage      = lazy(() => import('../components/ai/TrackingPage').then(m => ({ default: m.TrackingPage })))
const RateFinderPage    = lazy(() => import('../components/ai/RateFinderPage').then(m => ({ default: m.RateFinderPage })))
const AiChatWindow      = lazy(() => import('../components/ai/AiChatWindow').then(m => ({ default: m.AiChatWindow })))

type AiView = 'chat' | 'quotation' | 'message' | 'transport' | 'customs' | 'hscode' | 'knowledge' | 'approval' | 'tracking'

export default function ChatPage() {
  const { user } = useAuth()
  const rooms    = useRoomStore(s => s.rooms)

  const [selectedRoomId,     setSelectedRoomId]     = useState<string | null>(null)
  const [showChat,           setShowChat]           = useState(false)
  const [newRoomOpen,        setNewRoomOpen]        = useState(false)
  const [activeSection,      setActiveSection]      = useState<Section>('chat')
  const [toast,              setToast]              = useState<string | null>(null)
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [calYear,  setCalYear]  = useState(() => new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth())

  const handleCalPrevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  const handleCalNextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  const [activeAiView,      setActiveAiView]      = useState<AiView>('chat')
  const [activeSessionId,   setActiveSessionId]   = useState<string | null>(null)
  const [aiSidebarVersion,  setAiSidebarVersion]  = useState(0)

  // Reset AI view when the selected room changes
  useEffect(() => { setActiveAiView('chat') }, [selectedRoomId])

  const handleAiNavigate = (view: 'quotation' | 'message' | 'transport' | 'customs' | 'hscode' | 'tracking') => setActiveAiView(view)
  const handleAiBack     = () => setActiveAiView('chat')

  const handleAiSessionDelete      = () => { setActiveSessionId(null); setAiSidebarVersion(v => v + 1) }
  const handleAiSessionTitleChange = () => setAiSidebarVersion(v => v + 1)

  // Sidebar delete → clear active session if it was the deleted one
  useEffect(() => {
    return aiEvents.onDeleted(sid => {
      setActiveSessionId(prev => (prev === sid ? null : prev))
    })
  }, [])

  // Sidebar nav (knowledge / approval pages)
  useEffect(() => {
    return aiEvents.onNavigate(view => {
      if (activeSection === 'ai') setActiveAiView(view as AiView)
    })
  }, [activeSection])

  useEffect(() => {
    return chatEvents.onNavigateToMessage((roomId, messageId) => {
      setSelectedRoomId(roomId)
      setShowChat(true)
      setHighlightMessageId(messageId)
      setActiveSection('chat')
    })
  }, [])

  usePollingRefresh(selectedRoomId)
  useDynamicFavicon()

  // Request count for MenuRail badge (Zustand — no duplicate subscription risk)
  const requestCount = useRequestStore(s => s.receivedCount)

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  const handleSelectRoom = (id: string) => {
    useRoomStore.getState().resetUnread(id)
    setSelectedRoomId(id)
    setShowChat(true)
    setActiveSection('chat')
  }

  const handleRoomCreated = (roomId: string) => {
    setNewRoomOpen(false)
    handleSelectRoom(roomId)
  }

  const handleSelectFriend = async (userId: string) => {
    try {
      const roomId = await createDirectRoom(userId)
      const updatedRooms = await fetchRooms()
      useRoomStore.getState().setRooms(updatedRooms)
      if (userId === BOT_USER_ID) {
        useRoomStore.getState().resetUnread(roomId)
        setSelectedRoomId(roomId)
        setShowChat(true)
        setActiveAiView('chat')
        // activeSection은 'ai' 그대로 유지
      } else {
        handleSelectRoom(roomId)
      }
    } catch (err) {
      console.error('DM 방 생성 실패:', err)
    }
  }

  const handleLeaveOrDelete = (toastMsg: string) => {
    setSelectedRoomId(null)
    setShowChat(false)
    showToast(toastMsg)
  }

  const handleLogoClick = () => {
    setSelectedRoomId(null)
    setShowChat(false)
    setActiveSection('chat')
  }

  const handleSectionChange = async (s: Section) => {
    if (s === 'bots') {
      try {
        const roomId = await createDirectRoom(BOT_USER_ID)
        const rooms = await fetchRooms()
        useRoomStore.getState().setRooms(rooms)
        handleSelectRoom(roomId)
      } catch (err) {
        console.error('봇 방 생성 실패:', err)
      }
      return
    }
    setActiveSection(s)
  }

  const handleSelectRequest = (roomId: string, messageId: string) => {
    setSelectedRoomId(roomId)
    setShowChat(true)
    setHighlightMessageId(messageId)
  }

  // 현재 선택된 방이 외부에서 삭제됐을 때 자동 해제
  useEffect(() => {
    if (selectedRoomId && !rooms.find(r => r.id === selectedRoomId)) {
      setSelectedRoomId(null)
      setShowChat(false)
    }
  }, [rooms, selectedRoomId])

  // PWA 뒤로가기: 채팅방 진입 시 히스토리 항목 push
  useEffect(() => {
    if (!selectedRoomId) return
    window.history.pushState({ roomId: selectedRoomId }, '')
  }, [selectedRoomId])

  // PWA 뒤로가기: popstate → 방 리스트로
  useEffect(() => {
    const handlePopState = () => {
      if (selectedRoomId) {
        setSelectedRoomId(null)
        setShowChat(false)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [selectedRoomId])

  // Global notifications + unread increment
  const { notifEnabled, toggleNotif, showPrompt, requestPermission, dismissPrompt } =
    useGlobalMessageMonitor({
      userId:        user?.id,
      currentRoomId: activeSection === 'chat' && showChat ? selectedRoomId : null,
      onSelectRoom:  handleSelectRoom,
    })

  // Total unread count across all rooms
  const totalUnread = useMemo(
    () => rooms.reduce((sum, r) => sum + (r.unread_count ?? 0), 0),
    [rooms],
  )

  // Page title badge
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) MTL Link` : 'MTL Link'
    return () => { document.title = 'MTL Link' }
  }, [totalUnread])

  return (
    <>
      <AppLayout
        showChat={showChat || activeSection === 'calendar' || activeSection === 'ai' || activeSection === 'ratefinder' || activeSection === 'all-unread' || activeSection === 'threads'}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        selectedRoomId={selectedRoomId}
        onSelectRoom={handleSelectRoom}
        onNewChat={() => setNewRoomOpen(true)}
        onSelectFriend={handleSelectFriend}
        onSelectRequest={handleSelectRequest}
        totalUnread={totalUnread}
        requestCount={requestCount}
        notifEnabled={notifEnabled}
        onToggleNotif={toggleNotif}
        onLogoClick={handleLogoClick}
        calendarYear={calYear}
        calendarMonth={calMonth}
        onCalPrevMonth={handleCalPrevMonth}
        onCalNextMonth={handleCalNextMonth}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        aiSidebarVersion={aiSidebarVersion}
      >
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center">
            <div
              className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }}
            />
          </div>
        }>
          {activeSection === 'calendar' ? (
            <CalendarPage
              currentYear={calYear}
              currentMonth={calMonth}
              onPrevMonth={handleCalPrevMonth}
              onNextMonth={handleCalNextMonth}
              onSectionChange={handleSectionChange}
            />
          ) : activeSection === 'ai' && activeAiView === 'quotation' ? (
            <QuotationPage onBack={handleAiBack} />
          ) : activeSection === 'ai' && activeAiView === 'message' ? (
            <MessageWriterPage onBack={handleAiBack} />
          ) : activeSection === 'ai' && activeAiView === 'transport' ? (
            <TransportPage onBack={handleAiBack} />
          ) : activeSection === 'ai' && activeAiView === 'customs' ? (
            <CustomsPage onBack={handleAiBack} />
          ) : activeSection === 'ai' && activeAiView === 'hscode' ? (
            <HsCodePage onBack={handleAiBack} />
          ) : activeSection === 'ai' && activeAiView === 'knowledge' ? (
            <KnowledgePage onBack={handleAiBack} />
          ) : activeSection === 'ai' && activeAiView === 'approval' ? (
            <AdminApprovalPage onBack={handleAiBack} />
          ) : activeSection === 'ai' && activeAiView === 'tracking' ? (
            <TrackingPage onBack={handleAiBack} />
          ) : activeSection === 'ratefinder' ? (
            <RateFinderPage onBack={() => setActiveSection('chat')} />
          ) : activeSection === 'all-unread' ? (
            <UnreadAllPage
              onBack={() => setActiveSection('chat')}
              onSelectRoom={handleSelectRoom}
            />
          ) : activeSection === 'threads' ? (
            <ThreadsPage onBack={() => setActiveSection('chat')} />
          ) : activeSection === 'ai' ? (
            <AiChatWindow
              sessionId={activeSessionId}
              onNewSession={setActiveSessionId}
              onNavigate={handleAiNavigate}
              onDelete={handleAiSessionDelete}
              onTitleChange={handleAiSessionTitleChange}
            />
          ) : selectedRoomId ? (
            <ChatWindow
              roomId={selectedRoomId}
              onBack={() => setShowChat(false)}
              onLeaveOrDelete={handleLeaveOrDelete}
              highlightMessageId={highlightMessageId}
              notifEnabled={notifEnabled}
              onToggleNotif={toggleNotif}
              onAiNavigate={handleAiNavigate}
            />
          ) : (
            <Dashboard onSectionChange={setActiveSection} />
          )}
        </Suspense>
      </AppLayout>

      <NewRoomModal
        open={newRoomOpen}
        onClose={() => setNewRoomOpen(false)}
        onRoomCreated={handleRoomCreated}
      />

      {showPrompt && (
        <NotificationPrompt
          onAllow={requestPermission}
          onLater={dismissPrompt}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60]
                        px-5 py-3 rounded-xl shadow-lg
                        bg-gray-800 dark:bg-surface-panel
                        text-white text-sm font-medium pointer-events-none">
          {toast}
        </div>
      )}
    </>
  )
}
