import { useState } from 'react'
import { AppLayout }    from '../components/layout/AppLayout'
import { Sidebar }      from '../components/layout/Sidebar'
import { ChatWindow }   from '../components/layout/ChatWindow'
import { NewRoomModal } from '../components/chat/NewRoomModal'

export default function ChatPage() {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [showChat,       setShowChat]       = useState(false)
  const [newRoomOpen,    setNewRoomOpen]    = useState(false)

  const handleSelectRoom = (id: string) => {
    setSelectedRoomId(id)
    setShowChat(true)
  }

  const handleRoomCreated = (roomId: string) => {
    setNewRoomOpen(false)
    handleSelectRoom(roomId)
  }

  return (
    <>
      <AppLayout showChat={showChat} sidebar={
        <Sidebar
          selectedRoomId={selectedRoomId}
          onSelectRoom={handleSelectRoom}
          onNewChat={() => setNewRoomOpen(true)}
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
