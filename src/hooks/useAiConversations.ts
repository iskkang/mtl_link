import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface AiConversation {
  id:         string
  question:   string | null
  category:   string
  created_at: string
}

export function useAiConversations() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<AiConversation[]>([])
  const [loading,       setLoading]       = useState(false)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('ai_conversations')
        .select('id, question, category, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setConversations(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { reload() }, [reload])

  return { conversations, loading, reload }
}
