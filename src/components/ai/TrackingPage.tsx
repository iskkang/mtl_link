import { useState, useEffect } from 'react'
import { ChevronLeft, ExternalLink, Loader2, Copy, Check, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import {
  detectTrackingType,
  guessCarrier,
  CARRIERS,
  type TrackingType,
  type Carrier,
} from '../../lib/trackingUtils'

interface TrackingRecord {
  id:                    string
  tracking_no:           string
  tracking_type:         TrackingType
  carrier_name:          string | null
  official_tracking_url: string | null
  current_status:        string | null
  current_location:      string | null
  eta:                   string | null
  memo:                  string | null
  customer_message:      string | null
  created_at:            string
}

interface Props {
  onBack: () => void
}

type ActiveTab = 'query' | 'history'

function TypeBadge({ type, t }: { type: TrackingType; t: (k: string) => string }) {
  const colors: Record<TrackingType, string> = {
    ocean_container: '#0EA5E9',
    air_awb:         '#8B5CF6',
    bl:              '#F59E0B',
    booking:         '#10B981',
    unknown:         '#9CA3AF',
  }
  const labels: Record<TrackingType, string> = {
    ocean_container: t('trackingContainerType'),
    air_awb:         t('trackingAirType'),
    bl:              'B/L',
    booking:         'Booking',
    unknown:         t('trackingUnknownType'),
  }
  const c = colors[type]
  return (
    <span
      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: c + '20', color: c }}
    >
      {labels[type]}
    </span>
  )
}

