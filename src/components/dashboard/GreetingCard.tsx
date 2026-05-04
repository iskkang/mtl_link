import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { getGreetingStyle } from '../../lib/weather'

function getGreetKey(named: boolean): string {
  const h = new Date().getHours()
  const base = h >= 5 && h < 12 ? 'Morning' : h >= 12 && h < 18 ? 'Afternoon' : 'Evening'
  return `greet${base}${named ? 'Name' : ''}`
}

export function GreetingCard() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()

  const dateStr = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'long', month: 'long', day: 'numeric',
  }).format(new Date())

  const greetText = profile?.name
    ? t(getGreetKey(true), { name: profile.name })
    : t(getGreetKey(false))

  const { gradient } = getGreetingStyle()

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col justify-between"
      style={{
        background: gradient,
        border:     '1px solid rgba(255,255,255,0.12)',
        boxShadow:  'var(--shadow-panel)',
        minHeight:  120,
        padding:    '12px 20px',
      }}
    >
      <p className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.60)' }}>
        {dateStr}
      </p>

      <div>
        <h2 className="text-[18px] font-bold leading-snug" style={{ color: 'rgba(255,255,255,0.95)' }}>
          {greetText}
        </h2>
        {(profile?.position || profile?.department) && (
          <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.60)' }}>
            {[profile.position, profile.department].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </div>
  )
}
