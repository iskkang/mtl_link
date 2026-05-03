import type { LucideIcon } from 'lucide-react'

interface IconProps {
  icon: LucideIcon
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP = { xs: 14, sm: 18, md: 20, lg: 24 }

export function Icon({ icon: IconComponent, size = 'md', className = '' }: IconProps) {
  return <IconComponent size={SIZE_MAP[size]} className={className} strokeWidth={2} />
}
