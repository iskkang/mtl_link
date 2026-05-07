import { useState } from 'react'
import { ChevronLeft, Copy, Check, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { SUPPORTED_LANGS } from '../../lib/i18n'

interface Props {
  onBack: () => void
}

type RecipientType = 'customer' | 'partner' | 'internal'
type Tone = 'formal' | 'friendly' | 'firm' | 'whatsapp' | 'internal'

interface ParsedMessages {
  email:    string
  whatsapp: string
  internal: string
}

const LANG_TO_NAME: Record<string, string> = {
  ko: 'Korean', en: 'English', ru: 'Russian', uz: 'Uzbek', zh: 'Chinese', ja: 'Japanese',
}

const TONE_LABELS: Record<Tone, string> = {
  formal:   'Formal',
  friendly: 'Friendly',
  firm:     'Firm',
  whatsapp: 'WhatsApp',
  internal: 'Internal',
}

function parseMessages(text: string): ParsedMessages {
  const email    = /\[이메일 버전\]([\s\S]*?)(?=\[WhatsApp 버전\]|\[내부 보고|$)/i.exec(text)?.[1]?.trim() ?? ''
  const whatsapp = /\[WhatsApp 버전\]([\s\S]*?)(?=\[내부 보고|$)/i.exec(text)?.[1]?.trim() ?? ''
  const internal = /\[내부 보고 버전\]([\s\S]*?)$/i.exec(text)?.[1]?.trim() ?? ''
  return (email || whatsapp || internal) ? { email, whatsapp, internal } : { email: text, whatsapp: '', internal: '' }
}

export function MessageWriterPage({ onBack }: Props) {
  const { t, i18n } = useTranslation()
  const { user, profile } = useAuth()

  const [situation,     setSituation]     = useState('')
  const [recipientType, setRecipientType] = useState<RecipientType>('customer')
  const [language,      setLanguage]      = useState(profile?.preferred_language ?? i18n.language ?? 'ko')
  const [tone,          setTone]          = useState<Tone>('formal')
  const [keyPoints,     setKeyPoints]     = useState('')
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [result,        setResult]        = useState<string | null>(null)
  const [copyState,     setCopyState]     = useState<string | null>(null)

  const parsed = result ? parseMessages(result) : null

  const handleGenerate = async () => {
    if (!situation.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-message', {
        body: {
          situation,
          recipientType,
          language:     LANG_TO_NAME[language] ?? 'English',
          tone,
          keyPoints:    keyPoints.trim() || undefined,
          userLanguage: profile?.preferred_language ?? i18n.language ?? 'ko',
          userId:       user?.id,
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

  const recipients: { value: RecipientType; label: string }[] = [
    { value: 'customer', label: t('msgCustomer') },
    { value: 'partner',  label: t('msgPartner')  },
    { value: 'internal', label: t('msgInternal') },
  ]

  const tones: Tone[] = ['formal', 'friendly', 'firm', 'whatsapp', 'internal']

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
          {t('msgWriterTitle')}
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">

          {/* Situation */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
              {t('msgSituation')}
            </label>
            <textarea
              value={situation}
              onChange={e => setSituation(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none border resize-none"
              style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
              placeholder="예: FESCO 컨테이너 CRSU1234567 ETA가 5/10에서 5/14로 지연됨. 고객 ABC Co.에 통보 필요"
              rows={4}
            />
          </div>

          {/* Recipient */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-3)' }}>
              {t('msgRecipient')}
            </label>
            <div className="flex gap-2">
              {recipients.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRecipientType(r.value)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border"
                  style={{
                    background:  recipientType === r.value ? 'var(--brand)' : 'var(--card)',
                    color:       recipientType === r.value ? 'white' : 'var(--ink-3)',
                    borderColor: recipientType === r.value ? 'var(--brand)' : 'var(--line)',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-3)' }}>
              언어
            </label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
              style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
            >
              {SUPPORTED_LANGS.map(l => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tone */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-3)' }}>
              {t('msgTone')}
            </label>
            <div className="flex flex-wrap gap-2">
              {tones.map(tn => (
                <button
                  key={tn}
                  type="button"
                  onClick={() => setTone(tn)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
                  style={{
                    background:  tone === tn ? 'var(--brand)' : 'var(--card)',
                    color:       tone === tn ? 'white' : 'var(--ink-3)',
                    borderColor: tone === tn ? 'var(--brand)' : 'var(--line)',
                  }}
                >
                  {TONE_LABELS[tn]}
                </button>
              ))}
            </div>
          </div>

          {/* Key points */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>
              {t('msgKeyPoints')}
            </label>
            <textarea
              value={keyPoints}
              onChange={e => setKeyPoints(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none border resize-none"
              style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
              placeholder="예: 보상 없음, 다음 출항은 5/20"
              rows={2}
            />
          </div>

          {/* Generate */}
          <button
            onClick={handleGenerate}
            disabled={!situation.trim() || loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
            style={{ background: 'var(--brand)' }}
            onMouseEnter={e => { if (!(e.currentTarget as HTMLButtonElement).disabled) e.currentTarget.style.filter = 'brightness(1.1)' }}
            onMouseLeave={e => (e.currentTarget.style.filter = '')}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                {t('msgGenerating')}
              </span>
            ) : t('msgGenerate')}
          </button>

          {error && (
            <p className="text-xs text-center text-red-500">{error}</p>
          )}

          {/* Results */}
          {parsed && (
            <div className="flex flex-col gap-3 mt-1">
              {parsed.email && (
                <MsgSection title={t('msgEmailVersion')} copyKey="email" text={parsed.email} onCopy={handleCopy} copyState={copyState} t={t} />
              )}
              {parsed.whatsapp && (
                <MsgSection title={t('msgWhatsappVersion')} copyKey="whatsapp" text={parsed.whatsapp} onCopy={handleCopy} copyState={copyState} t={t} />
              )}
              {parsed.internal && (
                <MsgSection title={t('msgInternalVersion')} copyKey="internal" text={parsed.internal} onCopy={handleCopy} copyState={copyState} t={t} />
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

/* ── Message Section ─────────────────────────────── */
function MsgSection({
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
