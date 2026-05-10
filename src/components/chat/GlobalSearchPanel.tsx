import { useState, useEffect, useRef, useMemo } from 'react'
import { Loader2, X, Image, Film, FileText, File, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { searchAllRoomsLegacy } from '../../services/searchService'
import type { LegacySearchResult } from '../../services/searchService'
import { formatMessageTime } from '../../lib/date'

interface Props {
  query:          string
  onClose:        () => void
  onRoomSelect:   (roomId: string, messageId: string) => void
}

type AttachmentFilter = 'all' | 'image' | 'video' | 'document' | 'archive' | 'other'

const ATTACHMENT_FILTERS: { key: AttachmentFilter; icon: React.ElementType | null; labelKey: string }[] = [
  { key: 'all',      icon: null,     labelKey: 'searchFilter_all'      },
  { key: 'image',    icon: Image,    labelKey: 'searchFilter_image'    },
  { key: 'video',    icon: Film,     labelKey: 'searchFilter_video'    },
  { key: 'document', icon: FileText, labelKey: 'searchFilter_document' },
  { key: 'other',    icon: File,     labelKey: 'searchFilter_other'    },
]

function AttachmentIcon({ type }: { type: string | null | undefined }) {
  if (type === 'image')    return <Image    size={13} />
  if (type === 'video')    return <Film     size={13} />
  if (type === 'document') return <FileText size={13} />
  return <File size={13} />
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
  const { t } = useTranslation()
  const [results,  setResults]  = useState<LegacySearchResult[]>([])
  const [loading,  setLoading]  = useState(false)
  const [searched, setSearched] = useState('')
  const [filter,   setFilter]   = useState<AttachmentFilter>('all')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (!q) { setResults([]); setSearched(''); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchAllRoomsLegacy(q)
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

  const filteredResults = useMemo(() => {
    if (filter === 'all') return results
    // When a specific attachment type is selected, show only matching attachments
    return results.filter(r => r._attachment?.attachment_type === filter)
  }, [results, filter])

  // Group by room
  const grouped = filteredResults.reduce<Record<string, { roomName: string | null; items: LegacySearchResult[] }>>((acc, r) => {
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

      {/* 첨부 타입 chip 필터 */}
      <div
        className="flex gap-1.5 px-3 py-2 overflow-x-auto flex-shrink-0 border-b"
        style={{ borderColor: 'var(--line)' }}
      >
        {ATTACHMENT_FILTERS.map(f => {
          const Icon = f.icon
          const active = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs whitespace-nowrap transition-colors"
              style={{
                background: active ? 'var(--brand)' : 'var(--bg)',
                color:      active ? 'white' : 'var(--ink-2)',
                border:     `1px solid ${active ? 'var(--brand)' : 'var(--line)'}`,
              }}
            >
              {Icon && <Icon size={12} />}
              {t(f.labelKey)}
            </button>
          )
        })}
      </div>

      {/* 결과 */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--ink-4)' }} />
          </div>
        )}

        {!loading && searched && filteredResults.length === 0 && (
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
            {items.map(item => (
              <button
                key={`${item.id}-${item._attachment?.file_name ?? ''}`}
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

                {/* 첨부 결과: 파일 아이콘 + 파일명 */}
                {item._attachment ? (
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--ink-2)' }}>
                    <AttachmentIcon type={item._attachment.attachment_type} />
                    <span className="font-medium truncate">
                      {highlightText(item._attachment.file_name, searched)}
                    </span>
                  </div>
                ) : (
                  // 일반 메시지 / 번역 매칭: 본문 표시
                  <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--ink)' }}>
                    {highlightText(item.content ?? item.content_original ?? '', searched)}
                  </p>
                )}

                {/* 번역 매칭 배지 */}
                {item._translatedMatch && (
                  <div
                    className="flex items-start gap-1.5 mt-1.5 px-2 py-1 rounded text-xs"
                    style={{
                      color:      'var(--ink-2)',
                      background: 'var(--blue-soft)',
                      border:     '1px solid var(--line)',
                    }}
                  >
                    <Languages size={12} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--brand)' }} />
                    <div className="flex-1 min-w-0 truncate">
                      <span className="font-medium mr-1">{t('matchedInTranslation')}:</span>
                      {highlightText(item._translatedMatch, searched)}
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
