import { create } from 'zustand'
import type { RoomListItem } from '../types/chat'

interface RoomStore {
  rooms:       RoomListItem[]
  loading:     boolean
  error:       string | null

  reset:                () => void
  setRooms:             (rooms: RoomListItem[]) => void
  setLoading:           (v: boolean) => void
  setError:             (e: string | null) => void
  upsertRoom:           (room: RoomListItem) => void
  removeRoom:           (roomId: string) => void
  updateLastMessage:    (roomId: string, msg: string | null, at: string | null) => void
  updateMemberReadAt:   (roomId: string, userId: string, lastReadAt: string) => void
  incrementUnread:      (roomId: string) => void
  resetUnread:          (roomId: string) => void
}

export const useRoomStore = create<RoomStore>((set, _get) => ({
  rooms:   [],
  loading: false,
  error:   null,

  reset:      ()      => set({ rooms: [], loading: false, error: null }),
  setRooms:   (rooms) => set({ rooms }),
  setLoading: (v)     => set({ loading: v }),
  setError:   (e)     => set({ error: e }),

  removeRoom: (roomId) => set(s => ({ rooms: s.rooms.filter(r => r.id !== roomId) })),

  upsertRoom: (room) => set(s => {
    const idx = s.rooms.findIndex(r => r.id === room.id)
    if (idx >= 0) {
      const next = [...s.rooms]
      next[idx] = room
      return { rooms: next }
    }
    return {
      rooms: [room, ...s.rooms].sort((a, b) => {
        const ta = a.last_message_at ?? a.created_at
        const tb = b.last_message_at ?? b.created_at
        return tb.localeCompare(ta)
      }),
    }
  }),

  updateLastMessage: (roomId, msg, at) => set(s => {
    const idx = s.rooms.findIndex(r => r.id === roomId)
    if (idx < 0) return {}
    const next = [...s.rooms]
    next[idx] = { ...next[idx], last_message: msg, last_message_at: at }
    // 최신 메시지 순으로 재정렬
    next.sort((a, b) => {
      const ta = a.last_message_at ?? a.created_at
      const tb = b.last_message_at ?? b.created_at
      return tb.localeCompare(ta)
    })
    return { rooms: next }
  }),

  updateMemberReadAt: (roomId, userId, lastReadAt) => set(s => {
    const idx = s.rooms.findIndex(r => r.id === roomId)
    if (idx < 0) return {}
    const next = [...s.rooms]
    next[idx] = {
      ...next[idx],
      members: next[idx].members.map(m =>
        m.id === userId ? { ...m, last_read_at: lastReadAt } : m,
      ),
    }
    return { rooms: next }
  }),

  incrementUnread: (roomId) => set(s => {
    const idx = s.rooms.findIndex(r => r.id === roomId)
    if (idx < 0) return {}
    const next = [...s.rooms]
    next[idx] = { ...next[idx], unread_count: (next[idx].unread_count ?? 0) + 1 }
    return { rooms: next }
  }),

  resetUnread: (roomId) => set(s => {
    const idx = s.rooms.findIndex(r => r.id === roomId)
    if (idx < 0) return {}
    const next = [...s.rooms]
    next[idx] = { ...next[idx], unread_count: 0 }
    return { rooms: next }
  }),
}))

// 인증 상태 변경 시 스토어 초기화
export function clearRoomStore() {
  useRoomStore.getState().setRooms([])
  useRoomStore.getState().setError(null)
}
