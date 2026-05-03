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
    <div
      className="flex items-center gap-2 px-3 py-2 border-t"
      style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
    >
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="w-0.5 h-8 rounded-full flex-shrink-0" style={{ background: 'var(--brand)' }} />
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: 'var(--brand)' }}>
            {t('replyingTo', { name: replyTo.sender?.name ?? '…' })}
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--ink-3)' }}>
            {replyTo.deleted_at ? t('msgDeletedRef') : (replyTo.content ?? '')}
          </p>
        </div>
      </div>
      <button
        onClick={onCancel}
        className="flex-shrink-0 p-1 rounded-full transition-colors"
        style={{ color: 'var(--ink-3)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        aria-label="취소"
      >
        <X size={16} />
      </button>
    </div>
  )
}
