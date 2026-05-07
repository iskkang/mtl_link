import { useState, useEffect, useMemo, useRef } from 'react'
import { AppLayout }          from '../components/layout/AppLayout'
import { ChatWindow }         from '../components/layout/ChatWindow'
import { Dashboard }          from './Dashboard'
import { CalendarPage }       from '../components/calendar/CalendarPage'
import { NewRoomModal }       from '../components/chat/NewRoomModal'
import { NotificationPrompt } from '../components/ui/NotificationPrompt'
import { createDirectRoom, fetchRooms } from '../services/roomService'
import { BOT_USER_ID } from '../constants/bot'
import { useAuth }            from '../hooks/useAuth'
import { useRoomStore }       from '../stores/roomStore'
import { useRequestStore }    from '../stores/requestStore'
import { useGlobalMessageMonitor } from '../hooks/useGlobalMessageMonitor'
import { usePollingRefresh } from '../hooks/usePollingRefresh'
import type { Section }       from '../components/layout/MenuRail'

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

  usePollingRefresh(selectedRoomId)

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
      handleSelectRoom(roomId)
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
      currentRoomId: selectedRoomId,
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
        showChat={showChat || activeSection === 'calendar'}
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
      >
        {activeSection === 'calendar' ? (
          <CalendarPage onSectionChange={handleSectionChange} />
        ) : selectedRoomId ? (
          <ChatWindow
            roomId={selectedRoomId}
            onBack={() => setShowChat(false)}
            onLeaveOrDelete={handleLeaveOrDelete}
            highlightMessageId={highlightMessageId}
            notifEnabled={notifEnabled}
            onToggleNotif={toggleNotif}
          />
        ) : (
          <Dashboard onSectionChange={setActiveSection} />
        )}
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
