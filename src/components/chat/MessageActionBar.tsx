import { useRef } from 'react'
import { Smile, Paperclip } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmojiPickerPopup } from '../emoji/EmojiPickerPopup'
import { VoiceRecorderButton } from '../voice/VoiceRecorderButton'
import { OcrButton } from './OcrButton'
import { useState } from 'react'

interface Props {
  roomId:                 string
  disabled?:              boolean
  uploading?:             boolean
  onEmojiSelect:          (emoji: string) => void
  onError:                (msg: string) => void
  onFilesSelected:        (files: File[]) => void
  targetLanguage:         string | null
  onOpenTranslationModal: () => void
}

export function MessageActionBar({
  roomId, disabled, uploading, onEmojiSelect, onError,
  onFilesSelected, targetLanguage,
}: Props) {
  const { t } = useTranslation()
  const [emojiOpen, setEmojiOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    onFilesSelected(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div
      className="flex items-center gap-0.5 px-3 py-1.5 flex-shrink-0 border-t"
      style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
    >

      {/* ── 이모지 ──────────────────────────────── */}
      <div className="relative">
        <ActionBtn
          label={t('emojiBtn')}
          disabled={disabled}
          active={emojiOpen}
          onClick={() => setEmojiOpen(v => !v)}
        >
          <Smile size={19} />
        </ActionBtn>

        {emojiOpen && (
          <EmojiPickerPopup
            onSelect={emoji => { onEmojiSelect(emoji); setEmojiOpen(false) }}
            onClose={() => setEmojiOpen(false)}
          />
        )}
      </div>

      {/* ── 파일 첨부 ──────────────────────────── */}
      <ActionBtn
        label={t('attachBtn')}
        disabled={disabled || uploading}
        loading={uploading}
        onClick={() => fileInputRef.current?.click()}
      >
        <Paperclip size={19} />
      </ActionBtn>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        accept="*/*"
        onChange={handleFileChange}
      />

      {/* ── 음성 번역 ──────────────────────────── */}
      <VoiceRecorderButton
        roomId={roomId}
        targetLanguage={targetLanguage}
        disabled={disabled}
        onError={onError}
      />

      {/* ── OCR 번역 ───────────────────────────── */}
      <OcrButton
        roomId={roomId}
        targetLanguage={targetLanguage}
        disabled={disabled}
        onError={onError}
      />
    </div>
  )
}

/* ── 공통 아이콘 버튼 ────────────────────────────── */
function ActionBtn({
  children, label, disabled, active, loading, onClick,
}: {
  children?: React.ReactNode
  label:     string
  disabled?: boolean
  active?:   boolean
  loading?:  boolean
  onClick?:  () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="p-2 rounded-lg transition-colors duration-100 disabled:opacity-35 disabled:cursor-not-allowed"
      style={active ? { color: 'var(--blue)', background: 'rgba(37,99,235,0.08)' } : { color: 'var(--ink-3)' }}
    >
      {loading
        ? <span className="w-[19px] h-[19px] border-2 border-current/30 border-t-current rounded-full animate-spin block" />
        : children
      }
    </button>
  )
}
