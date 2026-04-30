import { useEffect } from 'react'
import { useRoomStore } from '../stores/roomStore'
import { fetchRooms } from '../services/roomService'
import { useRealtimeRooms } from './useRealtimeRooms'
import { useAuth } from './useAuth'

export function useRooms() {
  const { user } = useAuth()
  const store = useRoomStore()

  useEffect(() => {
    // user가 바뀔 때마다(로그인·로그아웃·계정 전환) 먼저 초기화
    store.reset()
    if (!user) return
    store.setLoading(true)
    fetchRooms()
      .then(store.setRooms)
      .catch(err => store.setError(String(err?.message ?? err)))
      .finally(() => store.setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useRealtimeRooms(user?.id)

  return {
    rooms:   store.rooms,
    loading: store.loading,
    error:   store.error,
    refresh: () => {
      fetchRooms().then(store.setRooms).catch(console.error)
    },
  }
}
