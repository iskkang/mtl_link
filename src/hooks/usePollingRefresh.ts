import { useEffect, useRef } from 'react'
import { useRequestStore } from '../stores/requestStore'
import { useRoomStore } from '../stores/roomStore'
import { fetchRooms, getOrCreateMintDmRoom } from '../services/roomService'
import { useAuth } from './useAuth'

const POLLING_INTERVAL = 30_000
const MIN_REFRESH_INTERVAL = 10_000 // focus/visibility 이벤트 최소 간격

export function usePollingRefresh(selectedRoomId: string | null = null) {
  const { user } = useAuth()
  const selectedRoomIdRef = useRef(selectedRoomId)
  const lastRefreshRef = useRef<number>(0)

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId
  }, [selectedRoomId])

  useEffect(() => {
    if (!user) return

    const doRefresh = async () => {
      if (document.hidden) return
      void useRequestStore.getState().loadCounts()
      // mint_dm 멤버십 보장 후 방 목록 갱신 (나갔거나 누락된 경우 자동 복구)
      try { await getOrCreateMintDmRoom() } catch { /* 실패해도 방 목록은 갱신 */ }
      fetchRooms()
        .then(rooms => {
          useRoomStore.getState().setRooms(rooms)
          // 현재 열린 방의 unread를 즉시 재초기화 (polling이 DB값으로 덮어쓰는 것 방지)
          const rid = selectedRoomIdRef.current
          if (rid) useRoomStore.getState().resetUnread(rid)
        })
        .catch(() => {})
    }

    const refresh = () => {
      const now = Date.now()
      if (now - lastRefreshRef.current < MIN_REFRESH_INTERVAL) return
      lastRefreshRef.current = now
      doRefresh()
    }

    const interval = setInterval(() => {
      lastRefreshRef.current = 0 // 폴링 주기는 throttle 무시
      doRefresh()
    }, POLLING_INTERVAL)

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
