import { create } from 'zustand'
import { supabase } from '../lib/supabase'

interface RequestStore {
  receivedCount: number
  sentCount:     number
  loadCounts:    () => Promise<void>
}

export const useRequestStore = create<RequestStore>((set) => ({
  receivedCount: 0,
  sentCount:     0,
  loadCounts: async () => {
    const { data: { user } } = await supabase.auth.getUser()
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
