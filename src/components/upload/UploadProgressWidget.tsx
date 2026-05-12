import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { useUploadStore, type UploadPhase } from '../../stores/uploadStore'

function phaseLabel(phase: UploadPhase | null, t: (k: string) => string): string {
  switch (phase) {
    case 'parsing':   return t('phaseParsing')
    case 'embedding': return t('phaseEmbedding')
    case 'done':      return t('phaseDone')
    case 'cancelled': return t('phaseCancelled')
    case 'failed':    return t('phaseFailed')
    default:          return ''
  }
}

export function UploadProgressWidget() {
  const { t } = useTranslation()
  const { active, phase, fileName, current, total, message, cancel, reset } = useUploadStore()
  const [expanded, setExpanded] = useState(false)

  // Warn before closing tab during active upload
  useEffect(() => {
    if (!active) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [active])

  // Auto-dismiss after terminal states
  useEffect(() => {
    if (phase === 'done' || phase === 'cancelled' || phase === 'failed') {
      const ms = phase === 'failed' ? 4000 : 3000
      const timer = setTimeout(() => { reset(); setExpanded(false) }, ms)
      return () => clearTimeout(timer)
    }
  }, [phase, reset])

  if (!active && phase == null) return null

  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  const terminalColor =
    phase === 'done'      ? '#22C55E' :
    phase === 'cancelled' ? '#9CA3AF' :
    phase === 'failed'    ? '#EF4444' : null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-[300px] rounded-xl border overflow-hidden shadow-lg"
      style={{
        background:   'var(--card)',
        borderColor:  terminalColor ?? 'var(--line)',
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <FileText size={15} style={{ color: 'var(--brand)', flexShrink: 0 }} />
        <span className="flex-1 text-[12px] font-medium truncate" style={{ color: 'var(--ink-1)' }}>
          {fileName}
        </span>
        <span
          className="text-[11px] flex-shrink-0"
          style={{ color: terminalColor ?? 'var(--ink-3)' }}
        >
          {phaseLabel(phase, t)}
        </span>
        {active && (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="flex-shrink-0 p-0.5 rounded"
            style={{ color: 'var(--ink-4)' }}
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        )}
        {!active && (
          <button
            type="button"
            onClick={() => { reset(); setExpanded(false) }}
            className="flex-shrink-0 p-0.5 rounded"
            style={{ color: 'var(--ink-4)' }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {active && (
        <div className="px-3 pb-2">
          <div
            className="w-full h-1 rounded-full overflow-hidden"
            style={{ background: 'var(--line)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, background: 'var(--brand)' }}
            />
          </div>
        </div>
      )}

      {/* Expanded panel */}
      {expanded && active && (
        <div
          className="border-t px-3 py-2 flex flex-col gap-2"
          style={{ borderColor: 'var(--line)' }}
        >
          <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>{message}</p>
          <p className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
            {current} / {total} ({pct}%)
          </p>
          <button
            type="button"
            onClick={cancel}
            className="w-full py-1.5 rounded-lg text-[12px] font-medium transition-colors"
            style={{ color: '#EF4444', border: '1px solid #FCA5A5' }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#FEF2F2')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
          >
            {t('cancel')}
          </button>
        </div>
      )}
    </div>
  )
}
