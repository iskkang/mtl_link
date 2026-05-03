import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface ChipProps {
  variant?:  'default' | 'bold' | 'inactive' | 'user' | 'icon'
  avatar?:   string
  icon?:     LucideIcon
  onRemove?: () => void
  onClick?:  () => void
  children:  ReactNode
}

const CHIP_VARIANTS: Record<string, string> = {
  default:  'bg-surfaceLight-primary dark:bg-surface-elevated text-contentLight-primary dark:text-content-primary',
  bold:     'border-2 border-contentLight-primary dark:border-content-primary text-contentLight-primary dark:text-content-primary font-bold',
  inactive: 'border border-contentLight-tertiary dark:border-content-tertiary text-contentLight-tertiary dark:text-content-tertiary',
  user:     'bg-surfaceLight-primary dark:bg-surface-elevated text-contentLight-primary dark:text-content-primary',
  icon:     'bg-surfaceLight-primary dark:bg-surface-elevated text-contentLight-primary dark:text-content-primary',
}

export function Chip({ variant = 'default', avatar, icon: Ico, onRemove, onClick, children }: ChipProps) {
  return (
    <span
      onClick={onClick}
      className={`ui-chip inline-flex items-center gap-2 rounded-full text-headline ${variant === 'user' ? 'pl-0 pr-4 py-0' : 'px-4 py-2'} ${CHIP_VARIANTS[variant]} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
    >
      {avatar && variant === 'user' && (
        <img src={avatar} className="w-8 h-8 rounded-full" alt="" />
      )}
      {Ico && <Ico size={16} />}
      <span className={variant === 'user' ? 'py-2' : ''}>{children}</span>
      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="ml-1 opacity-60 hover:opacity-100"
        >
          ×
        </button>
      )}
    </span>
  )
}
