import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import type { MessageWithSender } from '../types/chat'

interface UseMessageSearchResult {
  results:      MessageWithSender[]
  currentIdx:   number
  total:        number
  current:      MessageWithSender | null
  goNext:       () => void
  goPrev:       () => void
  canGoNext:    boolean
  canGoPrev:    boolean
  forceSearch:  (q: string) => void
}

export function useMessageSearch(
  messages: MessageWithSender[],
  query: string,
): UseMessageSearchResult {
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [currentIdx, setCurrentIdx] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query])

  useEffect(() => {
    setCurrentIdx(0)
  }, [debouncedQuery])

  const forceSearch = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setDebouncedQuery(q.trim())
  }, [])

  const results = useMemo(() => {
    const q = debouncedQuery.normalize('NFC').toLowerCase()
    if (!q) return []
    return messages
      .filter(m => {
        if (m.deleted_at) return false
        if (m.message_type === 'system') return false
        const content = (m.content ?? '').normalize('NFC').toLowerCase()
        const contentOriginal = (m.content_original ?? '').normalize('NFC').toLowerCase()
        const translatedText = (m._translatedText ?? '').normalize('NFC').toLowerCase()
        return content.includes(q) || contentOriginal.includes(q) || translatedText.includes(q)
      })
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
    current:    results[currentIdx] ?? null,
    goNext,
    goPrev,
    canGoNext:  currentIdx < total - 1,
    canGoPrev:  currentIdx > 0,
    forceSearch,
  }
}
