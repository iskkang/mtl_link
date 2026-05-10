import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react'

interface Props {
  isDark:   boolean
  onSelect: (emoji: string) => void
  onClose:  () => void
}

export default function EmojiPickerCore({ isDark, onSelect, onClose }: Props) {
  return (
    <EmojiPicker
      theme={isDark ? Theme.DARK : Theme.LIGHT}
      emojiStyle={EmojiStyle.NATIVE}
      onEmojiClick={d => { onSelect(d.emoji); onClose() }}
      height={320}
      width={300}
      searchPlaceholder="이모지 검색…"
      lazyLoadEmojis
      skinTonesDisabled
      previewConfig={{ showPreview: false }}
    />
  )
}
