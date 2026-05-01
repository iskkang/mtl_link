import { useState, useMemo, useEffect, useCallback } from 'react'
import type { MessageWithSender } from '../types/chat'

interface UseMessageSearchResult {
  results:    MessageWithSender[]
  currentIdx: number
  total:      number
  current:    MessageWithSender | null
  goNext:     () => void
  goPrev:     () => void
  canGoNext:  boolean
  canGoPrev:  boolean
}

export function useMessageSearch(
  messages: MessageWithSender[],
  query: string,
): UseMessageSearchResult {
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [currentIdx, setCurrentIdx] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    setCurrentIdx(0)
  }, [debouncedQuery])

  const results = useMemo(() => {
    const q = debouncedQuery.toLowerCase()
    if (!q) return []
    return messages
      .filter(m =>
        !m.deleted_at &&
        (
          m.content?.toLowerCase().includes(q) ||
          m.content_original?.toLowerCase().includes(q)
        ),
      )
      .slice()
      .reverse()
  }, [messages, debouncedQuery])

  const total = results.length

  const goNext = useCallback(() => {
    setCurrentIdx(i => Math.min(i + 1, total - 1))
  }, [total])

  const goPrev = useCallback(() => {
    setCurrentIdx(i => Math.max(i - 1, 0))
  }, [])

  return {
    results,
    currentIdx,
    total,
    current:   results[currentIdx] ?? null,
    goNext,
    goPrev,
    canGoNext: currentIdx < total - 1,
    canGoPrev: currentIdx > 0,
  }
}
