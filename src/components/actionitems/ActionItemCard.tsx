import { useState } from 'react'
import { CheckCircle2, Clock, X, BellOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../ui/Avatar'
import {
  completeActionItem,
  cancelActionItem,
  snoozeActionItem,
  type ActionItem,
} from '../../services/actionItemService'
import { useAuth } from '../../hooks/useAuth'

interface Props {
  item:     ActionItem
  onReload: () => void
  view:     'received' | 'created' | 'done'
}

function formatDue(iso: string, t: (k: string, opts?: Record<string, unknown>) => string): { label: string; overdue: boolean } {
  const due = new Date(iso)
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()
  const overdue = diffMs < 0

  if (overdue) {
    const days = Math.floor(-diffMs / 86400000)
    if (days === 0) return { label: t('taskDueToday'), overdue: true }
    return { label: t('taskOverdueDays', { count: days }), overdue: true }
  }

  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return { label: t('taskDueMins', { count: mins }), overdue: false }
  const hours = Math.floor(diffMs / 3600000)
  if (hours < 24) return { label: t('taskDueHours', { count: hours }), overdue: false }
  const days = Math.floor(diffMs / 86400000)
  if (days === 0) return { label: t('taskDueToday'), overdue: false }
  if (days === 1) return { label: t('taskDueTomorrow'), overdue: false }
  return { label: t('taskDueDays', { count: days }), overdue: false }
}

const SNOOZE_OPTIONS = [
  { label: '1h',  ms: 60 * 60 * 1000 },
  { label: '3h',  ms: 3 * 60 * 60 * 1000 },
  { label: '1d',  ms: 24 * 60 * 60 * 1000 },
  { label: '3d',  ms: 3 * 24 * 60 * 60 * 1000 },
]

export function ActionItemCard({ item, onReload, view }: Props) {
  const { t }      = useTranslation()
  const { user }   = useAuth()
  const [busy, setBusy] = useState(false)
  const [snoozeOpen, setSnoozeOpen] = useState(false)

  const isAssignee = user?.id === item.assigned_to
  const isCreator  = user?.id === item.created_by

  const dueInfo = item.due_date ? formatDue(item.due_date, t) : null

  const handle = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn(); onReload() } catch (e) { console.error(e) } finally { setBusy(false) }
  }

  return (
    <div
      className="relative rounded-xl p-3.5 border transition-colors"
      style={{ background: 'var(--bg)', borderColor: 'var(--line)' }}
    >
      {/* title row */}
      <div className="flex items-start gap-2.5">
        {view !== 'done' && isAssignee && (
          <button
            disabled={busy}
            onClick={() => handle(() => completeActionItem(item.id))}
            className="flex-shrink-0 mt-0.5 transition-colors"
            title={t('taskComplete')}
            style={{ color: 'var(--ink-4)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#22c55e')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-4)')}
          >
            <CheckCircle2 size={18} />
          </button>
        )}
        {view === 'done' && (
          <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" style={{ color: '#22c55e' }} />
        )}

        <p
          className="flex-1 text-sm leading-snug"
          style={{
            color: 'var(--ink)',
            textDecoration: view === 'done' ? 'line-through' : 'none',
            opacity: view === 'done' ? 0.6 : 1,
          }}
        >
          {item.title}
        </p>

        {/* cancel button (only creator, only pending) */}
        {view !== 'done' && isCreator && (
          <button
            disabled={busy}
            onClick={() => handle(() => cancelActionItem(item.id))}
            className="flex-shrink-0 p-1 rounded transition-colors"
            title={t('taskCancel')}
            style={{ color: 'var(--ink-4)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-4)')}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* meta row */}
      <div className="flex items-center gap-3 mt-2.5 flex-wrap">
        {/* due date badge */}
        {dueInfo && (
          <span
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{
              background: dueInfo.overdue ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
              color: dueInfo.overdue ? 'var(--red)' : 'var(--blue)',
            }}
          >
            <Clock size={10} />
            {dueInfo.label}
          </span>
        )}

        {/* assignee / creator avatar */}
        {view === 'created' && item.assignee && (
          <div className="flex items-center gap-1">
            <Avatar name={item.assignee.name} avatarUrl={item.assignee.avatar_url} size="xs" />
            <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>{item.assignee.name}</span>
          </div>
        )}
        {view === 'received' && item.creator && (
          <div className="flex items-center gap-1">
            <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
              {t('taskFrom')}
            </span>
            <Avatar name={item.creator.name} avatarUrl={item.creator.avatar_url} size="xs" />
            <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>{item.creator.name}</span>
          </div>
        )}

        {/* snooze */}
        {view !== 'done' && isAssignee && item.due_date && (
          <div className="relative ml-auto">
            <button
              disabled={busy}
              onClick={() => setSnoozeOpen(v => !v)}
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full transition-colors"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink-4)' }}
            >
              <BellOff size={10} />
              {t('taskSnooze')}
            </button>
            {snoozeOpen && (
              <div
                className="absolute bottom-full mb-1 right-0 z-10 rounded-xl py-1 border shadow-lg"
                style={{ background: 'var(--card)', borderColor: 'var(--line)', minWidth: 100 }}
              >
                {SNOOZE_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    className="w-full px-3 py-1.5 text-xs text-left transition-colors"
                    style={{ color: 'var(--ink)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => {
                      setSnoozeOpen(false)
                      handle(() => snoozeActionItem(item.id, new Date(Date.now() + opt.ms).toISOString()))
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
