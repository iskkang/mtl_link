import { useTranslation } from 'react-i18next'
import { TrendingUp } from 'lucide-react'
import { DashboardCard } from './DashboardCard'

export function ShippingIndexCard() {
  const { t } = useTranslation()
  return (
    <DashboardCard title={t('dashShipping')} icon={TrendingUp}>
      <div className="flex flex-col items-center justify-center py-6 gap-2">
        <TrendingUp size={24} strokeWidth={1.5} style={{ color: 'var(--ink-4)' }} />
        <p className="text-xs" style={{ color: 'var(--ink-4)' }}>{t('placeholderTitle')}</p>
      </div>
    </DashboardCard>
  )
}
