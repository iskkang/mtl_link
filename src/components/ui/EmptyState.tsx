import type { LucideIcon } from 'lucide-react'

interface Action {
  label:   string
  onClick: () => void
  icon?:   LucideIcon
}

interface Props {
  icon:         LucideIcon
  title:        string
  description?: string
  action?:      Action
  className?:   string
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 py-12 ${className}`}>
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ background: 'var(--side-row)' }}
      >
        <Icon size={28} strokeWidth={1.75} style={{ color: 'var(--side-mute)' }} />
      </div>

      <p className="text-sm font-semibold mb-1" style={{ color: 'var(--side-mute)' }}>
        {title}
      </p>

      {description && (
        <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: 'var(--side-mute)', opacity: 0.7 }}>
          {description}
        </p>
      )}

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-white transition-colors"
          style={{ background: 'var(--brand)' }}
          onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
          onMouseLeave={e => (e.currentTarget.style.filter = '')}
        >
          {action.icon && <action.icon size={13} />}
          {action.label}
        </button>
      )}
    </div>
  )
}
