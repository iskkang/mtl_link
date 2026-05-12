import { create } from 'zustand'
import { supabase } from '../lib/supabase'

interface PendingApprovalState {
  count: number
  refresh: () => Promise<void>
  subscribe: () => () => void
}

export const usePendingApprovalStore = create<PendingApprovalState>((set, get) => ({
  count: 0,

  refresh: async () => {
    const [hsRes, kbRes] = await Promise.all([
      supabase
        .from('hs_code_notes')
        .select('id', { count: 'exact', head: true })
        .in('approval_status', ['pending_review', 'draft']),
      supabase
        .from('knowledge_base')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending_review', 'draft']),
    ])
    set({ count: (hsRes.count ?? 0) + (kbRes.count ?? 0) })
  },

  subscribe: () => {
    const hsChannel = supabase
      .channel('pending_approval_hs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hs_code_notes' }, () => {
        void get().refresh()
      })
      .subscribe()

    const kbChannel = supabase
      .channel('pending_approval_kb')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'knowledge_base' }, () => {
        void get().refresh()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(hsChannel)
      void supabase.removeChannel(kbChannel)
    }
  },
}))
