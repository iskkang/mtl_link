import { useState, useEffect } from 'react'
import { ChevronLeft, Loader2, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

type KbStatus   = 'draft' | 'pending_review' | 'verified' | 'rejected' | 'expired'
type KbCategory = 'hs' | 'customs' | 'message' | 'quotation' | 'tracking' | 'claim' | 'general'
type FilterTab  = 'all' | 'verified' | 'pending_review' | 'draft'

interface KbItem {
  id:            string
  title:         string
  category:      KbCategory
  content:       string
  tags:          string[] | null
  country:       string | null
  status:        KbStatus
  created_by:    string
  approved_by:   string | null
  created_at:    string
}

interface Props {
  onBack: () => void
}

function statusColor(s: KbStatus): string {
  if (s === 'verified')       return '#22C55E'
  if (s === 'pending_review') return '#F59E0B'
  if (s === 'rejected')       return '#EF4444'
  return '#9CA3AF'
}

export function KnowledgePage({ onBack }: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()

  const [items,      setItems]      = useState<KbItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState<FilterTab>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleting,   setDeleting]   = useState<string | null>(null)

  const load = async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('knowledge_base')
      .select('*')
      .order('created_at', { ascending: false })
    setItems((data as KbItem[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [user])

  const filtered = items.filter(item => {
    if (filter === 'all')            return true
    if (filter === 'pending_review') return item.status === 'pending_review'
    return item.status === filter
  })

  const handleDelete = async (id: string) => {
    setDeleting(id)
    await supabase.from('knowledge_base').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    setDeleting(null)
  }

  const statusLabel = (s: KbStatus) => {
    if (s === 'verified')       return t('statusVerified')
    if (s === 'pending_review') return t('statusPending')
    if (s === 'rejected')       return t('statusRejected')
    return t('statusDraft')
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all',            label: '전체' },
    { key: 'verified',       label: t('statusVerified') },
    { key: 'pending_review', label: t('statusPending') },
    { key: 'draft',          label: t('statusDraft') },
  ]

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--chat-bg)' }}>

      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
      >
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg flex-shrink-0"
          style={{ color: 'var(--ink-3)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          aria-label="Back"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-sm font-bold" style={{ color: 'var(--ink-1)' }}>
          {t('knowledgeTitle')}
        </h1>
      </div>

      {/* Filter tabs */}
      <div
        className="flex gap-1 px-4 py-2 border-b flex-shrink-0 overflow-x-auto"
        style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
      >
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className="px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all border"
            style={{
              background:  filter === tab.key ? 'var(--brand)' : 'transparent',
              color:       filter === tab.key ? 'white'        : 'var(--ink-3)',
              borderColor: filter === tab.key ? 'var(--brand)' : 'transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-2">

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--ink-4)' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-sm" style={{ color: 'var(--ink-4)' }}>항목이 없어요</p>
            </div>
          ) : (
            filtered.map(item => {
              const isExpanded = expandedId === item.id
              const isOwn      = item.created_by === user?.id
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border overflow-hidden"
                  style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
                >
                  {/* Item header — click to expand */}
                  <button
                    type="button"
                    className="w-full flex items-start justify-between gap-3 p-4 text-left"
                    onClick={() => setExpandedId(prev => (prev === item.id ? null : item.id))}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
                          {item.title}
                        </span>
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            background: statusColor(item.status) + '20',
                            color:      statusColor(item.status),
                          }}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded border"
                          style={{ color: 'var(--ink-4)', borderColor: 'var(--line)' }}
                        >
                          {item.category}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                      {isOwn && (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); void handleDelete(item.id) }}
                          className="p-1.5 rounded-lg"
                          style={{ color: '#EF4444' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          disabled={deleting === item.id}
                        >
                          {deleting === item.id
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Trash2 size={13} />}
                        </button>
                      )}
                      {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--ink-4)' }} /> : <ChevronDown size={14} style={{ color: 'var(--ink-4)' }} />}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div
                      className="px-4 pb-4 pt-0 border-t"
                      style={{ borderColor: 'var(--line)' }}
                    >
                      <p
                        className="text-sm leading-relaxed whitespace-pre-wrap mt-3"
                        style={{ color: 'var(--ink)' }}
                      >
                        {item.content}
                      </p>
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {item.tags.map(tag => (
                            <span
                              key={tag}
                              className="text-[10px] px-2 py-0.5 rounded-full border"
                              style={{ color: 'var(--ink-3)', borderColor: 'var(--line)' }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}

        </div>
      </div>
    </div>
  )
}
