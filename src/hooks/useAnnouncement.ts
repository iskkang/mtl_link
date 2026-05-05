import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useRoomStore } from '../stores/roomStore'

const LS_KEY = 'lastSeenAnnouncementId'

export interface AnnouncementData {
  roomId:    string
  messageId: string
  content:   string
}

export function useAnnouncement() {
  const rooms = useRoomStore(s => s.rooms)
  const [announcement, setAnnouncement] = useState<AnnouncementData | null>(null)

  const announcementRoom = rooms.find(r => r.room_type === 'channel' && r.is_announcement)

  const fetchLatest = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('id, content')
      .eq('room_id', roomId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!data?.content) { setAnnouncement(null); return }

    const lastSeen = localStorage.getItem(LS_KEY)
    if (lastSeen === data.id) { setAnnouncement(null); return }

    setAnnouncement({ roomId, messageId: data.id, content: data.content })
  }, [])

  useEffect(() => {
    if (!announcementRoom) return
    const rid = announcementRoom.id

    fetchLatest(rid)

    const ch = supabase
      .channel(`announcement:${rid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${rid}` },
        () => { fetchLatest(rid) },
      )
      .subscribe()

    return () => { void supabase.removeChannel(ch) }
  }, [announcementRoom?.id, fetchLatest])

  const dismiss = useCallback((messageId: string) => {
    localStorage.setItem(LS_KEY, messageId)
    setAnnouncement(null)
  }, [])

  return { announcement, dismiss }
}
