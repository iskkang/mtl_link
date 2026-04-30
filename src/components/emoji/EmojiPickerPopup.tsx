import { useEffect, useRef } from 'react'
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react'
import { useTheme } from '../../contexts/ThemeContext'

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
      <EmojiPicker
        theme={mode === 'dark' ? Theme.DARK : Theme.LIGHT}
        emojiStyle={EmojiStyle.NATIVE}
        onEmojiClick={d => onSelect(d.emoji)}
        height={360}
        width={320}
        searchPlaceholder="이모지 검색…"
        lazyLoadEmojis
      />
    </div>
  )
}
