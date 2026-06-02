import { create } from 'zustand'
import { supabase, getSessionUser } from '../lib/supabase'

interface RequestStore {
  receivedCount: number
  sentCount:     number
  setCounts:     (received: number, sent: number) => void
  // 사용자 액션 후 즉각 반영용 (폴링에는 미사용)
  loadCounts:    () => Promise<void>
}

export const useRequestStore = create<RequestStore>((set) => ({
  receivedCount: 0,
  sentCount:     0,
  setCounts: (received, sent) => set({ receivedCount: received, sentCount: sent }),
  loadCounts: async () => {
    const user = await getSessionUser()
    if (!user) return
    const [{ count: r }, { count: s }] = await Promise.all([
      supabase.from('messages')
        .select('id', { count: 'exact', head: true })
        .neq('sender_id', user.id)
        .eq('needs_response', true)
        .eq('response_received', false)
        .is('deleted_at', null),
      supabase.from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', user.id)
        .eq('needs_response', true)
        .eq('response_received', false)
        .is('deleted_at', null),
    ])
    set({ receivedCount: r ?? 0, sentCount: s ?? 0 })
  },
}))
