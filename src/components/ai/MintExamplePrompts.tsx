import { useTranslation } from 'react-i18next'

interface Props {
  onSelect: (text: string) => void
}

const EXAMPLES = [
  { labelKey: 'aiExampleBooking', prompt: '부킹할 때 체크리스트 알려줘' },
  { labelKey: 'aiExampleCustoms', prompt: '통관 서류는 뭐가 필요해?' },
  { labelKey: 'aiExampleHsCode',  prompt: 'ball bearing 한국이랑 중국 HS코드 비교?' },
  { labelKey: 'aiExampleFesco',   prompt: 'FESCO 노선 안내해줘' },
]

export function MintExamplePrompts({ onSelect }: Props) {
  const { t } = useTranslation()

  return (
    <div style={{ width: '100%', maxWidth: 600 }}>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10, paddingLeft: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>✨</span>
        <span>{t('aiExampleHeader', '이런 질문은 어떠세요?')}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {EXAMPLES.map((ex, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect(ex.prompt)}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: '12px 14px',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--ink)',
              lineHeight: 1.5,
              transition: 'border-color .15s, background .15s, transform .12s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#14b8a6'
              e.currentTarget.style.background = 'var(--blue-soft)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--line)'
              e.currentTarget.style.background = 'var(--card)'
            }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)' }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            {t(ex.labelKey, ex.prompt)}
          </button>
        ))}
      </div>
    </div>
  )
}
