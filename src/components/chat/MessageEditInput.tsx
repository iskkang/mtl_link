import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

interface Props {
  initialValue: string
  onSave:       (content: string) => Promise<void>
  onCancel:     () => void
}

export function MessageEditInput({ initialValue, onSave, onCancel }: Props) {
  const { t } = useTranslation()
  const [value,   setValue]   = useState(initialValue)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 포커스 + 커서 끝으로 이동
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  const handleSave = async () => {
    const trimmed = value.trim()
    if (!trimmed || trimmed === initialValue) { onCancel(); return }
    setLoading(true)
    setError(null)
    try {
      await onSave(trimmed)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave() }
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={loading}
        rows={Math.min(6, (value.match(/\n/g)?.length ?? 0) + 1)}
        placeholder={t('msgEditPlaceholder')}
        className="w-full resize-none rounded-lg px-3 py-2 text-sm
                   bg-white dark:bg-surface-input
                   border border-gray-300 dark:border-[#374045]
                   text-gray-800 dark:text-[#e9edef]
                   placeholder-gray-400 dark:placeholder-[#8696a0]
                   outline-none focus:ring-2 focus:ring-mtl-cyan/40
                   disabled:opacity-50"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-medium
                     text-gray-500 dark:text-[#8696a0]
                     hover:bg-gray-100 dark:hover:bg-surface-hover
                     disabled:opacity-50 transition-colors"
        >
          {t('msgEditCancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={loading || !value.trim()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                     bg-mtl-navy dark:bg-accent text-white
                     hover:bg-mtl-navy/90 dark:hover:bg-accent-hover
                     disabled:opacity-50 transition-colors"
        >
          {loading && <Loader2 size={11} className="animate-spin" />}
          {t('msgEditSave')}
        </button>
      </div>
    </div>
  )
}
