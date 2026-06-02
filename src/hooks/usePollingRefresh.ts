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
  const lastRefreshRef    = useRef<number>(0)
  const mintDmInitRef     = useRef(false)

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId
  }, [selectedRoomId])

  useEffect(() => {
    if (!user) return

    // mint_dm 멤버십은 첫 로그인 시 1회만 보장 (폴링마다 호출 불필요)
    if (!mintDmInitRef.current) {
      mintDmInitRef.current = true
      getOrCreateMintDmRoom().catch(() => {})
    }

    const doRefresh = async () => {
      if (document.hidden) return
      // get_dashboard_data RPC 하나로 rooms + requestCounts 한 번에 처리
      fetchRooms()
        .then(({ rooms, requestCounts }) => {
          useRoomStore.getState().setRooms(rooms)
          useRequestStore.getState().setCounts(requestCounts.received, requestCounts.sent)
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

    const handleVisibility = () => { if (!document.hidden) refresh() }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', refresh)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', refresh)
    }
  }, [user?.id])
}
