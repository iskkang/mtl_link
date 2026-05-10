import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import { useTheme } from '../../contexts/ThemeContext'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '✅', '👀', '🎉']

const EmojiPickerCore = lazy(() => import('../emoji/EmojiPickerCore'))

interface Props {
  onSelect: (emoji: string) => void
}

export function QuickEmojiPicker({ onSelect }: Props) {
  const [showFull, setShowFull] = useState(false)
  const { mode } = useTheme()
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showFull) return
    const onMouse = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setShowFull(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowFull(false) }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [showFull])

  return (
    <div className="relative flex items-center gap-1">
      {QUICK_EMOJIS.map(emoji => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="text-xl leading-none rounded hover:bg-muted p-1 transition-colors"
        >
          {emoji}
        </button>
      ))}
      <button
        onClick={() => setShowFull(v => !v)}
        className="text-sm text-muted-foreground rounded hover:bg-muted px-1.5 py-1 transition-colors"
      >
        ···
      </button>
      {showFull && (
        <div
          ref={popRef}
          className="absolute bottom-10 left-0 z-50 shadow-2xl rounded-xl overflow-hidden"
        >
          <Suspense fallback={
            <div
              className="w-[300px] h-[320px] flex items-center justify-center"
              style={{ background: 'var(--card)' }}
            >
              <div
                className="w-6 h-6 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }}
              />
            </div>
          }>
            <EmojiPickerCore
              isDark={mode === 'dark'}
              onSelect={onSelect}
              onClose={() => setShowFull(false)}
            />
          </Suspense>
        </div>
      )}
    </div>
  )
}
