import { useState, useEffect, useRef } from 'react'
import { Loader2, X } from 'lucide-react'
import { searchAllRooms } from '../../services/searchService'
import type { SearchResult } from '../../services/searchService'
import { formatMessageTime } from '../../lib/date'

interface Props {
  query:          string
  onClose:        () => void
  onRoomSelect:   (roomId: string, messageId: string) => void
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text
  const q = query.trim()
  if (!q) return text
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(re)
  return parts.map((p, i) =>
    re.test(p) ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/60 text-inherit rounded-sm px-px">{p}</mark> : p,
  )
}

export function GlobalSearchPanel({ query, onClose, onRoomSelect }: Props) {
  const [results,  setResults]  = useState<SearchResult[]>([])
  const [loading,  setLoading]  = useState(false)
  const [searched, setSearched] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (!q) { setResults([]); setSearched(''); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchAllRooms(q)
        setResults(data)
        setSearched(q)
      } finally {
        setLoading(false)
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // Group by room
  const grouped = results.reduce<Record<string, { roomName: string | null; items: SearchResult[] }>>((acc, r) => {
    if (!acc[r.room_id]) acc[r.room_id] = { roomName: r.room_name, items: [] }
    acc[r.room_id].items.push(r)
    return acc
  }, {})

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col overflow-hidden"
      style={{ background: 'var(--card)' }}
    >
      {/* 헤더 */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--line)' }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>통합검색</span>
        <button
          onClick={onClose}
          className="p-1 rounded transition-colors"
          style={{ color: 'var(--ink-3)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <X size={16} />
        </button>
      </div>

      {/* 결과 */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--ink-4)' }} />
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-sm" style={{ color: 'var(--ink-4)' }}>
            <span>검색 결과가 없습니다</span>
          </div>
        )}

        {!loading && Object.entries(grouped).map(([roomId, { roomName, items }]) => (
          <div key={roomId}>
            <div
              className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--ink-4)', background: 'var(--bg)' }}
            >
              {roomName ?? '알 수 없는 방'}
            </div>
            {items.map(item => {
              const text = item.content ?? item.content_original ?? ''
              return (
                <button
                  key={item.id}
                  onClick={() => onRoomSelect(roomId, item.id)}
                  className="w-full text-left px-4 py-3 flex flex-col gap-0.5 border-b transition-colors"
                  style={{ borderColor: 'var(--line)' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium truncate" style={{ color: 'var(--brand)' }}>
                      {item.sender_name ?? '알 수 없음'}
                    </span>
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--ink-4)' }}>
                      {formatMessageTime(item.created_at)}
                    </span>
                  </div>
                  <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--ink)' }}>
                    {highlightText(text, searched)}
                  </p>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
