import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckSquare } from 'lucide-react'
import { ActionItemCard } from './ActionItemCard'
import type { ActionItem } from '../../services/actionItemService'

interface Props {
  items:    ActionItem[]
  onReload: () => void
  view:     'received' | 'created' | 'done'
}

interface Group {
  label: string
  items: ActionItem[]
}

function groupItems(items: ActionItem[]): Group[] {
  const now = new Date()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  const weekEnd  = new Date(todayEnd)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const overdue:   ActionItem[] = []
  const today:     ActionItem[] = []
  const thisWeek:  ActionItem[] = []
  const later:     ActionItem[] = []
  const noDueDate: ActionItem[] = []

  for (const item of items) {
    if (!item.due_date) {
      noDueDate.push(item)
      continue
    }
    const due = new Date(item.due_date)
    if (due < now)         overdue.push(item)
    else if (due <= todayEnd)  today.push(item)
    else if (due <= weekEnd)   thisWeek.push(item)
    else                       later.push(item)
  }

  const groups: Group[] = []
  if (overdue.length)   groups.push({ label: 'taskGroupOverdue',   items: overdue })
  if (today.length)     groups.push({ label: 'taskGroupToday',     items: today })
  if (thisWeek.length)  groups.push({ label: 'taskGroupThisWeek',  items: thisWeek })
  if (later.length)     groups.push({ label: 'taskGroupLater',     items: later })
  if (noDueDate.length) groups.push({ label: 'taskGroupNoDueDate', items: noDueDate })
  return groups
}

export function ActionItemList({ items, onReload, view }: Props) {
  const { t } = useTranslation()
  const groups = useMemo(() => {
    if (view === 'done') return [{ label: '', items }]
    return groupItems(items)
  }, [items, view])

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-16 text-center px-6">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: 'var(--side-row)' }}
        >
          <CheckSquare size={28} style={{ color: 'var(--side-mute)' }} />
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--side-mute)' }}>
          {t('taskEmpty')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2 space-y-4">
      {groups.map(group => (
        <div key={group.label}>
          {group.label && (
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2 px-0.5"
               style={{ color: 'var(--side-mute)' }}>
              {t(group.label)}
            </p>
          )}
          <div className="space-y-2">
            {group.items.map(item => (
              <ActionItemCard key={item.id} item={item} onReload={onReload} view={view} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
