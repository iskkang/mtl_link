import { useState, useEffect } from 'react'
import { ChevronLeft, ExternalLink, Loader2, Check, ChevronDown, ChevronUp } from 'lucide-react'
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
  const { t } = useTranslation()
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState<ActiveTab>('query')

  // Query tab state
  const [input,           setInput]           = useState('')
  const [detectedType,    setDetectedType]    = useState<TrackingType>('unknown')
  const [guessedCarrier,  setGuessedCarrier]  = useState<Carrier | null>(null)
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null)
  const [carrierOpen,     setCarrierOpen]     = useState(false)

  // Manual memo form (collapsible)
  const [memoOpen,        setMemoOpen]        = useState(false)
  const [currentStatus,   setCurrentStatus]   = useState('')
  const [currentLocation, setCurrentLocation] = useState('')
  const [eta,             setEta]             = useState('')
  const [memo,            setMemo]            = useState('')
  const [saving,          setSaving]          = useState(false)
  const [saveSuccess,     setSaveSuccess]     = useState(false)

  // History tab
  const [history,        setHistory]        = useState<TrackingRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedId,     setExpandedId]     = useState<string | null>(null)

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

  const handleOpenTracking = () => {
    if (!activeCarrier || !input.trim()) return
    const url = activeCarrier.trackingUrl(input.trim().toUpperCase())
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleSave = async () => {
    if (!input.trim() || !user) return
    setSaving(true)
    await supabase.from('tracking_helpers').insert({
      created_by:            user.id,
      tracking_no:           input.trim().toUpperCase(),
      tracking_type:         detectedType,
      carrier_name:          activeCarrier?.name ?? null,
      official_tracking_url: activeCarrier ? activeCarrier.trackingUrl(input.trim().toUpperCase()) : null,
      current_status:        currentStatus.trim() || null,
      current_location:      currentLocation.trim() || null,
      eta:                   eta || null,
      memo:                  memo.trim() || null,
    })
    setSaving(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2500)
  }

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

            {/* Detection result + carrier selector + deep-link */}
            {input.trim() && (
              <div
                className="rounded-xl px-4 py-3 flex flex-col gap-3"
                style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
              >
                {/* Type badge + guessed carrier */}
                <div className="flex items-center gap-2 flex-wrap">
                  <TypeBadge type={detectedType} t={t} />
                  {guessedCarrier && (
                    <span className="text-xs" style={{ color: 'var(--ink-3)' }}>
                      {t('trackingCarrier')}: {guessedCarrier.name}
                    </span>
                  )}
                </div>

                {/* Carrier selector dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCarrierOpen(v => !v)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border w-full text-left"
                    style={{ background: 'var(--chat-bg)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                  >
                    <span className="flex-1">
                      {activeCarrier?.name ?? t('trackingCarrier')}
                    </span>
                    <ChevronDown size={12} />
                  </button>
                  {carrierOpen && (
                    <div
                      className="absolute left-0 top-full mt-1 w-full rounded-xl border shadow-lg z-20 overflow-hidden"
                      style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
                    >
                      {[
                        { labelKey: 'trackingOcean', items: oceanCarriers },
                        { labelKey: 'trackingAir',   items: airCarriers },
                      ].map(group => (
                        <div key={group.labelKey}>
                          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-4)' }}>
                            {t(group.labelKey)}
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

                {/* Deep-link open button */}
                <button
                  type="button"
                  onClick={handleOpenTracking}
                  disabled={!activeCarrier}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                  style={{ background: 'var(--brand)' }}
                  onMouseEnter={e => { if (!(e.currentTarget as HTMLButtonElement).disabled) e.currentTarget.style.filter = 'brightness(1.1)' }}
                  onMouseLeave={e => (e.currentTarget.style.filter = '')}
                >
                  <ExternalLink size={14} />
                  {t('trackingOpenLink')}
                  {activeCarrier && (
                    <span className="font-normal opacity-80 text-xs">— {activeCarrier.name}</span>
                  )}
                </button>

                {/* Preview URL */}
                {activeCarrier && (
                  <p className="text-[10px] break-all" style={{ color: 'var(--ink-4)' }}>
                    {activeCarrier.trackingUrl(input.trim().toUpperCase())}
                  </p>
                )}
              </div>
            )}

            {/* Manual memo save (collapsible) */}
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
            >
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold"
                style={{ color: 'var(--ink-3)' }}
                onClick={() => setMemoOpen(v => !v)}
              >
                {t('trackingMemoSave')}
                {memoOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {memoOpen && (
                <div className="px-4 pb-4 flex flex-col gap-3 border-t" style={{ borderColor: 'var(--line)' }}>
                  <div className="pt-3">
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
                        ? <><Check size={14} /> {t('trackingSaved')}</>
                        : t('trackingSave')}
                  </button>
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
                      {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--ink-4)', flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />}
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
