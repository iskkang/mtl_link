import { useTranslation } from 'react-i18next'
import { Newspaper } from 'lucide-react'
import { DashboardCard } from './DashboardCard'

export function NewsCard() {
  const { t } = useTranslation()
  return (
    <DashboardCard title={t('dashNews')} icon={Newspaper}>
      <div className="flex flex-col items-center justify-center py-6 gap-2">
        <Newspaper size={24} strokeWidth={1.5} style={{ color: 'var(--ink-4)' }} />
        <p className="text-xs" style={{ color: 'var(--ink-4)' }}>{t('placeholderTitle')}</p>
      </div>
    </DashboardCard>
  )
}
