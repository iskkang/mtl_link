import { useTranslation } from 'react-i18next'
import type { ReplyRef } from '../../types/chat'

interface Props {
  reply:   ReplyRef
  onClick: () => void
}

export function QuotedMessage({ reply, onClick }: Props) {
  const { t } = useTranslation()
  const isDeleted = !!reply.deleted_at

  return (
    <div
      onClick={onClick}
      className="flex items-stretch gap-0 mb-1.5 rounded-lg overflow-hidden cursor-pointer
                 bg-black/5 dark:bg-black/20 hover:opacity-75 transition-opacity"
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      <div className="w-0.5 bg-mtl-cyan flex-shrink-0" />
      <div className="flex-1 px-2 py-1.5 min-w-0">
        <p className="text-[11px] font-semibold text-mtl-cyan truncate">
          {reply.sender?.name ?? '…'}
        </p>
        <p className={`text-xs truncate leading-relaxed ${
          isDeleted
            ? 'italic text-gray-400 dark:text-[#8696a0]'
            : 'text-gray-600 dark:text-[#b0bec5]'
        }`}>
          {isDeleted ? t('msgDeletedRef') : (reply.content ?? '')}
        </p>
      </div>
    </div>
  )
}
