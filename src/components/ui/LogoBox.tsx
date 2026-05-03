interface Props {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP    = { sm: 'w-8 h-8',   md: 'w-9 h-9',   lg: 'w-12 h-12' } as const
const PADDING_MAP = { sm: 'p-1',       md: 'p-1.5',     lg: 'p-2'       } as const

export function LogoBox({ size = 'md', className = '' }: Props) {
  return (
    <div
      className={`${SIZE_MAP[size]} ${PADDING_MAP[size]} rounded-lg bg-white flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.07)' }}
    >
      <img src="/mtl-logo.png" alt="MTL Link" className="w-full h-full object-contain" />
    </div>
  )
}
