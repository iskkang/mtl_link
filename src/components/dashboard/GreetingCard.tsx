import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { DashboardCard } from './DashboardCard'

function getGreetKey(named: boolean): string {
  const h = new Date().getHours()
  const base = h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening'
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

  return (
    <DashboardCard>
      <div className="pt-2">
        <p className="text-xs mb-1" style={{ color: 'var(--ink-4)' }}>{dateStr}</p>
        <h2 className="text-xl font-bold leading-snug" style={{ color: 'var(--ink)' }}>
          {greetText}
        </h2>
        {(profile?.position || profile?.department) && (
          <p className="text-xs mt-1.5" style={{ color: 'var(--ink-4)' }}>
            {[profile.position, profile.department].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </DashboardCard>
  )
}
