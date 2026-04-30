import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { MessageWithSender } from '../../types/chat'

interface Props {
  replyTo: MessageWithSender
  onCancel: () => void
}

export function ReplyPreview({ replyTo, onCancel }: Props) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2 px-3 py-2
                    bg-white dark:bg-surface-panel
                    border-t border-gray-200 dark:border-[#374045]">
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="w-0.5 h-8 rounded-full bg-mtl-cyan flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-mtl-cyan truncate">
            {t('replyingTo', { name: replyTo.sender?.name ?? '…' })}
          </p>
          <p className="text-xs text-gray-500 dark:text-[#8696a0] truncate">
            {replyTo.deleted_at ? t('msgDeletedRef') : (replyTo.content ?? '')}
          </p>
        </div>
      </div>
      <button
        onClick={onCancel}
        className="flex-shrink-0 p-1 rounded-full
                   hover:bg-gray-100 dark:hover:bg-surface-hover
                   text-gray-400 dark:text-[#8696a0] transition-colors"
        aria-label="취소"
      >
        <X size={16} />
      </button>
    </div>
  )
}
