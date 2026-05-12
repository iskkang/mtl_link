import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRoomStore } from '../stores/roomStore'

export function ThreadsPage() {
  const { t }    = useTranslation()
  const navigate = useNavigate()

  const threadUnread = useRoomStore(s => s.threadUnread)
  const totalThreads = Object.keys(threadUnread).length

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--chat-bg)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg"
          style={{ color: 'var(--ink-3)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-[14px] font-bold" style={{ color: 'var(--ink-1)' }}>
          {t('navThreads')}
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center gap-3 p-4">
        <MessageSquare size={40} style={{ color: 'var(--ink-4)' }} />
        <p className="text-sm text-center" style={{ color: 'var(--ink-3)' }}>
          {totalThreads > 0
            ? `${totalThreads}개의 스레드에 새 답글이 있습니다`
            : t('noUnread')
          }
        </p>
        <p className="text-xs text-center" style={{ color: 'var(--ink-4)' }}>
          스레드 전체 보기는 곧 제공될 예정입니다.
        </p>
      </div>
    </div>
  )
}
