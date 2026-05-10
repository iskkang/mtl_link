import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  getAnnouncementRoom,
  fetchAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
} from '../services/announcementService'
import type { AnnouncementItem, AnnouncementRoom } from '../types/announcement'

interface UseAnnouncementsReturn {
  room:    AnnouncementRoom | null
  items:   AnnouncementItem[]
  loading: boolean
  error:   string | null
  create:  (content: string) => Promise<void>
  remove:  (id: string) => Promise<void>
  reload:  () => void
}

export function useAnnouncements(): UseAnnouncementsReturn {
  const [room,    setRoom]    = useState<AnnouncementRoom | null>(null)
  const [items,   setItems]   = useState<AnnouncementItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await getAnnouncementRoom()
      setRoom(r)
      if (!r) return
      const data = await fetchAnnouncements(r.id)
      setItems([
        ...data.filter(a => a.is_pinned),
        ...data.filter(a => !a.is_pinned),
      ])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '공지를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!room?.id) return

    const channel = supabase
      .channel(`announcements-${room.id}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'messages',
          filter: `room_id=eq.${room.id}`,
        },
        () => { void load() },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [room?.id, load])

  const create = useCallback(async (content: string) => {
    if (!room?.id) throw new Error('공지방 없음')
    await createAnnouncement(room.id, content)
  }, [room?.id])

  const remove = useCallback(async (id: string) => {
    await deleteAnnouncement(id)
  }, [])

  return { room, items, loading, error, create, remove, reload: load }
}