export function TrackingPage({ onBack }: Props) {
  const { t, i18n } = useTranslation()
  const { user, profile } = useAuth()

  const [activeTab,   setActiveTab]   = useState<ActiveTab>('query')

  // Query tab state
  const [input,       setInput]       = useState('')
  const [detectedType, setDetectedType] = useState<TrackingType>('unknown')
  const [guessedCarrier, setGuessedCarrier] = useState<Carrier | null>(null)
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null)
  const [carrierOpen, setCarrierOpen] = useState(false)

  // Manual status form
  const [currentStatus,   setCurrentStatus]   = useState('')
  const [currentLocation, setCurrentLocation] = useState('')
  const [eta,             setEta]             = useState('')
  const [memo,            setMemo]            = useState('')
  const [saving,          setSaving]          = useState(false)
  const [saveSuccess,     setSaveSuccess]     = useState(false)

  // Customer notice
  const [noticeLanguage, setNoticeLanguage] = useState(profile?.preferred_language ?? i18n.language ?? 'ko')
  const [generating,     setGenerating]     = useState(false)
  const [notice,         setNotice]         = useState<string | null>(null)
  const [noticeError,    setNoticeError]    = useState<string | null>(null)
  const [copied,         setCopied]         = useState(false)

  // History tab
  const [history,         setHistory]         = useState<TrackingRecord[]>([])
  const [historyLoading,  setHistoryLoading]  = useState(false)
  const [expandedId,      setExpandedId]      = useState<string | null>(null)

  // Detect type and guess carrier on input change
  useEffect(() => {
    const clean = input.trim()
    if (!clean) {
      setDetectedType('unknown')
      setGuessedCarrier(null)
      setSelectedCarrier(null)
      return
    }
    const type    = detectTrackingType(clean)
    const carrier = guessCarrier(clean, type)
    setDetectedType(type)
    setGuessedCarrier(carrier)
    setSelectedCarrier(carrier)
  }, [input])

  const loadHistory = async () => {
    if (!user) return
    setHistoryLoading(true)
    const { data } = await supabase
      .from('tracking_helpers')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setHistory((data as TrackingRecord[]) ?? [])
    setHistoryLoading(false)
  }

  useEffect(() => {
    if (activeTab === 'history') void loadHistory()
  }, [activeTab, user])

  const activeCarrier = selectedCarrier ?? guessedCarrier

  const handleSave = async () => {
    if (!input.trim() || !user) return
    setSaving(true)
    await supabase.from('tracking_helpers').insert({
      created_by:            user.id,
      tracking_no:           input.trim().toUpperCase(),
      tracking_type:         detectedType,
      carrier_name:          activeCarrier?.name ?? null,
      official_tracking_url: activeCarrier?.url ?? null,
      current_status:        currentStatus.trim() || null,
      current_location:      currentLocation.trim() || null,
      eta:                   eta || null,
      memo:                  memo.trim() || null,
    })
    setSaving(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2500)
  }

  const handleGenerate = async () => {
    if (!input.trim() || !currentStatus.trim() || !user) return
    setGenerating(true)
    setNotice(null)
    setNoticeError(null)

    const { data, error: fnError } = await supabase.functions.invoke('ai-tracking-message', {
      body: {
        trackingNo:      input.trim().toUpperCase(),
        carrierName:     activeCarrier?.name ?? '',
        currentStatus:   currentStatus.trim(),
        currentLocation: currentLocation.trim(),
        eta,
        memo:            memo.trim() || undefined,
        language:        noticeLanguage,
        userLanguage:    profile?.preferred_language ?? i18n.language ?? 'ko',
        userId:          user.id,
      },
    })

    if (fnError || data?.error) {
      setNoticeError(fnError?.message ?? data?.error ?? 'Error')
    } else {
      setNotice(data?.result ?? '')
    }
    setGenerating(false)
  }

  const handleCopy = async () => {
    if (!notice) return
    await navigator.clipboard.writeText(notice)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const LANG_OPTIONS = [
    { code: 'ko', label: '한국어' },
    { code: 'en', label: 'English' },
    { code: 'ru', label: 'Русский' },
    { code: 'uz', label: "O'zbek" },
    { code: 'zh', label: '中文' },
    { code: 'ja', label: '日本語' },
  ]

  const oceanCarriers = CARRIERS.filter(c => c.type === 'ocean')
  const airCarriers   = CARRIERS.filter(c => c.type === 'air')

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
          {t('trackingTitle')}
        </h1>
      </div>

      {/* Tabs */}
      <div
        className="flex border-b flex-shrink-0"
        style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
      >
        {(['query', 'history'] as ActiveTab[]).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2.5 text-xs font-semibold border-b-2 transition-all"
            style={{
              borderColor: activeTab === tab ? 'var(--brand)' : 'transparent',
              color:       activeTab === tab ? 'var(--brand)' : 'var(--ink-3)',
            }}
          >
            {tab === 'query' ? t('trackingNewQuery') : t('trackingHistory')}
          </button>
        ))}
      </div>

      {/* ──────────────── Query Tab ──────────────── */}
      {activeTab === 'query' && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-2xl mx-auto flex flex-col gap-4">

            {/* Number input */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-3)' }}>
                {t('trackingInput')}
              </label>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="FESU1234567 / 180-12345678 / ..."
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none border font-mono"
                style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
              />
            </div>

            {/* Type detection result */}
            {input.trim() && (
              <div
                className="rounded-xl px-4 py-3 flex flex-col gap-2.5"
                style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <TypeBadge type={detectedType} t={t} />
                  {guessedCarrier && (
                    <span className="text-xs" style={{ color: 'var(--ink-3)' }}>
                      {guessedCarrier.name} 추정
                    </span>
                  )}
                </div>

                {/* Official link */}
                {activeCarrier && (
                  <a
                    href={activeCarrier.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium w-fit"
                    style={{ color: 'var(--brand)' }}
                  >
                    <ExternalLink size={12} />
                    {t('trackingOpenLink')} — {activeCarrier.name}
                  </a>
                )}

                {/* Carrier selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCarrierOpen(v => !v)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border w-full text-left"
                    style={{ background: 'var(--chat-bg)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                  >
                    <span className="flex-1">
                      {t('trackingCarrier')}: {activeCarrier?.name ?? '선택…'}
                    </span>
                    <ChevronDown size={12} />
                  </button>
                  {carrierOpen && (
                    <div
                      className="absolute left-0 top-full mt-1 w-full rounded-xl border shadow-lg z-20 overflow-hidden"
                      style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
                    >
                      {[
                        { label: '── 해상 ──', items: oceanCarriers },
                        { label: '── 항공 ──', items: airCarriers },
                      ].map(group => (
                        <div key={group.label}>
                          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-4)' }}>
                            {group.label}
                          </p>
                          {group.items.map(c => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => { setSelectedCarrier(c); setCarrierOpen(false) }}
                              className="w-full text-left px-3 py-2 text-xs"
                              style={{
                                background: activeCarrier?.code === c.code ? 'var(--blue-soft)' : 'transparent',
                                color: 'var(--ink)',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
                              onMouseLeave={e => (e.currentTarget.style.background = activeCarrier?.code === c.code ? 'var(--blue-soft)' : 'transparent')}
                            >
                              {c.name}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Manual status form */}
            <div
              className="rounded-2xl border p-4 flex flex-col gap-3"
              style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
            >
              <p className="text-xs font-semibold" style={{ color: 'var(--ink-3)' }}>수동 상태 입력</p>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                  {t('trackingStatus')}
                </label>
                <input
                  value={currentStatus}
                  onChange={e => setCurrentStatus(e.target.value)}
                  placeholder="Departed Busan Port"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                  style={{ background: 'var(--chat-bg)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                    {t('trackingLocation')}
                  </label>
                  <input
                    value={currentLocation}
                    onChange={e => setCurrentLocation(e.target.value)}
                    placeholder="Busan, Korea"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                    style={{ background: 'var(--chat-bg)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                    {t('trackingEta')}
                  </label>
                  <input
                    type="date"
                    value={eta}
                    onChange={e => setEta(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                    style={{ background: 'var(--chat-bg)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                  {t('trackingMemo')}
                </label>
                <textarea
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none border resize-none"
                  style={{ background: 'var(--chat-bg)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                />
              </div>

              <button
                onClick={() => void handleSave()}
                disabled={!input.trim() || saving}
                className="w-full py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                style={{ background: saveSuccess ? '#22C55E' : 'var(--brand)' }}
              >
                {saving
                  ? <Loader2 size={14} className="animate-spin" />
                  : saveSuccess
                    ? <><Check size={14} /> 저장됨</>
                    : t('trackingSave')}
              </button>
            </div>

            {/* Customer notice generation */}
            <div
              className="rounded-2xl border p-4 flex flex-col gap-3"
              style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
            >
              <p className="text-xs font-semibold" style={{ color: 'var(--ink-3)' }}>고객 안내문 생성</p>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-3)' }}>출력 언어</label>
                <div className="flex flex-wrap gap-1.5">
                  {LANG_OPTIONS.map(l => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setNoticeLanguage(l.code)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all"
                      style={{
                        background:  noticeLanguage === l.code ? 'var(--brand)' : 'transparent',
                        color:       noticeLanguage === l.code ? 'white'        : 'var(--ink-3)',
                        borderColor: noticeLanguage === l.code ? 'var(--brand)' : 'var(--line)',
                      }}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => void handleGenerate()}
                disabled={!input.trim() || !currentStatus.trim() || generating}
                className="w-full py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                style={{ background: 'var(--brand)' }}
                onMouseEnter={e => { if (!(e.currentTarget as HTMLButtonElement).disabled) e.currentTarget.style.filter = 'brightness(1.1)' }}
                onMouseLeave={e => (e.currentTarget.style.filter = '')}
              >
                {generating
                  ? <><Loader2 size={14} className="animate-spin" /> 생성 중…</>
                  : t('trackingGenerate')}
              </button>

              {noticeError && (
                <p className="text-xs text-center text-red-500">{noticeError}</p>
              )}

              {notice && (
                <div
                  className="rounded-xl border overflow-hidden"
                  style={{ borderColor: 'var(--line)' }}
                >
                  <div
                    className="flex items-center justify-between px-3 py-2 border-b"
                    style={{ borderColor: 'var(--line)', background: 'var(--chat-bg)' }}
                  >
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--ink-3)' }}>
                      안내문
                    </span>
                    <button
                      onClick={() => void handleCopy()}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium"
                      style={{ color: copied ? '#22C55E' : 'var(--ink-3)', background: 'var(--side-row)' }}
                    >
                      {copied ? <Check size={11} /> : <Copy size={11} />}
                      {copied ? t('copySuccess') : t('copy')}
                    </button>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ink)' }}>
                      {notice}
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ──────────────── History Tab ──────────────── */}
      {activeTab === 'history' && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-2xl mx-auto flex flex-col gap-2">

            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--ink-4)' }} />
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-sm" style={{ color: 'var(--ink-4)' }}>{t('trackingEmptyHistory')}</p>
              </div>
            ) : (
              history.map(rec => {
                const isExpanded = expandedId === rec.id
                return (
                  <div
                    key={rec.id}
                    className="rounded-2xl border overflow-hidden"
                    style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
                  >
                    <button
                      type="button"
                      className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left"
                      onClick={() => setExpandedId(prev => (prev === rec.id ? null : rec.id))}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold font-mono" style={{ color: 'var(--ink)' }}>
                            {rec.tracking_no}
                          </span>
                          <TypeBadge type={rec.tracking_type} t={t} />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {rec.carrier_name && (
                            <span className="text-xs" style={{ color: 'var(--ink-3)' }}>{rec.carrier_name}</span>
                          )}
                          {rec.current_status && (
                            <span className="text-xs truncate" style={{ color: 'var(--ink-4)' }}>{rec.current_status}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {rec.eta && (
                            <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>
                              ETA: {rec.eta}
                            </span>
                          )}
                          <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>
                            {new Date(rec.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div
                        className="px-4 pb-4 pt-2 border-t flex flex-col gap-2"
                        style={{ borderColor: 'var(--line)' }}
                      >
                        {rec.current_location && (
                          <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
                            📍 {rec.current_location}
                          </p>
                        )}
                        {rec.memo && (
                          <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
                            📝 {rec.memo}
                          </p>
                        )}
                        {rec.official_tracking_url && (
                          <a
                            href={rec.official_tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs font-medium w-fit"
                            style={{ color: 'var(--brand)' }}
                          >
                            <ExternalLink size={12} />
                            {t('trackingOpenLink')}
                          </a>
                        )}
                        {rec.customer_message && (
                          <div
                            className="rounded-lg p-3 mt-1"
                            style={{ background: 'var(--chat-bg)' }}
                          >
                            <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--ink-4)' }}>안내문</p>
                            <p className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--ink)' }}>
                              {rec.customer_message}
                            </p>
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
      )}
    </div>
  )
}
