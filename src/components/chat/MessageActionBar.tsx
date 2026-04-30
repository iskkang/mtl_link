import { useState, useRef } from 'react'
import { Smile, Paperclip, Globe } from 'lucide-react'
import { EmojiPickerPopup } from '../emoji/EmojiPickerPopup'
import { VoiceRecorderButton } from '../voice/VoiceRecorderButton'
import { validateFiles } from '../../lib/fileValidation'
import { sendFileMessage } from '../../services/messageService'
import { getUserFriendlyMessage } from '../../lib/errors'

const LANG_LABELS: Record<string, string> = {
  ko: '한국어', en: 'English', ru: 'Русский',
  zh: '中文',   ja: '日本語',  uz: "O'zbek",
}

interface Props {
  roomId:                  string
  disabled?:               boolean
  onEmojiSelect:           (emoji: string) => void
  onError:                 (msg: string) => void
  targetLanguage:          string | null   // null = 로딩 중, 'none' = 번역 안 함
  onOpenTranslationModal:  () => void
}

export function MessageActionBar({
  roomId, disabled, onEmojiSelect, onError,
  targetLanguage, onOpenTranslationModal,
}: Props) {
  const [emojiOpen,     setEmojiOpen]     = useState(false)
  const [fileUploading, setFileUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const v = validateFiles(files)
    if (!v.ok) { onError(v.error ?? '파일 검증 실패'); return }

    setFileUploading(true)
    try {
      await sendFileMessage(roomId, files)
    } catch (err) {
      onError(getUserFriendlyMessage(err))
    } finally {
      setFileUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const activeTranslation = targetLanguage && targetLanguage !== 'none'

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 flex-shrink-0
                    bg-[#f9f9f9] dark:bg-surface-panel
                    border-t border-gray-200 dark:border-[#374045]">

      {/* ── 이모지 ──────────────────────────────── */}
      <div className="relative">
        <ActionBtn
          label="이모지"
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
        label="파일 첨부"
        disabled={disabled || fileUploading}
        loading={fileUploading}
        onClick={() => fileInputRef.current?.click()}
      >
        <Paperclip size={19} />
      </ActionBtn>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        accept="image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip,application/x-zip-compressed"
        onChange={handleFileSelect}
      />

      {/* ── 음성 번역 ──────────────────────────── */}
      <VoiceRecorderButton
        roomId={roomId}
        targetLanguage={targetLanguage}
        disabled={disabled}
        onError={onError}
      />

      {/* ── 번역 언어 배지 (클릭 → 설정 모달) ─── */}
      <button
        type="button"
        onClick={onOpenTranslationModal}
        disabled={disabled}
        title="번역 언어 설정"
        className={`ml-1 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                    transition-colors border
                    ${activeTranslation
                      ? 'border-mtl-cyan/40 dark:border-accent/40 text-mtl-cyan dark:text-accent bg-mtl-cyan/5 dark:bg-accent/5 hover:bg-mtl-cyan/10 dark:hover:bg-accent/10'
                      : 'border-gray-200 dark:border-[#374045] text-gray-400 dark:text-[#8696a0] hover:bg-gray-100 dark:hover:bg-surface-hover'
                    }
                    disabled:opacity-40 disabled:cursor-not-allowed`}
        aria-label="번역 언어 설정"
      >
        <Globe size={11} />
        {activeTranslation
          ? (LANG_LABELS[targetLanguage!] ?? targetLanguage!.toUpperCase())
          : '번역 설정'
        }
      </button>
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
      className={`
        p-2 rounded-lg transition-colors duration-100
        ${active
          ? 'text-mtl-cyan dark:text-accent bg-mtl-cyan/10 dark:bg-accent/10'
          : 'text-gray-400 dark:text-[#8696a0] hover:text-gray-600 dark:hover:text-[#e9edef] hover:bg-gray-100 dark:hover:bg-surface-hover'
        }
        disabled:opacity-35 disabled:cursor-not-allowed
      `}
    >
      {loading
        ? <span className="w-[19px] h-[19px] border-2 border-current/30 border-t-current rounded-full animate-spin block" />
        : children
      }
    </button>
  )
}
