import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchRoomAttachments } from '../services/attachmentService'
import type { AttachmentItem, AttachmentFilter } from '../types/attachment'

const PAGE_SIZE = 40

interface AttachmentsState {
  items:   AttachmentItem[]
  loading: boolean
  hasMore: boolean
  filter:  AttachmentFilter
}

export function useAttachments(roomId?: string) {
  const [state, setState] = useState<AttachmentsState>({
    items:   [],
    loading: false,
    hasMore: false,
    filter:  'all',
  })
  const stateRef = useRef(state)
  stateRef.current = state

  const fetchPage = useCallback(async (filter: AttachmentFilter, before?: string): Promise<AttachmentItem[]> => {
    return fetchRoomAttachments({ roomId, filter, before, limit: PAGE_SIZE })
  }, [roomId])

  useEffect(() => {
    let cancelled = false
    setState({ items: [], loading: true, hasMore: false, filter: 'all' })
    fetchPage('all').then(page => {
      if (cancelled) return
      setState({ items: page, loading: false, hasMore: page.length === PAGE_SIZE, filter: 'all' })
    }).catch(() => {
      if (!cancelled) setState(s => ({ ...s, loading: false }))
    })
    return () => { cancelled = true }
  }, [roomId, fetchPage])

  const setFilter = useCallback(async (filter: AttachmentFilter) => {
    setState(s => ({ ...s, filter, items: [], loading: true, hasMore: false }))
    try {
      const page = await fetchRoomAttachments({ roomId, filter, limit: PAGE_SIZE })
      setState(s => ({ ...s, loading: false, hasMore: page.length === PAGE_SIZE, items: page }))
    } catch {
      setState(s => ({ ...s, loading: false }))
    }
  }, [roomId])

  const loadMore = useCallback(async () => {
    const { loading, hasMore, items, filter } = stateRef.current
    if (loading || !hasMore || items.length === 0) return
    setState(s => ({ ...s, loading: true }))
    try {
      const before = items[items.length - 1].created_at
      const page = await fetchRoomAttachments({ roomId, filter, before, limit: PAGE_SIZE })
      setState(s => ({
        ...s,
        loading: false,
        hasMore: page.length === PAGE_SIZE,
        items:   [...s.items, ...page],
      }))
    } catch {
      setState(s => ({ ...s, loading: false }))
    }
  }, [roomId])

  return {
    items:    state.items,
    loading:  state.loading,
    hasMore:  state.hasMore,
    filter:   state.filter,
    setFilter,
    loadMore,
  }
}
