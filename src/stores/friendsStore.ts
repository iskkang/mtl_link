import { create } from 'zustand'
import { fetchFriends, type FriendProfile } from '../services/friendsService'

interface FriendsStore {
  friends:      FriendProfile[]
  loading:      boolean
  loaded:       boolean
  load:         () => Promise<void>
  patchProfile: (userId: string, patch: Partial<FriendProfile>) => void
}

export const useFriendsStore = create<FriendsStore>((set, get) => ({
  friends: [],
  loading: false,
  loaded:  false,

  load: async () => {
    const { loaded, loading } = get()
    if (loaded || loading) return
    set({ loading: true })
    try {
      const friends = await fetchFriends()
      set({ friends, loaded: true })
    } finally {
      set({ loading: false })
    }
  },

  patchProfile: (userId, patch) => set(s => ({
    friends: s.friends.map(f =>
      f.id === userId ? { ...f, ...patch } : f,
    ),
  })),
}))
