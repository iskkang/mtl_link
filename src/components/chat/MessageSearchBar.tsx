import { useRef, useEffect } from 'react'
import { X, ChevronDown, ChevronUp, Globe } from 'lucide-react'

interface Props {
  query:       string
  onChange:    (q: string) => void
  onClose:     () => void
  total:       number
  currentIdx:  number
  onNext:      () => void
  onPrev:      () => void
  canNext:     boolean
  canPrev:     boolean
  onGlobal:    () => void
  onEnter:     () => void
  placeholder: string
  labelGlobal: string
}

export function MessageSearchBar({
  query, onChange, onClose,
  total, currentIdx,
  onNext, onPrev, canNext, canPrev,
  onGlobal, onEnter, placeholder, labelGlobal,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div
      className="flex items-center gap-1 px-2 py-1.5 border-b"
      style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 text-sm bg-transparent outline-none"
        style={{ color: 'var(--ink)' }}
        onKeyDown={e => {
          if (e.nativeEvent.isComposing) return
          if (e.key === 'Enter') {
            e.preventDefault()
            if (total > 0) onNext()
            else onEnter()
          }
        }}
      />

      {query && total > 0 && (
        <span className="text-xs whitespace-nowrap" style={{ color: 'var(--ink-3)' }}>
          {currentIdx + 1}/{total}
        </span>
      )}

      <button
        onClick={onPrev}
        disabled={!canPrev}
        className="p-1 rounded disabled:opacity-30 transition-colors"
        style={{ color: 'var(--ink-3)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        title="이전 결과 (∧)"
      >
        <ChevronUp size={16} />
      </button>

      <button
        onClick={onNext}
        disabled={!canNext}
        className="p-1 rounded disabled:opacity-30 transition-colors"
        style={{ color: 'var(--ink-3)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        title="다음 결과 (∨)"
      >
        <ChevronDown size={16} />
      </button>

      <button
        onClick={onGlobal}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors"
        style={{ color: 'var(--ink-3)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        title={labelGlobal}
      >
        <Globe size={14} />
        <span className="hidden sm:inline">{labelGlobal}</span>
      </button>

      <button
        onClick={onClose}
        className="p-1 rounded transition-colors"
        style={{ color: 'var(--ink-3)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <X size={16} />
      </button>
    </div>
  )
}
