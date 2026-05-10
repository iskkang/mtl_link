import { useEffect, useRef, lazy, Suspense } from 'react'
import { useTheme } from '../../contexts/ThemeContext'

const EmojiPickerCore = lazy(() => import('./EmojiPickerCore'))

interface Props {
  onSelect: (emoji: string) => void
  onClose:  () => void
}

export function EmojiPickerPopup({ onSelect, onClose }: Props) {
  const { mode } = useTheme()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute bottom-12 left-0 z-50 shadow-2xl rounded-xl overflow-hidden"
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
          onClose={onClose}
        />
      </Suspense>
    </div>
  )
}
