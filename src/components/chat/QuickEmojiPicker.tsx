import { useState, useRef, useEffect } from 'react'
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react'
import { useTheme } from '../../contexts/ThemeContext'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '✅', '👀', '🎉']

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
          <EmojiPicker
            theme={mode === 'dark' ? Theme.DARK : Theme.LIGHT}
            emojiStyle={EmojiStyle.NATIVE}
            onEmojiClick={d => { onSelect(d.emoji); setShowFull(false) }}
            height={320}
            width={300}
            searchPlaceholder="이모지 검색…"
            lazyLoadEmojis
            skinTonesDisabled
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}
    </div>
  )
}
