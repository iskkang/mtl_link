import { useState, useEffect, useMemo } from 'react'
import { AppLayout }        from '../components/layout/AppLayout'
import { Sidebar }          from '../components/layout/Sidebar'
import { ChatWindow }       from '../components/layout/ChatWindow'
import { NewRoomModal }     from '../components/chat/NewRoomModal'
import { NotificationPrompt } from '../components/ui/NotificationPrompt'
import { createDirectRoom } from '../services/roomService'
import { useAuth }          from '../hooks/useAuth'
import { useRoomStore }     from '../stores/roomStore'
import { useGlobalMessageMonitor } from '../hooks/useGlobalMessageMonitor'
import type { SidebarTab }  from '../components/chat/SidebarTabs'

export default function ChatPage() {
  const { user } = useAuth()
  const rooms    = useRoomStore(s => s.rooms)

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [showChat,       setShowChat]       = useState(false)
  const [newRoomOpen,    setNewRoomOpen]    = useState(false)
  const [activeTab,      setActiveTab]      = useState<SidebarTab>('chat')

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
        />
      }>
        <ChatWindow
          roomId={selectedRoomId}
          onBack={() => setShowChat(false)}
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
    </>
  )
}
