import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { DashboardCard } from './DashboardCard'

function getGreetKey(): 'greetMorning' | 'greetAfternoon' | 'greetEvening' {
  const h = new Date().getHours()
  if (h < 12) return 'greetMorning'
  if (h < 18) return 'greetAfternoon'
  return 'greetEvening'
}

export function GreetingCard() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()

  const dateStr = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'long', month: 'long', day: 'numeric',
  }).format(new Date())

  return (
    <DashboardCard>
      <div className="pt-2">
        <p className="text-xs mb-1" style={{ color: 'var(--ink-4)' }}>{dateStr}</p>
        <h2 className="text-xl font-bold leading-snug" style={{ color: 'var(--ink)' }}>
          {t(getGreetKey())}{profile?.name ? `, ${profile.name}` : ''}
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
