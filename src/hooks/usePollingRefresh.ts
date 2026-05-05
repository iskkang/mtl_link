import { useEffect, useRef } from 'react'
import { useRequestStore } from '../stores/requestStore'
import { useRoomStore } from '../stores/roomStore'
import { fetchRooms } from '../services/roomService'
import { useAuth } from './useAuth'

const POLLING_INTERVAL = 30_000

export function usePollingRefresh(selectedRoomId: string | null = null) {
  const { user } = useAuth()
  const selectedRoomIdRef = useRef(selectedRoomId)

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId
  }, [selectedRoomId])

  useEffect(() => {
    if (!user) return

    const refresh = () => {
      if (document.hidden) return
      void useRequestStore.getState().loadCounts()
      fetchRooms()
        .then(rooms => {
          useRoomStore.getState().setRooms(rooms)
          // 현재 열린 방의 unread를 즉시 재초기화 (polling이 DB값으로 덮어쓰는 것 방지)
          const rid = selectedRoomIdRef.current
          if (rid) useRoomStore.getState().resetUnread(rid)
        })
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
