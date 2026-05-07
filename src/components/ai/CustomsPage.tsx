import { useState } from 'react'
import { ChevronLeft, Copy, Check, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

interface Props {
  onBack: () => void
}

function parseCustomsResult(text: string) {
  const checklist  = /\[현재 정보 기준 확인사항\]([\s\S]*?)(?=\[HS-code 관련\]|$)/i.exec(text)?.[1]?.trim() ?? ''
  const hscode     = /\[HS-code 관련\]([\s\S]*?)(?=\[인증\/검역\]|$)/i.exec(text)?.[1]?.trim() ?? ''
  const cert       = /\[인증\/검역\]([\s\S]*?)(?=\[위험물\/특수화물\]|$)/i.exec(text)?.[1]?.trim() ?? ''
  const dangerous  = /\[위험물\/특수화물\]([\s\S]*?)(?=\[필요 서류\]|$)/i.exec(text)?.[1]?.trim() ?? ''
  const docs       = /\[필요 서류\]([\s\S]*?)(?=\[현지 통관사에게 확인할 질문\]|$)/i.exec(text)?.[1]?.trim() ?? ''
  const questions  = /\[현지 통관사에게 확인할 질문\]([\s\S]*?)$/i.exec(text)?.[1]?.trim() ?? ''
  if (checklist || hscode || cert || docs || questions) {
    return { checklist, hscode, cert, dangerous, docs, questions }
  }
  return { checklist: text, hscode: '', cert: '', dangerous: '', docs: '', questions: '' }
}

export function CustomsPage({ onBack }: Props) {
  const { t, i18n } = useTranslation()
  const { user, profile } = useAuth()

  const [itemName,     setItemName]     = useState('')
  const [itemDesc,     setItemDesc]     = useState('')
  const [originCountry,setOriginCountry]= useState('')
  const [destCountry,  setDestCountry]  = useState('')
  const [isUsed,       setIsUsed]       = useState(false)
  const [hasBattery,   setHasBattery]   = useState(false)
  const [hasLiquid,    setHasLiquid]    = useState(false)
  const [hasChemical,  setHasChemical]  = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [result,       setResult]       = useState<string | null>(null)
  const [copyState,    setCopyState]    = useState<string | null>(null)

  const parsed = result ? parseCustomsResult(result) : null

  const handleAnalyze = async () => {
    if (!itemName.trim() || !destCountry.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-customs', {
        body: {
          itemName,
          itemDescription:   itemDesc.trim()        || undefined,
          originCountry:     originCountry.trim()   || undefined,
          destinationCountry: destCountry,
          isUsed:            isUsed     || undefined,
          hasBattery:        hasBattery || undefined,
          hasLiquid:         hasLiquid  || undefined,
          hasChemical:       hasChemical|| undefined,
          userLanguage:      profile?.preferred_language ?? i18n.language ?? 'ko',
          userId:            user?.id,
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

  const handleCopyAll = () => {
    if (result) void handleCopy(result, 'all')
  }

  type CheckboxItem = { label: string; value: boolean; onChange: (v: boolean) => void }
  const checkboxes: CheckboxItem[] = [
    { label: t('customsUsed'),     value: isUsed,      onChange: setIsUsed     },
    { label: t('customsBattery'),  value: hasBattery,  onChange: setHasBattery },
    { label: t('customsLiquid'),   value: hasLiquid,   onChange: setHasLiquid  },
    { label: t('customsChemical'), value: hasChemical, onChange: setHasChemical},
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
          {t('customsTitle')}
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">

          {/* Item name */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
              {t('customsItem')} <span className="text-red-400">*</span>
            </label>
            <input
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
              style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
              placeholder="e.g. Lithium battery / Auto parts"
            />
          </div>

          {/* Item description */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
              {t('customsDesc')}
            </label>
            <textarea
              value={itemDesc}
              onChange={e => setItemDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none border resize-none"
              style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
              rows={2}
            />
          </div>

          {/* Origin + Destination */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                {t('customsOrigin')}
              </label>
              <input
                value={originCountry}
                onChange={e => setOriginCountry(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                placeholder="Korea"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                {t('customsDest')} <span className="text-red-400">*</span>
              </label>
              <input
                value={destCountry}
                onChange={e => setDestCountry(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                placeholder="Russia / Uzbekistan"
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex flex-wrap gap-2">
            {checkboxes.map(({ label, value, onChange }) => (
              <button
                key={label}
                type="button"
                onClick={() => onChange(!value)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
                style={{
                  background:  value ? 'var(--brand)' : 'var(--card)',
                  color:       value ? 'white'        : 'var(--ink-3)',
                  borderColor: value ? 'var(--brand)' : 'var(--line)',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Analyze button */}
          <button
            onClick={handleAnalyze}
            disabled={!itemName.trim() || !destCountry.trim() || loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
            style={{ background: 'var(--brand)' }}
            onMouseEnter={e => { if (!(e.currentTarget as HTMLButtonElement).disabled) e.currentTarget.style.filter = 'brightness(1.1)' }}
            onMouseLeave={e => (e.currentTarget.style.filter = '')}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                {t('customsAnalyzing')}
              </span>
            ) : t('customsAnalyze')}
          </button>

          {error && (
            <p className="text-xs text-center text-red-500">{error}</p>
          )}

          {/* Results */}
          {parsed && (
            <div className="flex flex-col gap-3 mt-1">
              {parsed.checklist && (
                <ResultSection title="⚠️ 확인사항" copyKey="checklist" text={parsed.checklist} onCopy={handleCopy} copyState={copyState} t={t} />
              )}
              {parsed.hscode && (
                <ResultSection title="📦 HS-code 관련" copyKey="hscode" text={parsed.hscode} onCopy={handleCopy} copyState={copyState} t={t} />
              )}
              {parsed.cert && (
                <ResultSection title="🏷️ 인증/검역" copyKey="cert" text={parsed.cert} onCopy={handleCopy} copyState={copyState} t={t} />
              )}
              {parsed.dangerous && (
                <ResultSection title="🔴 위험물/특수화물" copyKey="dangerous" text={parsed.dangerous} onCopy={handleCopy} copyState={copyState} t={t} />
              )}
              {parsed.docs && (
                <ResultSection title="📄 필요 서류" copyKey="docs" text={parsed.docs} onCopy={handleCopy} copyState={copyState} t={t} />
              )}
              {parsed.questions && (
                <ResultSection title="❓ 통관사 확인 질문" copyKey="questions" text={parsed.questions} onCopy={handleCopy} copyState={copyState} t={t} />
              )}

              {/* Copy all */}
              <button
                onClick={handleCopyAll}
                className="w-full py-2 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5"
                style={{
                  background:  'var(--card)',
                  borderColor: 'var(--line)',
                  color:       copyState === 'all' ? '#22C55E' : 'var(--ink-3)',
                }}
              >
                {copyState === 'all' ? <Check size={12} /> : <Copy size={12} />}
                {copyState === 'all' ? t('copySuccess') : t('copy')}
              </button>
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
