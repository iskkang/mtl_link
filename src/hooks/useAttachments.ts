import { useState, useEffect, useCallback } from 'react'
import { fetchRoomAttachments } from '../services/attachmentService'
import type { AttachmentItem, AttachmentFilter } from '../types/attachment'

const PAGE_SIZE = 40

interface AttachmentsState {
  items:    AttachmentItem[]
  loading:  boolean
  hasMore:  boolean
  filter:   AttachmentFilter
}

export function useAttachments(roomId: string) {
  const [state, setState] = useState<AttachmentsState>({
    items:   [],
    loading: false,
    hasMore: false,
    filter:  'all',
  })

  const load = useCallback(async (filter: AttachmentFilter, replace: boolean) => {
    setState(s => ({ ...s, loading: true }))
    try {
      const page = await fetchRoomAttachments({
        roomId,
        filter,
        limit: PAGE_SIZE,
        before: replace ? undefined : (state.items[state.items.length - 1]?.created_at),
      })
      setState(s => ({
        ...s,
        loading: false,
        hasMore: page.length === PAGE_SIZE,
        items:   replace ? page : [...s.items, ...page],
      }))
    } catch {
      setState(s => ({ ...s, loading: false }))
    }
  }, [roomId, state.items])

  useEffect(() => {
    setState({ items: [], loading: false, hasMore: false, filter: 'all' })
    void fetchRoomAttachments({ roomId, filter: 'all', limit: PAGE_SIZE }).then(page => {
      setState({ items: page, loading: false, hasMore: page.length === PAGE_SIZE, filter: 'all' })
    })
  }, [roomId])

  const setFilter = useCallback((filter: AttachmentFilter) => {
    setState(s => ({ ...s, filter, items: [], hasMore: false }))
    void load(filter, true)
  }, [load])

  const loadMore = useCallback(() => {
    if (!state.loading && state.hasMore) void load(state.filter, false)
  }, [state, load])

  return {
    items:    state.items,
    loading:  state.loading,
    hasMore:  state.hasMore,
    filter:   state.filter,
    setFilter,
    loadMore,
  }
}
