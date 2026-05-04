import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  title?:      string
  icon?:       LucideIcon
  children:    ReactNode
  className?:  string
  action?:     { label: string; onClick: () => void }
  badge?:      number
  scrollable?: boolean
}

export function DashboardCard({ title, icon: Icon, children, className = '', action, badge, scrollable }: Props) {
  return (
    <div
      className={`rounded-2xl flex flex-col overflow-hidden ${className}`}
      style={{ background: 'var(--card)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-panel)' }}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={14} style={{ color: 'var(--ink-3)' }} />}
            {title && (
              <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
                {title}
              </h3>
            )}
            {badge != null && badge > 0 && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                style={{ background: 'var(--brand)', color: '#fff' }}
              >
                {badge}
              </span>
            )}
          </div>
          {action && (
            <button
              onClick={action.onClick}
              className="text-[11px] font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--brand)' }}
            >
              {action.label}
            </button>
          )}
        </div>
      )}
      <div className={`flex-1 min-h-0 px-5 pb-5 flex flex-col ${scrollable ? 'overflow-y-auto scrollbar-thin' : 'overflow-hidden'}`}>
        {children}
      </div>
    </div>
  )
}
