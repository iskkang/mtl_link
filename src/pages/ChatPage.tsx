import { useState, useEffect, useMemo, useRef } from 'react'
import { AppLayout }          from '../components/layout/AppLayout'
import { Sidebar }            from '../components/layout/Sidebar'
import { ChatWindow }         from '../components/layout/ChatWindow'
import { NewRoomModal }       from '../components/chat/NewRoomModal'
import { NotificationPrompt } from '../components/ui/NotificationPrompt'
import { createDirectRoom }   from '../services/roomService'
import { useAuth }            from '../hooks/useAuth'
import { useRoomStore }       from '../stores/roomStore'
import { useGlobalMessageMonitor } from '../hooks/useGlobalMessageMonitor'
import { usePollingRefresh } from '../hooks/usePollingRefresh'
import type { SidebarTab }    from '../components/chat/SidebarTabs'

export default function ChatPage() {
  const { user } = useAuth()
  const rooms    = useRoomStore(s => s.rooms)
  usePollingRefresh()

  const [selectedRoomId,    setSelectedRoomId]    = useState<string | null>(null)
  const [showChat,          setShowChat]          = useState(false)
  const [newRoomOpen,       setNewRoomOpen]       = useState(false)
  const [activeTab,         setActiveTab]         = useState<SidebarTab>('chat')
  const [toast,             setToast]             = useState<string | null>(null)
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  const handleSelectRoom = (id: string) => {
    setSelectedRoomId(id)
    setShowChat(true)
    setActiveTab('chat')
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

  const handleSelectRequest = (roomId: string, messageId: string) => {
    setSelectedRoomId(roomId)
    setShowChat(true)
    setHighlightMessageId(messageId)
    // 요청 탭 유지 (채팅 탭으로 전환하지 않음)
  }

  // 현재 선택된 방이 외부에서 삭제됐을 때 (다른 멤버가 방을 삭제) 자동 해제
  useEffect(() => {
    if (selectedRoomId && !rooms.find(r => r.id === selectedRoomId)) {
      setSelectedRoomId(null)
      setShowChat(false)
    }
  }, [rooms, selectedRoomId])

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
      <AppLayout showChat={showChat} sidebar={
        <Sidebar
          selectedRoomId={selectedRoomId}
          onSelectRoom={handleSelectRoom}
          onNewChat={() => setNewRoomOpen(true)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onSelectFriend={handleSelectFriend}
          totalUnread={totalUnread}
          notifEnabled={notifEnabled}
          onToggleNotif={toggleNotif}
          onSelectRequest={handleSelectRequest}
        />
      }>
        <ChatWindow
          roomId={selectedRoomId}
          onBack={() => setShowChat(false)}
          onLeaveOrDelete={handleLeaveOrDelete}
          highlightMessageId={highlightMessageId}
        />
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

      {/* 토스트 알림 */}
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
