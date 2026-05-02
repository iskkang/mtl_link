import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckSquare, Inbox, Send, CheckCheck } from 'lucide-react'
import { ActionItemList } from '../components/actionitems/ActionItemList'
import { useActionItems } from '../hooks/useActionItems'
import { useDueDateNotifications } from '../hooks/useDueDateNotifications'

type Tab = 'received' | 'created' | 'done'

export default function ActionItemsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('received')
  const { received, created, done, loading, reload } = useActionItems()

  useDueDateNotifications(received)

  const TABS: { id: Tab; icon: React.ReactNode; label: string; count?: number }[] = [
    { id: 'received', icon: <Inbox size={14} />,     label: t('taskTabReceived'), count: received.length },
    { id: 'created',  icon: <Send size={14} />,      label: t('taskTabCreated'),  count: created.length },
    { id: 'done',     icon: <CheckCheck size={14} />, label: t('taskTabDone') },
  ]

  const items = tab === 'received' ? received : tab === 'created' ? created : done

  return (
    <div className="flex flex-col h-full sidebar-panel">
      {/* header */}
      <header
        className="flex items-center gap-2.5 px-4 py-3.5 flex-shrink-0 border-b"
        style={{ borderColor: 'var(--side-line)' }}
      >
        <CheckSquare size={18} style={{ color: 'var(--blue)' }} />
        <span className="font-bold text-[15px]" style={{ color: 'var(--side-text)' }}>
          {t('taskPageTitle')}
        </span>
      </header>

      {/* tabs */}
      <div className="flex flex-shrink-0 border-b" style={{ borderColor: 'var(--side-line)' }}>
        {TABS.map(({ id, icon, label, count }) => {
          const isActive = tab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5
                         text-xs font-semibold border-b-2 transition-colors"
              style={{
                borderColor: isActive ? 'var(--blue)' : 'transparent',
                color: isActive ? 'var(--side-text)' : 'var(--side-mute)',
              }}
            >
              {icon}
              {label}
              {count !== undefined && count > 0 && (
                <span
                  className="min-w-[16px] h-[16px] px-1 rounded-full text-white text-[9px]
                             font-bold flex items-center justify-center"
                  style={{ background: id === 'received' ? '#EF3F1A' : 'var(--blue)' }}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="spinner" />
        </div>
      ) : (
        <ActionItemList items={items} onReload={reload} view={tab} />
      )}
    </div>
  )
}
