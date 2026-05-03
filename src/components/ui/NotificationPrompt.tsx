import { createPortal } from 'react-dom'
import { Bell, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  onAllow:  () => void
  onLater:  () => void
}

export function NotificationPrompt({ onAllow, onLater }: Props) {
  const { t } = useTranslation()

  return createPortal(
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] w-72
                    bg-white dark:bg-surface-panel
                    border border-gray-200 dark:border-[#374045]
                    rounded-2xl shadow-2xl p-4 animate-card-in">
      <button
        onClick={onLater}
        className="absolute top-3 right-3 p-1 rounded-full
                   text-gray-400 hover:text-gray-600 dark:hover:text-[#e9edef]
                   hover:bg-gray-100 dark:hover:bg-surface-hover transition-colors"
        aria-label={t('notifLater')}
      >
        <X size={14} />
      </button>

      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-brand-500/10 flex items-center justify-center flex-shrink-0">
          <Bell size={18} className="text-brand-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-[#e9edef] mb-0.5">
            {t('notifPromptTitle')}
          </p>
          <p className="text-xs text-gray-500 dark:text-[#8696a0] leading-relaxed">
            {t('notifPromptDesc')}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={onLater}
          className="flex-1 py-2 rounded-xl text-xs font-semibold
                     border border-gray-200 dark:border-[#374045]
                     text-gray-500 dark:text-[#8696a0]
                     hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors"
        >
          {t('notifLater')}
        </button>
        <button
          onClick={onAllow}
          className="flex-1 py-2 rounded-xl text-xs font-semibold
                     bg-brand-500 hover:bg-brand-600 text-white transition-colors"
        >
          {t('notifAllow')}
        </button>
      </div>
    </div>,
    document.body,
  )
}
