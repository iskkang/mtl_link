import { useRef, useCallback } from 'react'
import { Smile, Paperclip, Mic, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmojiPickerPopup } from '../emoji/EmojiPickerPopup'
import { OcrButton } from './OcrButton'
import { useState } from 'react'
import { useMicrophonePermission } from '../../hooks/useMicrophonePermission'
import { useMediaRecorder } from '../../hooks/useMediaRecorder'
import { sendVoiceTranslatedMessage } from '../../services/voiceMessageService'
import { getUserFriendlyMessage } from '../../lib/errors'

function fmtTime(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

interface Props {
  roomId:                 string
  disabled?:              boolean
  uploading?:             boolean
  onEmojiSelect:          (emoji: string) => void
  onError:                (msg: string) => void
  onFilesSelected:        (files: File[]) => void
  targetLanguage:         string | null
  peerLanguage?:          string | null
  onOpenTranslationModal: () => void
}

export function MessageActionBar({
  roomId, disabled, uploading, onEmojiSelect, onError,
  onFilesSelected, targetLanguage, peerLanguage,
}: Props) {
  const { t } = useTranslation()
  const [emojiOpen, setEmojiOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { state: micState, request: requestMic } = useMicrophonePermission()

  // 1:1 DM이면 상대방의 preferred_language를, 아니면 내 설정 언어를 사용
  const effectiveTarget = peerLanguage ?? targetLanguage

  const handleBlob = useCallback(async (blob: Blob) => {
    if (!effectiveTarget || effectiveTarget === 'none') return
    try {
      await sendVoiceTranslatedMessage({ roomId, audioBlob: blob, targetLanguage: effectiveTarget })
    } catch (err) {
      onError(getUserFriendlyMessage(err))
    }
  }, [roomId, effectiveTarget, onError])

  const { recState, elapsedMs, start, stop, cancel } = useMediaRecorder(handleBlob)

  const isRecording  = recState === 'recording'
  const isProcessing = recState === 'processing'
  const canVoice     = !!effectiveTarget && effectiveTarget !== 'none' && !disabled

  const handleMicClick = async () => {
    if (isProcessing) return
    if (!canVoice) {
      onError('번역 언어를 먼저 헤더에서 설정해 주세요')
      return
    }
    if (micState === 'denied') {
      onError('마이크 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.')
      return
    }
    if (micState !== 'granted') {
      const ok = await requestMic()
      if (!ok) { onError('마이크 권한이 필요합니다.'); return }
    }
    const ok = await start()
    if (!ok) onError('녹음을 시작할 수 없습니다.')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    onFilesSelected(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── 녹음 중: 전체 너비 배너 ─────────────────────────
  if (isRecording) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0"
        style={{ background: 'var(--blue-soft)', borderTop: '1px solid rgba(37,99,235,0.15)' }}
      >
        {/* 빨간 점 + 타이머 */}
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse"
          style={{ background: '#EF4444' }}
        />
        <span
          className="text-sm font-mono-ui font-semibold tabular-nums flex-shrink-0 min-w-[36px]"
          style={{ color: '#EF4444' }}
        >
          {fmtTime(elapsedMs)}
        </span>
        <span className="flex-1 text-sm" style={{ color: 'var(--ink-3)' }}>
          말씀해 주세요…
        </span>
        {/* 취소 */}
        <button
          onClick={cancel}
          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
          style={{ color: 'var(--ink-3)', border: '1px solid var(--line)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          취소
        </button>
        {/* 전송 */}
        <button
          onClick={stop}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5 flex-shrink-0"
          style={{ background: 'var(--blue)' }}
        >
          <Send size={13} />
          전송
        </button>
      </div>
    )
  }

  // ── 처리 중 ───────────────────────────────────────────
  if (isProcessing) {
    return (
      <div
        className="flex items-center justify-center gap-2 px-4 py-2.5 flex-shrink-0"
        style={{ background: 'var(--card)', borderTop: '1px solid var(--line)' }}
      >
        <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin block"
              style={{ color: 'var(--blue)' }} />
        <span className="text-sm" style={{ color: 'var(--ink-3)' }}>음성 번역 중…</span>
      </div>
    )
  }

  // ── 기본 액션 버튼들 ─────────────────────────────────
  return (
    <div
      className="flex items-center gap-0.5 px-2 md:px-3 py-1 md:py-1.5 flex-shrink-0 border-t"
      style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
    >
      {/* 이모지 */}
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

      {/* 파일 첨부 */}
      <ActionBtn
        label={t('attachBtn')}
        disabled={disabled || uploading}
        loading={uploading}
        onClick={() => fileInputRef.current?.click()}
      >
        <Paperclip size={19} />
      </ActionBtn>
      <input ref={fileInputRef} type="file" multiple hidden accept="*/*" onChange={handleFileChange} />

      {/* 마이크 */}
      <ActionBtn
        label={canVoice ? '음성 번역 (클릭하여 녹음)' : '번역 언어를 먼저 설정해 주세요'}
        disabled={isProcessing || disabled}
        onClick={handleMicClick}
      >
        <Mic size={19} />
      </ActionBtn>

      {/* OCR */}
      <OcrButton
        roomId={roomId}
        targetLanguage={targetLanguage}
        disabled={disabled}
        onError={onError}
      />
    </div>
  )
}

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
