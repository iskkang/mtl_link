import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface AiSession {
  sessionId: string
  title:     string
  createdAt: string
}

export function useAiSessions() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<AiSession[]>([])
  const [loading,  setLoading]  = useState(false)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('ai_conversations')
        .select('session_id, session_title, question, created_at')
        .eq('user_id', user.id)
        .not('session_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200)

      const seen = new Set<string>()
      const list: AiSession[] = []
      for (const row of data ?? []) {
        if (!row.session_id || seen.has(row.session_id)) continue
        seen.add(row.session_id)
        list.push({
          sessionId: row.session_id,
          title:     row.session_title ?? ((row.question ?? '').slice(0, 30) || '…'),
          createdAt: row.created_at,
        })
      }
      setSessions(list)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { reload() }, [reload])

  return { sessions, loading, reload }
}
