import { useTranslation } from 'react-i18next'

interface Props {
  onSelect:     (prompt: string) => void
  onNavigate?:  (view: 'quotation' | 'message' | 'transport' | 'customs' | 'hscode' | 'tracking') => void
  showHeader?:  boolean
}

export function AiQuickActions({ onSelect, onNavigate, showHeader = true }: Props) {
  const { t } = useTranslation()

  const ACTIONS = [
    {
      labelKey:  'aiQuickQuotation',
      subKey:    'aiQuickQuotationSub',
      icon:      '📋',
      prompt:    t('aiPromptQuotation'),
      navigate:  'quotation' as const,
    },
    {
      labelKey:  'aiQuickMessage',
      subKey:    'aiQuickMessageSub',
      icon:      '✉️',
      prompt:    t('aiPromptMessage'),
      navigate:  'message' as const,
    },
    {
      labelKey:  'aiQuickTransport',
      subKey:    'aiQuickTransportSub',
      icon:      '🚢',
      prompt:    t('aiPromptTransport'),
      navigate:  'transport' as const,
    },
    {
      labelKey:  'aiQuickCustoms',
      subKey:    'aiQuickCustomsSub',
      icon:      '🌍',
      prompt:    t('aiPromptCustoms'),
      navigate:  'customs' as const,
    },
    // RAG 채팅으로 대체, 2026-05-15 숨김 — 코드·라우트·DB 유지
    // { labelKey: 'aiQuickHsCode', subKey: 'aiQuickHsCodeSub', icon: '📦', prompt: t('aiPromptHsCode'), navigate: 'hscode' as const },
    {
      labelKey:  'aiQuickTracking',
      subKey:    'aiQuickTrackingSub',
      icon:      '🔍',
      prompt:    t('aiPromptTracking'),
      navigate:  'tracking' as const,
    },
  ]

  const cardGrid = (
    <div className="grid grid-cols-2 gap-3 w-full" style={{ maxWidth: showHeader ? 384 : 600 }}>
      {ACTIONS.map(({ labelKey, subKey, icon, prompt, navigate }) => (
        <button
          key={labelKey}
          type="button"
          onPointerUp={(e) => {
            e.preventDefault()
            navigate ? onNavigate?.(navigate) : onSelect(prompt)
          }}
          className="flex flex-col items-start gap-1.5 p-3.5 rounded-2xl text-left
                     transition-all duration-100 border
                     bg-[var(--card)] border-[var(--line)]
                     hover:border-[var(--brand)] hover:bg-[var(--blue-soft)]
                     active:border-[var(--brand)] active:bg-[var(--blue-soft)]"
        >
          <span className="text-xl leading-none">{icon}</span>
          <span className="text-[13px] font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
            {t(labelKey)}
          </span>
          <span className="text-[11px] leading-snug" style={{ color: 'var(--ink-4)' }}>
            {t(subKey)}
          </span>
        </button>
      ))}
    </div>
  )

  if (!showHeader) return cardGrid

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 overflow-y-auto">
      {/* Welcome header */}
      <div className="mb-8 text-center">
        <div className="flex justify-center mb-3">
          <img src="/mint-logo-wordmark.svg" alt="MINT" className="h-16 w-auto object-contain" />
        </div>
        <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
          {t('aiWelcomeSubtitle')}
        </p>
      </div>

      {cardGrid}
    </div>
  )
}
