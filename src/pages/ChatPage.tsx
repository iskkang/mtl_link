import { useState } from 'react'
import { AppLayout }       from '../components/layout/AppLayout'
import { Sidebar }         from '../components/layout/Sidebar'
import { ChatWindow }      from '../components/layout/ChatWindow'
import { NewRoomModal }    from '../components/chat/NewRoomModal'
import { createDirectRoom } from '../services/roomService'
import type { SidebarTab } from '../components/chat/SidebarTabs'

export default function ChatPage() {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [showChat,       setShowChat]       = useState(false)
  const [newRoomOpen,    setNewRoomOpen]    = useState(false)
  const [activeTab,      setActiveTab]      = useState<SidebarTab>('chat')

  const handleSelectRoom = (id: string) => {
    setSelectedRoomId(id)
    setShowChat(true)
  }

  const handleRoomCreated = (roomId: string) => {
    setNewRoomOpen(false)
    handleSelectRoom(roomId)
  }

  const handleSelectFriend = async (userId: string) => {
    try {
      const roomId = await createDirectRoom(userId)
      setActiveTab('chat')
      handleSelectRoom(roomId)
    } catch (err) {
      console.error('DM 방 생성 실패:', err)
    }
  }

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
    </>
  )
}
