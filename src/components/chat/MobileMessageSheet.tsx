import { useEffect } from 'react'
import { Copy, CheckSquare, Clock, CheckCheck, Pencil, Trash2, MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { MessageActions, MessageActionContext } from './messageActions'
import { QuickEmojiPicker } from './QuickEmojiPicker'

interface Props extends MessageActions, MessageActionContext {
  open:    boolean
  onClose: () => void
}

export function MobileMessageSheet({
  open, onClose,
  isOwn, canEdit, needsResponse, responseReceived,
  onCopy, onCreateTask, onOpenThread,
  onMarkFollowup, onUnmarkRequest, onMarkReceived,
  onEdit, onDelete, onReact,
}: Props) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  function act(fn: () => void) {
    return () => { fn(); onClose() }
  }

  return (
    <>
      {/* 반투명 오버레이 */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
      />

      {/* 시트 본체 */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl animate-sheet-up"
        style={{ background: 'var(--card)', boxShadow: 'var(--shadow-lg)' }}
      >
        {/* 핸들 바 */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--line)' }} />
        </div>

        {/* 액션 목록 */}
        <div className="py-1" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>

          {/* 이모지 반응 빠른 선택 */}
          {onReact && (
            <>
              <div className="px-5 py-2">
                <QuickEmojiPicker onSelect={(emoji) => { onReact(emoji); onClose() }} />
              </div>
              <div className="mx-4 my-1 border-t" style={{ borderColor: 'var(--line)' }} />
            </>
          )}

          {/* 항상 표시 */}
          <SheetRow icon={Copy}        label={t('msgCopy')}       onClick={act(onCopy)} />
          <SheetRow icon={CheckSquare} label={t('msgCreateTask')} onClick={act(onCreateTask)} />
          {onOpenThread && (
            <SheetRow icon={MessageSquare} label={t('threadOpenThread')} onClick={act(onOpenThread)} />
          )}

          {/* 요청 관련 (내 메시지만) */}
          {isOwn && !needsResponse && onMarkFollowup && (
            <SheetRow icon={Clock}     label={t('msgMenuMarkRequest')}   onClick={act(onMarkFollowup)} />
          )}
          {isOwn && needsResponse && onUnmarkRequest && (
            <SheetRow icon={Clock}     label={t('msgMenuUnmarkRequest')} onClick={act(onUnmarkRequest)} muted />
          )}
          {isOwn && needsResponse && !responseReceived && onMarkReceived && (
            <SheetRow icon={CheckCheck} label={t('followupMarkReceived')} onClick={act(onMarkReceived)} green />
          )}

          {/* 수정·삭제 (내 메시지만) */}
          {isOwn && onEdit && onDelete && (
            <>
              <div className="mx-4 my-1 border-t" style={{ borderColor: 'var(--line)' }} />
              <SheetRow
                icon={Pencil}
                label={t('msgEdit')}
                onClick={canEdit ? act(onEdit) : undefined}
                disabled={!canEdit}
                title={!canEdit ? t('msgEditExpired') : undefined}
              />
              <SheetRow icon={Trash2} label={t('msgDelete')} onClick={act(onDelete)} danger />
            </>
          )}
        </div>
      </div>
    </>
  )
}

/* ── 개별 액션 행 ──────────────────────────────────────────── */
function SheetRow({
  icon: Icon, label, onClick, disabled, danger, muted, green, title,
}: {
  icon:      React.ElementType
  label:     string
  onClick?:  () => void
  disabled?: boolean
  danger?:   boolean
  muted?:    boolean
  green?:    boolean
  title?:    string
}) {
  const color = danger ? 'var(--red)'
    : green   ? '#22c55e'
    : muted   ? 'var(--ink-3)'
    : 'var(--ink)'

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      className="w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors
                 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ color }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <Icon size={18} className="flex-shrink-0" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}
