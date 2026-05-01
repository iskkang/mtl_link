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
  placeholder: string
  labelGlobal: string
}

export function MessageSearchBar({
  query, onChange, onClose,
  total, currentIdx,
  onNext, onPrev, canNext, canPrev,
  onGlobal, placeholder, labelGlobal,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-white dark:bg-[#1e2a35] border-b border-gray-200 dark:border-[#2a3942]">
      <input
        ref={inputRef}
        value={query}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 text-sm bg-transparent outline-none text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
      />

      {query && total > 0 && (
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {currentIdx + 1}/{total}
        </span>
      )}

      <button
        onClick={onPrev}
        disabled={!canPrev}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#2a3942] disabled:opacity-30"
        title="이전 결과"
      >
        <ChevronUp size={16} />
      </button>

      <button
        onClick={onNext}
        disabled={!canNext}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#2a3942] disabled:opacity-30"
        title="다음 결과"
      >
        <ChevronDown size={16} />
      </button>

      <button
        onClick={onGlobal}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-[#2a3942] text-gray-600 dark:text-gray-300"
        title={labelGlobal}
      >
        <Globe size={14} />
        <span className="hidden sm:inline">{labelGlobal}</span>
      </button>

      <button
        onClick={onClose}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#2a3942]"
      >
        <X size={16} />
      </button>
    </div>
  )
}
