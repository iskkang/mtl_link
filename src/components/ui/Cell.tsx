import type { ReactNode } from 'react'

interface CellProps {
  variant?:    'avatar' | 'twoLined' | 'threeLined' | 'detail' | 'default'
  leading?:    ReactNode
  title:       string
  subtitle?:   string
  description?: string
  trailing?:   ReactNode
  onClick?:    () => void
  selected?:   boolean
  className?:  string
}

export function Cell({
  variant = 'default',
  leading,
  title,
  subtitle,
  description,
  trailing,
  onClick,
  selected,
  className = '',
}: CellProps) {
  return (
    <button
      onClick={onClick}
      className={`ui-cell w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ${selected ? 'bg-brand-500/10' : 'hover:bg-surfaceLight-hover dark:hover:bg-surface-hover'} ${className}`}
    >
      {leading && <div className="flex-shrink-0">{leading}</div>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-headline-2 truncate text-contentLight-primary dark:text-content-primary">
            {title}
          </span>
          {variant !== 'default' && trailing && variant !== 'detail' && (
            <span className="flex-shrink-0 text-caption-2 text-contentLight-tertiary dark:text-content-tertiary">
              {trailing}
            </span>
          )}
        </div>
        {subtitle && (
          <div className="text-subtitle-2 text-contentLight-secondary dark:text-content-secondary truncate mt-0.5">
            {subtitle}
          </div>
        )}
        {description && variant === 'threeLined' && (
          <div className="text-caption-2 text-contentLight-tertiary dark:text-content-tertiary truncate mt-0.5">
            {description}
          </div>
        )}
      </div>
      {variant === 'detail' && trailing && (
        <span className="flex-shrink-0 text-subtitle-2 text-brand-500">{trailing}</span>
      )}
    </button>
  )
}
