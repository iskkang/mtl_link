interface Props {
  size?:      'sm' | 'md' | 'lg'
  onClick?:   () => void
  className?: string
}

const SIZE_MAP    = { sm: 'w-8 h-8',   md: 'w-9 h-9',   lg: 'w-12 h-12' } as const
const PADDING_MAP = { sm: 'p-1',       md: 'p-1.5',     lg: 'p-2'       } as const

export function LogoBox({ size = 'md', onClick, className = '' }: Props) {
  const base = `${SIZE_MAP[size]} ${PADDING_MAP[size]} rounded-lg bg-white flex items-center justify-center flex-shrink-0 ${className}`
  const style = { boxShadow: '0 1px 3px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.07)' }
  const img   = <img src="/mtl-logo.png" alt="MTL Link" className="w-full h-full object-contain" />

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} cursor-pointer transition-opacity hover:opacity-80 active:scale-95`}
        style={style}
        aria-label="홈으로"
      >
        {img}
      </button>
    )
  }
  return (
    <div className={base} style={style}>
      {img}
    </div>
  )
}
