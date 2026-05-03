import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type Variant = 'regular' | 'line' | 'text' | 'icon'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps {
  variant?:       Variant
  size?:          Size
  icon?:          LucideIcon
  iconPosition?:  'left' | 'right'
  fullWidth?:     boolean
  loading?:       boolean
  disabled?:      boolean
  onClick?:       () => void
  children?:      ReactNode
  className?:     string
}

interface FABProps {
  icon:       LucideIcon
  onClick?:   () => void
  badge?:     number
  className?: string
}

const VARIANTS: Record<Variant, string> = {
  regular: 'bg-brand-500 hover:bg-brand-600 text-white',
  line:    'border border-brand-500 text-brand-500 hover:bg-brand-500/5',
  text:    'text-brand-500 hover:bg-brand-500/5',
  icon:    'hover:bg-surfaceLight-hover dark:hover:bg-surface-hover',
}

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-subtitle-3 rounded-md',
  md: 'px-4 py-2 text-headline rounded-md',
  lg: 'px-6 py-3 text-headline-2 rounded-lg',
}

export function Button({
  variant = 'regular',
  size = 'md',
  icon: Ico,
  iconPosition = 'left',
  fullWidth,
  loading,
  disabled,
  onClick,
  children,
  className = '',
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`ui-button inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {Ico && iconPosition === 'left'  && <Ico size={size === 'sm' ? 16 : 18} />}
      {children}
      {Ico && iconPosition === 'right' && <Ico size={size === 'sm' ? 16 : 18} />}
    </button>
  )
}

export function FAB({ icon: Ico, onClick, badge, className = '' }: FABProps) {
  return (
    <button
      onClick={onClick}
      className={`relative w-14 h-14 rounded-full bg-brand-500 hover:bg-brand-600 text-white shadow-fab flex items-center justify-center transition-all duration-150 active:scale-95 ${className}`}
    >
      <Ico size={24} strokeWidth={2.5} />
      {badge !== undefined && badge > 0 && (
        <span className="absolute -bottom-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-status-danger text-white text-caption-3 flex items-center justify-center border-2 border-white dark:border-surface-base">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}
