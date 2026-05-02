import { useEffect } from 'react'
import { useRequestStore } from '../stores/requestStore'
import { useRoomStore } from '../stores/roomStore'
import { fetchRooms } from '../services/roomService'
import { useAuth } from './useAuth'

const POLLING_INTERVAL = 30_000

export function usePollingRefresh() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    const refresh = () => {
      if (document.hidden) return
      void useRequestStore.getState().loadCounts()
      fetchRooms()
        .then(rooms => useRoomStore.getState().setRooms(rooms))
        .catch(() => {})
    }

    const interval = setInterval(refresh, POLLING_INTERVAL)

    const handleVisibility = () => {
      if (!document.hidden) refresh()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', refresh)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', refresh)
    }
  }, [user?.id])
}
