import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, Pencil, Trash2, CheckSquare, Clock, CheckCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  canEdit:           boolean
  canDelete:         boolean
  onEdit:            () => void
  onDelete:          () => void
  onCreateTask:      () => void
  needsResponse?:    boolean
  responseReceived?: boolean
  onMarkFollowup?:   () => void
  onUnmarkRequest?:  () => void
  onMarkReceived?:   () => void
}

export function MessageMenu({ canEdit, canDelete, onEdit, onDelete, onCreateTask, needsResponse, responseReceived, onMarkFollowup, onUnmarkRequest, onMarkReceived }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-center w-6 h-6 rounded-full border shadow-sm transition-colors"
        style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink-4)' }}
        aria-label="메시지 메뉴"
      >
        <MoreHorizontal size={13} />
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-1 right-0 z-50 min-w-[130px] rounded-xl py-1 border text-sm"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--line)',
            boxShadow: 'var(--shadow-lg)',
            color: 'var(--ink)',
          }}
        >
          {/* Create task — always visible */}
          <button
            onClick={() => { setOpen(false); onCreateTask() }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
            style={{ color: 'var(--ink)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
          >
            <CheckSquare size={13} className="flex-shrink-0" />
            {t('msgCreateTask')}
          </button>

          {/* Request options — own messages only */}
          {canDelete && (onMarkFollowup || onUnmarkRequest || onMarkReceived) && (
            <>
              <div className="my-0.5 mx-2 border-t" style={{ borderColor: 'var(--line)' }} />

              {!needsResponse && onMarkFollowup && (
                <button
                  onClick={() => { setOpen(false); onMarkFollowup() }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                  style={{ color: 'var(--ink)' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
                >
                  <Clock size={13} className="flex-shrink-0" />
                  {t('msgMenuMarkRequest')}
                </button>
              )}

              {needsResponse && onUnmarkRequest && (
                <button
                  onClick={() => { setOpen(false); onUnmarkRequest() }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                  style={{ color: 'var(--ink-3)' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
                >
                  <Clock size={13} className="flex-shrink-0 opacity-50" />
                  {t('msgMenuUnmarkRequest')}
                </button>
              )}

              {needsResponse && !responseReceived && onMarkReceived && (
                <button
                  onClick={() => { setOpen(false); onMarkReceived() }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                  style={{ color: '#22c55e' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
                >
                  <CheckCheck size={13} className="flex-shrink-0" />
                  {t('followupMarkReceived')}
                </button>
              )}
            </>
          )}

          {/* Edit / Delete only for own messages */}
          {canDelete && (
            <>
              <div className="my-0.5 mx-2 border-t" style={{ borderColor: 'var(--line)' }} />

              <button
                onClick={() => { if (canEdit) { setOpen(false); onEdit() } }}
                disabled={!canEdit}
                title={canEdit ? undefined : t('msgEditExpired')}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors
                  ${canEdit ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                style={{ color: 'var(--ink)' }}
                onMouseEnter={e => { if (canEdit) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                <Pencil size={13} className="flex-shrink-0" />
                {t('msgEdit')}
              </button>

              <button
                onClick={() => { setOpen(false); onDelete() }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors text-red-500 dark:text-red-400"
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.06)')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
              >
                <Trash2 size={13} className="flex-shrink-0" />
                {t('msgDelete')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
