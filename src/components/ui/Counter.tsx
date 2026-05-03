interface CounterProps {
  count:    number
  variant?: 'primary' | 'muted' | 'danger'
  size?:    'sm' | 'md'
  max?:     number
}

const VARIANTS = {
  primary: 'bg-brand-500 text-white',
  muted:   'bg-surfaceLight-primary dark:bg-surface-hover text-contentLight-secondary dark:text-content-secondary',
  danger:  'bg-status-danger text-white',
}

const SIZES = {
  sm: 'min-w-[18px] h-[18px] px-1 text-caption',
  md: 'min-w-[22px] h-[22px] px-1.5 text-caption-3',
}

export function Counter({ count, variant = 'primary', size = 'md', max = 99 }: CounterProps) {
  if (count <= 0) return null
  return (
    <span className={`ui-counter inline-flex items-center justify-center rounded-full font-medium ${VARIANTS[variant]} ${SIZES[size]}`}>
      {count > max ? `${max}+` : count}
    </span>
  )
}
