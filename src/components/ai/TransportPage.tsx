import { useState } from 'react'
import { ChevronLeft, Copy, Check, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

interface Props {
  onBack: () => void
}

type Urgency = 'low' | 'medium' | 'high'
type Budget  = 'low' | 'medium' | 'high'

const FLAG_KEYS = ['battery', 'dangerous', 'used', 'brand'] as const
type FlagKey = typeof FLAG_KEYS[number]

const FLAG_LABELS: Record<FlagKey, string> = {
  battery:   '배터리',
  dangerous: '위험물',
  used:      '중고품',
  brand:     '브랜드품',
}

function parseTransportResult(text: string) {
  const comparison  = /\[운송 모드 비교\]([\s\S]*?)(?=\[추천 모드\]|$)/i.exec(text)?.[1]?.trim() ?? ''
  const recommended = /\[추천 모드\]([\s\S]*?)(?=\[고객 제안 문구\]|$)/i.exec(text)?.[1]?.trim() ?? ''
  const proposal    = /\[고객 제안 문구\]([\s\S]*?)$/i.exec(text)?.[1]?.trim() ?? ''
  return (comparison || recommended || proposal)
    ? { comparison, recommended, proposal }
    : { comparison: text, recommended: '', proposal: '' }
}

export function TransportPage({ onBack }: Props) {
  const { t, i18n } = useTranslation()
  const { user, profile } = useAuth()

  const [itemName,    setItemName]    = useState('')
  const [weight,      setWeight]      = useState('')
  const [cbm,         setCbm]         = useState('')
  const [origin,      setOrigin]      = useState('')
  const [destination, setDestination] = useState('')
  const [urgency,     setUrgency]     = useState<Urgency>('medium')
  const [budget,      setBudget]      = useState<Budget>('medium')
  const [flags,       setFlags]       = useState<Set<FlagKey>>(new Set())
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [result,      setResult]      = useState<string | null>(null)
  const [copyState,   setCopyState]   = useState<string | null>(null)

  const toggleFlag = (f: FlagKey) =>
    setFlags(prev => { const next = new Set(prev); next.has(f) ? next.delete(f) : next.add(f); return next })

  const parsed = result ? parseTransportResult(result) : null

  const handleAnalyze = async () => {
    if (!itemName.trim() || !origin.trim() || !destination.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-transport', {
        body: {
          itemName,
          grossWeight:      weight.trim() || undefined,
          cbm:              cbm.trim()    || undefined,
          origin,
          destination,
          urgency,
          budgetSensitivity: budget,
          riskFlags:        [...flags].map(f => FLAG_LABELS[f]).join(', '),
          userLanguage:     profile?.preferred_language ?? i18n.language ?? 'ko',
          userId:           user?.id,
        },
      })
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)
      setResult(data?.result ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyState(key)
      setTimeout(() => setCopyState(null), 2000)
    } catch { /* ignore */ }
  }

  const urgencyLevels: Urgency[] = ['low', 'medium', 'high']
  const budgetLevels:  Budget[]  = ['low', 'medium', 'high']

  const levelLabel = (v: string) =>
    v === 'low' ? t('levelLow') : v === 'medium' ? t('levelMedium') : t('levelHigh')

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
          {t('transportTitle')}
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">

          {/* Item name */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
              {t('transportItem')} <span className="text-red-400">*</span>
            </label>
            <input
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
              style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
              placeholder="e.g. Auto parts / Electronics"
            />
          </div>

          {/* Origin + Destination */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                {t('transportOrigin')} <span className="text-red-400">*</span>
              </label>
              <input
                value={origin}
                onChange={e => setOrigin(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                placeholder="Korea / Busan"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                {t('transportDest')} <span className="text-red-400">*</span>
              </label>
              <input
                value={destination}
                onChange={e => setDestination(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                placeholder="Uzbekistan / Tashkent"
              />
            </div>
          </div>

          {/* Weight + CBM */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                {t('transportWeight')}
              </label>
              <input
                value={weight}
                onChange={e => setWeight(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                placeholder="500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                {t('transportCbm')}
              </label>
              <input
                value={cbm}
                onChange={e => setCbm(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                placeholder="2.5"
              />
            </div>
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-3)' }}>
              {t('transportUrgency')}
            </label>
            <div className="flex gap-2">
              {urgencyLevels.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setUrgency(v)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border"
                  style={{
                    background:  urgency === v ? 'var(--brand)' : 'var(--card)',
                    color:       urgency === v ? 'white'        : 'var(--ink-3)',
                    borderColor: urgency === v ? 'var(--brand)' : 'var(--line)',
                  }}
                >
                  {levelLabel(v)}
                </button>
              ))}
            </div>
          </div>

          {/* Budget sensitivity */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-3)' }}>
              {t('transportBudget')}
            </label>
            <div className="flex gap-2">
              {budgetLevels.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setBudget(v)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border"
                  style={{
                    background:  budget === v ? 'var(--brand)' : 'var(--card)',
                    color:       budget === v ? 'white'        : 'var(--ink-3)',
                    borderColor: budget === v ? 'var(--brand)' : 'var(--line)',
                  }}
                >
                  {levelLabel(v)}
                </button>
              ))}
            </div>
          </div>

          {/* Special flags */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-3)' }}>
              {t('transportFlags')}
            </label>
            <div className="flex flex-wrap gap-2">
              {FLAG_KEYS.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFlag(f)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
                  style={{
                    background:  flags.has(f) ? 'var(--brand)' : 'var(--card)',
                    color:       flags.has(f) ? 'white'        : 'var(--ink-3)',
                    borderColor: flags.has(f) ? 'var(--brand)' : 'var(--line)',
                  }}
                >
                  {FLAG_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Analyze button */}
          <button
            onClick={handleAnalyze}
            disabled={!itemName.trim() || !origin.trim() || !destination.trim() || loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
            style={{ background: 'var(--brand)' }}
            onMouseEnter={e => { if (!(e.currentTarget as HTMLButtonElement).disabled) e.currentTarget.style.filter = 'brightness(1.1)' }}
            onMouseLeave={e => (e.currentTarget.style.filter = '')}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                {t('transportAnalyzing')}
              </span>
            ) : t('transportAnalyze')}
          </button>

          {error && (
            <p className="text-xs text-center text-red-500">{error}</p>
          )}

          {/* Results */}
          {parsed && (
            <div className="flex flex-col gap-3 mt-1">
              {parsed.comparison && (
                <ResultSection
                  title="🚢 운송 모드 비교"
                  copyKey="comparison"
                  text={parsed.comparison}
                  onCopy={handleCopy}
                  copyState={copyState}
                  t={t}
                />
              )}
              {parsed.recommended && (
                <ResultSection
                  title="✅ 추천 모드"
                  copyKey="recommended"
                  text={parsed.recommended}
                  onCopy={handleCopy}
                  copyState={copyState}
                  t={t}
                />
              )}
              {parsed.proposal && (
                <ResultSection
                  title="💬 고객 제안 문구"
                  copyKey="proposal"
                  text={parsed.proposal}
                  onCopy={handleCopy}
                  copyState={copyState}
                  t={t}
                />
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

function ResultSection({
  title, copyKey, text, onCopy, copyState, t,
}: {
  title:     string
  copyKey:   string
  text:      string
  onCopy:    (text: string, key: string) => void
  copyState: string | null
  t:         (key: string) => string
}) {
  const copied = copyState === copyKey
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--line)', background: 'var(--card)' }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--line)' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
          {title}
        </span>
        <button
          onClick={() => onCopy(text, copyKey)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium"
          style={{ color: copied ? '#22C55E' : 'var(--ink-3)', background: 'var(--side-row)' }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? t('copySuccess') : t('copy')}
        </button>
      </div>
      <div className="px-4 py-3">
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ink)' }}>
          {text}
        </p>
      </div>
    </div>
  )
}
