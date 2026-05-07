import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, Plus, Search, Loader2, X, BookOpen, StickyNote } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

interface HsNote {
  id:                 string
  item_name:          string
  item_description:   string | null
  country:            string
  hs_code_candidate:  string | null
  customs_notes:      string | null
  risk_notes:         string | null
  source:             string | null
  confidence_label:   'High' | 'Medium' | 'Low' | null
  approval_status:    'draft' | 'pending_review' | 'verified' | 'rejected' | 'expired'
  created_at:         string
  created_by:         string
}

interface HsRef {
  id:          number
  level:       number
  code:        string
  description: string
  parent_code: string | null
}

interface Props {
  onBack: () => void
}

function statusColor(s: string): string {
  if (s === 'verified')       return '#22C55E'
  if (s === 'pending_review') return '#F59E0B'
  if (s === 'rejected')       return '#EF4444'
  return '#9CA3AF'
}

function confidenceColor(c: string | null): string {
  if (c === 'High')   return '#22C55E'
  if (c === 'Medium') return '#F59E0B'
  return '#9CA3AF'
}

export function HsCodePage({ onBack }: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()

  const [notes,      setNotes]      = useState<HsNote[]>([])
  const [refResults, setRefResults] = useState<HsRef[]>([])
  const [search,     setSearch]     = useState('')
  const [loading,    setLoading]    = useState(true)
  const [refLoading, setRefLoading] = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Form fields
  const [itemName,      setItemName]      = useState('')
  const [itemDesc,      setItemDesc]      = useState('')
  const [country,       setCountry]       = useState('')
  const [hsCode,        setHsCode]        = useState('')
  const [customsNotes,  setCustomsNotes]  = useState('')
  const [riskNotes,     setRiskNotes]     = useState('')
  const [source,        setSource]        = useState('')
  const [confidence,    setConfidence]    = useState<'High' | 'Medium' | 'Low'>('Medium')
  const [saving,        setSaving]        = useState(false)

  const loadNotes = async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('hs_code_notes')
      .select('*')
      .or(`created_by.eq.${user.id},approval_status.eq.verified`)
      .order('created_at', { ascending: false })
    setNotes((data as HsNote[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { void loadNotes() }, [user])

  // Debounced reference search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!search.trim()) {
      setRefResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setRefLoading(true)
      const q = search.trim()
      const { data } = await supabase
        .from('hs_code_reference')
        .select('id, level, code, description, parent_code')
        .or(`code.ilike.%${q}%,description.ilike.%${q}%`)
        .order('level')
        .limit(20)
      setRefResults((data as HsRef[]) ?? [])
      setRefLoading(false)
    }, 300)
  }, [search])

  const filteredNotes = notes.filter(n =>
    !search ||
    n.item_name.toLowerCase().includes(search.toLowerCase()) ||
    (n.hs_code_candidate ?? '').includes(search)
  )

  const resetForm = () => {
    setItemName(''); setItemDesc(''); setCountry(''); setHsCode('')
    setCustomsNotes(''); setRiskNotes(''); setSource(''); setConfidence('Medium')
    setShowForm(false)
  }

  const handleRefClick = (ref: HsRef) => {
    setHsCode(ref.code)
    setItemDesc(ref.description)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!itemName.trim() || !country.trim() || !user) return
    setSaving(true)
    await supabase.from('hs_code_notes').insert({
      item_name:         itemName.trim(),
      item_description:  itemDesc.trim() || null,
      country:           country.trim(),
      hs_code_candidate: hsCode.trim() || null,
      customs_notes:     customsNotes.trim() || null,
      risk_notes:        riskNotes.trim() || null,
      source:            source.trim() || null,
      confidence_label:  confidence,
      approval_status:   'draft' as const,
      created_by:        user.id,
    })
    setSaving(false)
    resetForm()
    void loadNotes()
  }

  const statusLabel = (s: string) => {
    if (s === 'verified')       return t('statusVerified')
    if (s === 'pending_review') return t('statusPending')
    if (s === 'rejected')       return t('statusRejected')
    return t('statusDraft')
  }

  const levelBadge = (level: number) => {
    const colors: Record<number, string> = { 2: '#6366F1', 4: '#0EA5E9', 6: '#10B981' }
    return colors[level] ?? '#9CA3AF'
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--chat-bg)' }}>

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
      >
        <div className="flex items-center gap-2">
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
            {t('hsCodeTitle')}
          </h1>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
          style={{ background: 'var(--brand)' }}
          onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
          onMouseLeave={e => (e.currentTarget.style.filter = '')}
        >
          {showForm ? <X size={13} /> : <Plus size={13} />}
          {t('hsCodeAdd')}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">

          {/* Search */}
          <div className="relative">
            {refLoading
              ? <Loader2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: 'var(--ink-4)' }} />
              : <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-4)' }} />}
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('hsCodeSearch')}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none border"
              style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
            />
          </div>

          {/* Add form */}
          {showForm && (
            <div
              className="rounded-2xl border p-4 flex flex-col gap-3"
              style={{ background: 'var(--card)', borderColor: 'var(--brand)' }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                    품목명 <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={itemName}
                    onChange={e => setItemName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                    style={{ background: 'var(--chat-bg)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                    placeholder="e.g. 자동차 브레이크 패드"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                    품목 설명
                  </label>
                  <input
                    value={itemDesc}
                    onChange={e => setItemDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                    style={{ background: 'var(--chat-bg)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                    국가 <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={country}
                    onChange={e => setCountry(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                    style={{ background: 'var(--chat-bg)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                    placeholder="Korea → Uzbekistan"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                    HS-code 후보
                  </label>
                  <input
                    value={hsCode}
                    onChange={e => setHsCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                    style={{ background: 'var(--chat-bg)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                    placeholder="8708.30"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                    통관 메모
                  </label>
                  <textarea
                    value={customsNotes}
                    onChange={e => setCustomsNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none border resize-none"
                    style={{ background: 'var(--chat-bg)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                    출처/확인자
                  </label>
                  <input
                    value={source}
                    onChange={e => setSource(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                    style={{ background: 'var(--chat-bg)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-3)' }}>
                    신뢰도
                  </label>
                  <div className="flex gap-2">
                    {(['High', 'Medium', 'Low'] as const).map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setConfidence(v)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                        style={{
                          background:  confidence === v ? 'var(--brand)' : 'var(--chat-bg)',
                          color:       confidence === v ? 'white'        : 'var(--ink-3)',
                          borderColor: confidence === v ? 'var(--brand)' : 'var(--line)',
                        }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={() => void handleSave()}
                disabled={!itemName.trim() || !country.trim() || saving}
                className="w-full py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                style={{ background: 'var(--brand)' }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : '저장'}
              </button>
            </div>
          )}

          {/* ── 표준 HS 코드 검색 결과 ── */}
          {search.trim() && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen size={12} style={{ color: 'var(--ink-4)' }} />
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-4)' }}>
                  표준 HS 코드
                </span>
              </div>
              {refLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={16} className="animate-spin" style={{ color: 'var(--ink-4)' }} />
                </div>
              ) : refResults.length === 0 ? (
                <p className="text-xs text-center py-3" style={{ color: 'var(--ink-4)' }}>결과 없음</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {refResults.map(ref => (
                    <button
                      key={ref.id}
                      type="button"
                      onClick={() => handleRefClick(ref)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left border transition-all"
                      style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.background = 'var(--blue-soft)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--card)' }}
                    >
                      <span
                        className="text-xs font-bold font-mono flex-shrink-0 w-14 text-center py-0.5 rounded"
                        style={{ background: levelBadge(ref.level) + '20', color: levelBadge(ref.level) }}
                      >
                        {ref.code}
                      </span>
                      <span className="text-xs flex-1 leading-snug" style={{ color: 'var(--ink)' }}>
                        {ref.description}
                      </span>
                      <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--ink-4)' }}>
                        Lv.{ref.level}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── 내부 메모 ── */}
          <div>
            {search.trim() && (
              <div className="flex items-center gap-1.5 mb-2">
                <StickyNote size={12} style={{ color: 'var(--ink-4)' }} />
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-4)' }}>
                  내부 메모
                </span>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--ink-4)' }} />
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <p className="text-sm" style={{ color: 'var(--ink-4)' }}>
                  {search ? '검색 결과 없음' : t('hsCodeEmpty')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredNotes.map(note => (
                  <div
                    key={note.id}
                    className="rounded-2xl border p-4"
                    style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                        {note.item_name}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {note.confidence_label && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{
                              background: confidenceColor(note.confidence_label) + '20',
                              color:      confidenceColor(note.confidence_label),
                            }}
                          >
                            {note.confidence_label}
                          </span>
                        )}
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{
                            background: statusColor(note.approval_status) + '20',
                            color:      statusColor(note.approval_status),
                          }}
                        >
                          {statusLabel(note.approval_status)}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs mb-1" style={{ color: 'var(--ink-3)' }}>
                      {note.country}
                    </p>
                    {note.hs_code_candidate && (
                      <p className="text-xs font-mono mb-1" style={{ color: 'var(--brand)' }}>
                        HS: {note.hs_code_candidate}
                      </p>
                    )}
                    {note.customs_notes && (
                      <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--ink-3)' }}>
                        {note.customs_notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
