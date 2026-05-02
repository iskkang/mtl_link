import { useState } from 'react'
import { X, CheckSquare, Calendar, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../ui/Avatar'
import { createActionItem } from '../../services/actionItemService'
import type { RoomListItem } from '../../types/chat'

interface Props {
  open:        boolean
  onClose:     () => void
  messageId:   string | null
  roomId:      string
  initialTitle: string
  members:     RoomListItem['members']
  currentUserId: string
}

export function CreateActionItemModal({
  open, onClose, messageId, roomId, initialTitle, members, currentUserId,
}: Props) {
  const { t } = useTranslation()
  const [title,      setTitle]      = useState(initialTitle)
  const [assigneeId, setAssigneeId] = useState(currentUserId)
  const [dueDate,    setDueDate]    = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createActionItem({
        message_id:  messageId,
        room_id:     roomId,
        assigned_to: assigneeId,
        title:       title.trim(),
        due_date:    dueDate ? new Date(dueDate).toISOString() : null,
      })
      onClose()
    } catch (err) {
      setError(t('taskCreateError'))
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full sm:max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--card)' }}
      >
        <div className="card-accent-bar" />

        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center gap-2">
            <CheckSquare size={18} style={{ color: 'var(--blue)' }} />
            <span className="font-bold text-[15px]" style={{ color: 'var(--ink)' }}>
              {t('taskCreateTitle')}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--ink-4)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* title */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ink-3)' }}>
              {t('taskTitle')}
            </label>
            <textarea
              value={title}
              onChange={e => setTitle(e.target.value)}
              rows={2}
              required
              className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none transition-colors"
              style={{
                background:   'var(--bg)',
                border:       '1px solid var(--line)',
                color:        'var(--ink)',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--blue)')}
              onBlur={e  => (e.currentTarget.style.borderColor = 'var(--line)')}
            />
          </div>

          {/* assignee */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ink-3)' }}>
              <User size={11} className="inline mr-1" />
              {t('taskAssignee')}
            </label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin">
              {members.map(m => (
                <label
                  key={m.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-colors"
                  style={{
                    background: assigneeId === m.id ? 'rgba(var(--blue-rgb, 59 130 246) / 0.1)' : 'var(--bg)',
                    border: `1px solid ${assigneeId === m.id ? 'var(--blue)' : 'var(--line)'}`,
                  }}
                >
                  <input
                    type="radio"
                    name="assignee"
                    value={m.id}
                    checked={assigneeId === m.id}
                    onChange={() => setAssigneeId(m.id)}
                    className="sr-only"
                  />
                  <Avatar name={m.name} avatarUrl={m.avatar_url} size="xs" />
                  <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {m.name}
                    {m.id === currentUserId && (
                      <span className="ml-1 text-xs" style={{ color: 'var(--ink-4)' }}>({t('taskMe')})</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* due date */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ink-3)' }}>
              <Calendar size={11} className="inline mr-1" />
              {t('taskDueDate')} ({t('taskDueDateOptional')})
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
              style={{
                background:   'var(--bg)',
                border:       '1px solid var(--line)',
                color:        'var(--ink)',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--blue)')}
              onBlur={e  => (e.currentTarget.style.borderColor = 'var(--line)')}
            />
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>

        {/* footer */}
        <div className="flex gap-2.5 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: 'var(--bg)', color: 'var(--ink-3)', border: '1px solid var(--line)' }}
          >
            {t('taskCancel')}
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity"
            style={{ background: 'var(--blue)', opacity: saving || !title.trim() ? 0.6 : 1 }}
          >
            {saving ? t('taskSaving') : t('taskCreate')}
          </button>
        </div>
      </form>
    </div>
  )
}
