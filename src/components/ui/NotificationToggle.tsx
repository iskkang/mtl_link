import { Bell, BellOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  enabled: boolean
  onToggle: () => void
}

export function NotificationToggle({ enabled, onToggle }: Props) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={onToggle}
      title={enabled ? t('notifOn') : t('notifOff')}
      aria-label={enabled ? t('notifOn') : t('notifOff')}
      className={`p-2 rounded-full transition-colors
                  ${enabled
                    ? 'text-accent dark:text-accent hover:bg-gray-200 dark:hover:bg-surface-hover'
                    : 'text-gray-400 dark:text-[#556e78] hover:bg-gray-200 dark:hover:bg-surface-hover'
                  }`}
    >
      {enabled ? <Bell size={16} /> : <BellOff size={16} />}
    </button>
  )
}
