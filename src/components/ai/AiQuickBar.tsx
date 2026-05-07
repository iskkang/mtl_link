import { useTranslation } from 'react-i18next'

interface Props {
  onSelect:    (prompt: string) => void
  onNavigate?: (view: 'quotation' | 'message') => void
}

interface Action {
  labelKey:  string
  icon:      string
  promptKey: string
  navigate?: 'quotation' | 'message'
}

const ACTIONS: Action[] = [
  { labelKey: 'aiQuickQuotation', icon: '📋', promptKey: 'aiPromptQuotation', navigate: 'quotation' },
  { labelKey: 'aiQuickMessage',   icon: '✉️', promptKey: 'aiPromptMessage',   navigate: 'message'   },
  { labelKey: 'aiQuickTransport', icon: '🚢', promptKey: 'aiPromptTransport' },
  { labelKey: 'aiQuickCustoms',   icon: '🌍', promptKey: 'aiPromptCustoms'   },
  { labelKey: 'aiQuickHsCode',    icon: '📦', promptKey: 'aiPromptHsCode'    },
  { labelKey: 'aiQuickTracking',  icon: '🔍', promptKey: 'aiPromptTracking'  },
]

export function AiQuickBar({ onSelect, onNavigate }: Props) {
  const { t } = useTranslation()

  return (
    <div
      className="flex gap-2 px-3 py-2 overflow-x-auto flex-shrink-0 border-t"
      style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
    >
      {ACTIONS.map(({ labelKey, icon, promptKey, navigate }) => (
        <button
          key={labelKey}
          type="button"
          onClick={() => navigate ? onNavigate?.(navigate) : onSelect(t(promptKey))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                     whitespace-nowrap flex-shrink-0 border transition-all duration-100"
          style={{
            background:  'var(--chat-bg)',
            borderColor: 'var(--line)',
            color:       'var(--ink-2)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--brand)'
            e.currentTarget.style.color       = 'var(--brand)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--line)'
            e.currentTarget.style.color       = 'var(--ink-2)'
          }}
        >
          <span className="text-sm leading-none">{icon}</span>
          {t(labelKey)}
        </button>
      ))}
    </div>
  )
}
