import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  getMyActionItems,
  getCreatedActionItems,
  getDoneActionItems,
  type ActionItem,
} from '../services/actionItemService'
import { useAuth } from './useAuth'

interface ActionItemsState {
  received: ActionItem[]
  created:  ActionItem[]
  done:     ActionItem[]
  loading:  boolean
}

export function useActionItems() {
  const { user } = useAuth()
  const [state, setState] = useState<ActionItemsState>({
    received: [],
    created:  [],
    done:     [],
    loading:  true,
  })

  const reload = useCallback(async () => {
    if (!user) return
    const [received, created, done] = await Promise.all([
      getMyActionItems(),
      getCreatedActionItems(),
      getDoneActionItems(),
    ])
    setState({ received, created, done, loading: false })
  }, [user])

  useEffect(() => {
    if (!user) return
    reload()

    const channel = supabase
      .channel(`action-items:${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'action_items',
          filter: `assigned_to=eq.${user.id}`,
        },
        () => reload(),
      )
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'action_items',
          filter: `created_by=eq.${user.id}`,
        },
        () => reload(),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, reload])

  return { ...state, reload }
}
