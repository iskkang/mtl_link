import { useTranslation } from 'react-i18next'
import {
  ListChecks, Mail, Ship, Globe, Package, Search,
} from 'lucide-react'

const MintLogo = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <polygon points="100,30 60,100 100,100"  fill="#5eead4"/>
    <polygon points="100,30 140,100 100,100" fill="#14b8a6"/>
    <polygon points="60,100 100,170 100,100" fill="#0d9488"/>
    <polygon points="140,100 100,170 100,100" fill="#134e4a"/>
    <line x1="100" y1="30" x2="100" y2="170" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
  </svg>
)

interface Props {
  userName: string
  onCardClick: (prompt: string) => void
}

export function MintEmptyState({ userName, onCardClick }: Props) {
  const { t } = useTranslation()

  const features = [
    { Icon: ListChecks, titleKey: 'mintFeatureQuoteTitle',    descKey: 'mintFeatureQuoteDesc',    promptKey: 'mintFeatureQuotePrompt' },
    { Icon: Mail,       titleKey: 'mintFeatureMailTitle',     descKey: 'mintFeatureMailDesc',     promptKey: 'mintFeatureMailPrompt' },
    { Icon: Ship,       titleKey: 'mintFeatureShippingTitle', descKey: 'mintFeatureShippingDesc', promptKey: 'mintFeatureShippingPrompt' },
    { Icon: Globe,      titleKey: 'mintFeatureCustomsTitle',  descKey: 'mintFeatureCustomsDesc',  promptKey: 'mintFeatureCustomsPrompt' },
    { Icon: Package,    titleKey: 'mintFeatureHscodeTitle',   descKey: 'mintFeatureHscodeDesc',   promptKey: 'mintFeatureHscodePrompt' },
    { Icon: Search,     titleKey: 'mintFeatureTrackingTitle', descKey: 'mintFeatureTrackingDesc', promptKey: 'mintFeatureTrackingPrompt' },
  ] as const

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ background: '#f0fdfa' }}
      >
        <MintLogo size={26} />
      </div>

      <h2 className="text-[15px] font-semibold text-center mb-1" style={{ color: 'var(--ink)' }}>
        {t('mintGreeting', { name: userName })}
      </h2>
      <p className="text-[13px] text-center mb-8" style={{ color: 'var(--ink-3)' }}>
        {t('mintSubtitle')}
      </p>

      <div className="grid grid-cols-3 gap-2 max-w-xl w-full">
        {features.map(({ Icon, titleKey, descKey, promptKey }) => (
          <button
            key={titleKey}
            onClick={() => onCardClick(t(promptKey))}
            className="text-left p-3 rounded-xl border transition-all hover:shadow-sm"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--side-line)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#0d9488'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--side-line)'
            }}
          >
            <div className="mb-1.5" style={{ color: '#0d9488' }}>
              <Icon size={18} />
            </div>
            <div className="text-[12px] font-semibold mb-0.5" style={{ color: 'var(--ink)' }}>
              {t(titleKey)}
            </div>
            <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
              {t(descKey)}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
