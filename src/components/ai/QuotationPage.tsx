import { useState } from 'react'
import { ChevronLeft, Copy, Check, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

interface Props {
  onBack: () => void
}

interface ParsedResult {
  confirmed: string
  missing:   string
  message:   string
}

function parseResult(text: string): ParsedResult {
  const confirmed = /\[확인된 정보\]([\s\S]*?)(?=\[누락된|$)/i.exec(text)?.[1]?.trim() ?? ''
  const missing   = /\[누락된 정보[^\]]*\]([\s\S]*?)(?=\[고객에게|$)/i.exec(text)?.[1]?.trim() ?? ''
  const message   = /\[고객에게 보낼 메시지\]([\s\S]*?)$/i.exec(text)?.[1]?.trim() ?? ''
  return (confirmed || missing || message) ? { confirmed, missing, message } : { confirmed: '', missing: '', message: text }
}

export function QuotationPage({ onBack }: Props) {
  const { t, i18n } = useTranslation()
  const { user, profile } = useAuth()

  const [customerName, setCustomerName] = useState('')
  const [rawInquiry,   setRawInquiry]   = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [result,       setResult]       = useState<string | null>(null)
  const [saved,        setSaved]        = useState(false)
  const [copyState,    setCopyState]    = useState<string | null>(null)

  const parsed = result ? parseResult(result) : null

  const handleAnalyze = async () => {
    if (!rawInquiry.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setSaved(false)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-quotation', {
        body: {
          rawInquiry,
          customerName: customerName.trim() || undefined,
          userLanguage: profile?.preferred_language ?? i18n.language ?? 'ko',
          userId:       user?.id,
        },
      })
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)
      setResult(data?.result ?? '')
      if (user?.id) setSaved(true)
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
          {t('quotationTitle')}
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto">

          {/* Input form */}
          <div className="flex flex-col gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                고객명 (선택)
              </label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                placeholder="예: 김철수 / ABC Trading Co."
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
                {t('quotationInquiry')}
              </label>
              <textarea
                value={rawInquiry}
                onChange={e => setRawInquiry(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none border resize-none"
                style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                placeholder="예: 한국에서 우즈베키스탄으로 자동차 부품 500kg 보내려고 합니다. 빠른 견적 부탁드립니다."
                rows={5}
              />
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!rawInquiry.trim() || loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
            style={{ background: 'var(--brand)' }}
            onMouseEnter={e => { if (!(e.currentTarget as HTMLButtonElement).disabled) e.currentTarget.style.filter = 'brightness(1.1)' }}
            onMouseLeave={e => (e.currentTarget.style.filter = '')}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                {t('quotationAnalyzing')}
              </span>
            ) : t('quotationAnalyze')}
          </button>

          {error && (
            <p className="mt-3 text-xs text-center text-red-500">{error}</p>
          )}

          {/* Results */}
          {parsed && (
            <div className="mt-5 flex flex-col gap-3">
              {parsed.confirmed && (
                <ResultSection title="확인된 정보" copyKey="confirmed" text={parsed.confirmed} onCopy={handleCopy} copyState={copyState} t={t} />
              )}
              {parsed.missing && (
                <ResultSection title="누락된 정보 및 추가 질문" copyKey="missing" text={parsed.missing} onCopy={handleCopy} copyState={copyState} t={t} />
              )}
              {parsed.message && (
                <ResultSection title="고객에게 보낼 메시지" copyKey="message" text={parsed.message} onCopy={handleCopy} copyState={copyState} t={t} highlight />
              )}
              {saved && (
                <p className="text-xs text-center" style={{ color: 'var(--ink-4)' }}>
                  ✓ {t('quotationSave')}
                </p>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

/* ── Result Section ─────────────────────────────── */
function ResultSection({
  title, copyKey, text, onCopy, copyState, t, highlight = false,
}: {
  title:      string
  copyKey:    string
  text:       string
  onCopy:     (text: string, key: string) => void
  copyState:  string | null
  t:          (key: string) => string
  highlight?: boolean
}) {
  const copied = copyState === copyKey
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: highlight ? 'var(--brand)' : 'var(--line)', background: 'var(--card)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{
          borderColor: highlight ? 'var(--brand)' : 'var(--line)',
          background:  highlight ? 'var(--blue-soft)' : 'transparent',
        }}
      >
        <span className="text-xs font-semibold" style={{ color: highlight ? 'var(--brand)' : 'var(--ink-2)' }}>
          {title}
        </span>
        <button
          onClick={() => onCopy(text, copyKey)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium"
          style={{ color: copied ? '#22C55E' : 'var(--ink-3)', background: 'var(--side-row)' }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? t('copySuccess') : 'Copy'}
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
