import { useTranslation } from 'react-i18next'

interface Props {
  onSelect:    (prompt: string) => void
  onNavigate?: (view: 'quotation' | 'message') => void
}

export function AiQuickActions({ onSelect, onNavigate }: Props) {
  const { t } = useTranslation()

  const ACTIONS = [
    {
      labelKey:  'aiQuickQuotation',
      sub:       '누락 정보 자동분석',
      icon:      '📋',
      prompt:    t('aiPromptQuotation'),
      navigate:  'quotation' as const,
    },
    {
      labelKey:  'aiQuickMessage',
      sub:       '다국어/톤별 생성',
      icon:      '✉️',
      prompt:    t('aiPromptMessage'),
      navigate:  'message' as const,
    },
    {
      labelKey: 'aiQuickTransport',
      sub:      '항공/해상/철도',
      icon:     '🚢',
      prompt:   t('aiPromptTransport'),
    },
    {
      labelKey: 'aiQuickCustoms',
      sub:      '국가별 확인사항',
      icon:     '🌍',
      prompt:   t('aiPromptCustoms'),
    },
    {
      labelKey: 'aiQuickHsCode',
      sub:      '품목별 후보 저장',
      icon:     '📦',
      prompt:   t('aiPromptHsCode'),
    },
    {
      labelKey: 'aiQuickTracking',
      sub:      '번호 검증+링크',
      icon:     '🔍',
      prompt:   t('aiPromptTracking'),
    },
  ]

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 overflow-y-auto">
      {/* Welcome header */}
      <div className="mb-8 text-center">
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 shadow-sm"
          style={{ background: 'var(--blue-soft)', color: 'var(--brand)' }}
        >
          <span className="text-2xl">🤖</span>
        </div>
        <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--ink)' }}>
          {t('aiWelcomeTitle')}
        </h2>
        <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
          {t('aiWelcomeSubtitle')}
        </p>
      </div>

      {/* Action grid */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {ACTIONS.map(({ labelKey, sub, icon, prompt, navigate }) => (
          <button
            key={labelKey}
            type="button"
            onClick={() => navigate ? onNavigate?.(navigate) : onSelect(prompt)}
            className="flex flex-col items-start gap-1.5 p-3.5 rounded-2xl text-left
                       transition-all duration-100 border"
            style={{
              background:  'var(--card)',
              borderColor: 'var(--line)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--brand)'
              e.currentTarget.style.background  = 'var(--blue-soft)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--line)'
              e.currentTarget.style.background  = 'var(--card)'
            }}
          >
            <span className="text-xl leading-none">{icon}</span>
            <span className="text-[13px] font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
              {t(labelKey)}
            </span>
            <span className="text-[11px] leading-snug" style={{ color: 'var(--ink-4)' }}>
              {sub}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
