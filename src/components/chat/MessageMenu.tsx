import { useEffect, useMemo, useRef } from 'react'
import { CornerDownLeft, Copy, CheckSquare, Clock, CheckCheck, Pencil, Trash2, MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { MessageActions, MessageActionContext } from './messageActions'

const ESTIMATED_HEIGHT = 320  // 최대 메뉴 항목 수 기준 여유 높이(px)

interface Props extends MessageActions, MessageActionContext {
  open:        boolean
  onClose:     () => void
  /** Ref of the trigger button — excluded from click-outside + used for placement measurement */
  excludeRef?: React.RefObject<Element>
}

export function MessageMenu({
  open, onClose, excludeRef,
  isOwn, canEdit, needsResponse, responseReceived,
  onReply, onCopy, onCreateTask, onOpenThread,
  onMarkFollowup, onUnmarkRequest, onMarkReceived,
  onEdit, onDelete,
}: Props) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onMouse = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      if (excludeRef?.current?.contains(e.target as Node)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, excludeRef])

  // 열릴 때 한 번 측정 → fixed 좌표 결정 (스크롤/리사이즈 재계산 불필요)
  const posStyle = useMemo<React.CSSProperties>(() => {
    if (!open || !excludeRef?.current) return {}
    const rect = excludeRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const rightFromEdge = window.innerWidth - rect.right
    return spaceBelow < ESTIMATED_HEIGHT
      ? { position: 'fixed', bottom: window.innerHeight - rect.top + 4, right: rightFromEdge }
      : { position: 'fixed', top: rect.bottom + 4, right: rightFromEdge }
  }, [open, excludeRef])

  if (!open) return null

  function act(fn: () => void) { return () => { fn(); onClose() } }

  return (
    <div
      ref={ref}
      className="z-50 min-w-[148px] rounded-xl py-1 border text-sm"
      style={{
        ...posStyle,
        background: 'var(--card)',
        borderColor: 'var(--line)',
        boxShadow: 'var(--shadow-lg)',
        color: 'var(--ink)',
      }}
    >
      {/* 항상 표시 */}
      <MenuItem icon={CornerDownLeft} label={t('msgReply')}      onClick={act(onReply)} />
      <MenuItem icon={Copy}           label={t('msgCopy')}       onClick={act(onCopy)} />
      <MenuItem icon={CheckSquare}    label={t('msgCreateTask')} onClick={act(onCreateTask)} />
      {onOpenThread && (
        <MenuItem icon={MessageSquare} label={t('threadOpenThread')} onClick={act(onOpenThread)} />
      )}

      {/* 요청 관련 (내 메시지만) */}
      {isOwn && (onMarkFollowup || onUnmarkRequest || onMarkReceived) && (
        <>
          <Divider />
          {!needsResponse && onMarkFollowup && (
            <MenuItem icon={Clock} label={t('msgMenuMarkRequest')} onClick={act(onMarkFollowup)} />
          )}
          {needsResponse && onUnmarkRequest && (
            <MenuItem icon={Clock} label={t('msgMenuUnmarkRequest')} onClick={act(onUnmarkRequest)} muted />
          )}
          {needsResponse && !responseReceived && onMarkReceived && (
            <MenuItem icon={CheckCheck} label={t('followupMarkReceived')} onClick={act(onMarkReceived)} green />
          )}
        </>
      )}

      {/* 수정·삭제 (내 메시지만) */}
      {isOwn && onEdit && onDelete && (
        <>
          <Divider />
          <MenuItem
            icon={Pencil}
            label={t('msgEdit')}
            onClick={canEdit ? act(onEdit) : undefined}
            disabled={!canEdit}
            title={!canEdit ? t('msgEditExpired') : undefined}
          />
          <MenuItem icon={Trash2} label={t('msgDelete')} onClick={act(onDelete)} danger />
        </>
      )}
    </div>
  )
}

/* ── 내부 헬퍼 ───────────────────────────────────────────────── */
function Divider() {
  return <div className="my-0.5 mx-2 border-t" style={{ borderColor: 'var(--line)' }} />
}

function MenuItem({
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
    : green  ? '#22c55e'
    : muted  ? 'var(--ink-3)'
    : 'var(--ink)'

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors
                 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ color }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'var(--bg)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <Icon size={13} className="flex-shrink-0" />
      <span>{label}</span>
    </button>
  )
}
