import { Bot } from 'lucide-react'

interface Props {
  name: string
  avatarUrl?: string | null
  avatarColor?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  is_bot?: boolean
}

const SIZES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-20 h-20 text-xl',
}

const FALLBACK_COLORS = [
  '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#10b981', '#14b8a6',
  '#f59e0b', '#f97316',
]

function colorFor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length]
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function Avatar({ name, avatarUrl, avatarColor, size = 'md', className = '', is_bot = false }: Props) {
  const sizeClass = SIZES[size]
  const bg = avatarColor ?? colorFor(name)

  if (is_bot) {
    return (
      <div
        className={`${sizeClass} rounded-full flex items-center justify-center flex-shrink-0 ${className}`}
        style={{ background: 'var(--blue-soft)', color: 'var(--brand)' }}
      >
        <Bot size={size === 'xs' ? 12 : size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
      </div>
    )
  }

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center
                  font-semibold text-white flex-shrink-0 select-none ${className}`}
      style={{ background: bg }}
    >
      {initials(name)}
    </div>
  )
}
