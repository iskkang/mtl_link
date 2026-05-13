import { useTranslation } from 'react-i18next'
import { ListChecks, Mail, Ship, Globe, Package, Search } from 'lucide-react'

interface Props {
  onChipClick: (prompt: string) => void
}

export function MintQuickActionChips({ onChipClick }: Props) {
  const { t } = useTranslation()

  const chips = [
    { Icon: ListChecks, labelKey: 'mintChipQuote',    promptKey: 'mintFeatureQuotePrompt' },
    { Icon: Mail,       labelKey: 'mintChipMail',     promptKey: 'mintFeatureMailPrompt' },
    { Icon: Ship,       labelKey: 'mintChipShipping', promptKey: 'mintFeatureShippingPrompt' },
    { Icon: Globe,      labelKey: 'mintChipCustoms',  promptKey: 'mintFeatureCustomsPrompt' },
    { Icon: Package,    labelKey: 'mintChipHscode',   promptKey: 'mintFeatureHscodePrompt' },
    { Icon: Search,     labelKey: 'mintChipTracking', promptKey: 'mintFeatureTrackingPrompt' },
  ] as const

  return (
    <div
      className="flex gap-1.5 overflow-x-auto px-4 py-2 flex-shrink-0 border-t"
      style={{ background: 'var(--side-bg)', borderColor: 'var(--side-line)' }}
    >
      {chips.map(({ Icon, labelKey, promptKey }) => (
        <button
          key={labelKey}
          onClick={() => onChipClick(t(promptKey))}
          className="flex items-center gap-1 px-2.5 py-1 text-[11px] border rounded-full whitespace-nowrap transition-colors flex-shrink-0"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--side-line)',
            color: 'var(--ink-2)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#0d9488'
            e.currentTarget.style.color = '#0d9488'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--side-line)'
            e.currentTarget.style.color = 'var(--ink-2)'
          }}
        >
          <Icon size={11} />
          {t(labelKey)}
        </button>
      ))}
    </div>
  )
}
