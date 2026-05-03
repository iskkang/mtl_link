import { useTranslation } from 'react-i18next'
import type { ReplyRef } from '../../types/chat'

interface Props {
  reply:   ReplyRef
  onClick: () => void
}

export function QuotedMessage({ reply, onClick }: Props) {
  const { t } = useTranslation()

  const getQuoteText = (): string => {
    if (reply.deleted_at) return t('msgDeletedRef')
    const text = reply.content ?? ''
    const cleaned = text.replace(/\n/g, ' ').replace(/-{3,}/g, '').trim()
    if (!cleaned) {
      if (reply.message_type === 'image') return '[사진]'
      if (reply.message_type === 'file')  return '[파일]'
      if (reply.message_type === 'voice_translated') return '[음성 메시지]'
    }
    return cleaned.length > 50 ? cleaned.slice(0, 50) + '...' : cleaned
  }

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      className="pl-2 py-1 mb-2 rounded-sm cursor-pointer
                 hover:bg-black/5 dark:hover:bg-white/5 transition-colors min-w-0 border-l-4"
      style={{ borderColor: 'var(--brand)' }}
    >
      <div className="text-[11px] font-semibold truncate" style={{ color: 'var(--brand)' }}>
        {reply.sender?.name ?? '알 수 없음'}
      </div>
      <div
        className={`text-xs truncate leading-snug ${reply.deleted_at ? 'italic' : ''}`}
        style={{ color: 'var(--ink-3)' }}
      >
        {getQuoteText()}
      </div>
    </div>
  )
}
