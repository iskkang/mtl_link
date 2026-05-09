import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fetchPinnedIds, type PinnedMessageRow } from '../services/pinMessage'
import { useAuth } from './useAuth'

export function usePinnedMessages(roomId: string | null) {
  const { user } = useAuth()
  const [rows, setRows] = useState<PinnedMessageRow[]>([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!roomId) { setRows([]); return }
    setLoading(true)
    try {
      const data = await fetchPinnedIds(roomId)
      setRows(data)
    } catch (err) {
      console.error('[usePinnedMessages] fetch failed', err)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [roomId])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    if (!roomId) return
    const channel = supabase
      .channel(`pinned_messages:${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pinned_messages',
        filter: `room_id=eq.${roomId}`,
      }, () => { reload() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [roomId, reload])

  const pinnedIds = new Set(rows.map(r => r.message_id))
  const myPinnedIds = new Set(rows.filter(r => r.pinned_by === user?.id).map(r => r.message_id))

  return { rows, pinnedIds, myPinnedIds, count: rows.length, loading, reload }
}
