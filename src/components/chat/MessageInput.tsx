import { useState, useRef, useCallback, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getUserFriendlyMessage } from '../../lib/errors'

interface Props {
  value:            string
  onChange:         (v: string) => void
  onSend:           (content: string) => Promise<void>
  disabled?:        boolean
  hasPendingFiles?: boolean
  targetLanguage?:  string | null
  roomName?:        string
}

const MAX_LEN = 4000
const WARN_AT = 3500

const LANG_KO: Record<string, string> = {
  ko: '한국어', en: '영어', ru: '러시아어', zh: '중국어', ja: '일본어', uz: '우즈벡어',
}

export function MessageInput({ value, onChange, onSend, disabled, hasPendingFiles, targetLanguage }: Props) {
  const { t } = useTranslation()
  const [sending,   setSending]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 텍스트가 있거나, 첨부 파일이 선택된 경우 전송 가능
  const canSend = (value.trim().length > 0 || !!hasPendingFiles) &&
                  !sending && !disabled && value.length <= MAX_LEN

  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [])

  const handleSend = async () => {
    if (!canSend) return
    const content = value.trim()
    onChange('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.focus()
    }
    setSending(true)
    setError(null)
    try {
      await onSend(content)
    } catch (err) {
      setError(getUserFriendlyMessage(err))
      if (content) onChange(content) // 텍스트 실패 시 복원 (파일만 있는 경우엔 복원 불필요)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const remaining = MAX_LEN - value.length
  const activeTranslation = targetLanguage && targetLanguage !== 'none'
  const myLangName = activeTranslation ? (LANG_KO[targetLanguage!] ?? targetLanguage!.toUpperCase()) : null

  return (
    <div
      className="composer-panel flex-shrink-0 px-3 pt-2 border-t"
      style={{ background: 'var(--card)', borderColor: 'var(--line)', boxShadow: 'var(--shadow-panel)', paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      {error && (
        <div className="mb-2 px-3 py-1.5 rounded-lg text-xs"
             style={{ background: 'rgba(239,63,26,0.08)', color: 'var(--red)', border: '1px solid rgba(239,63,26,0.2)' }}>
          {error}
        </div>
      )}

      <div
        className="flex items-end gap-2 rounded-2xl border px-3 py-1.5"
        style={{ background: 'var(--bg)', borderColor: 'var(--line)' }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          disabled={disabled || sending}
          placeholder={
            hasPendingFiles
              ? '캡션 입력... (선택)'
              : disabled
                ? t('selectRoomHint')
                : t('msgPlaceholder')
          }
          rows={1}
          maxLength={MAX_LEN + 100}
          className="flex-1 resize-none bg-transparent text-sm leading-relaxed py-1.5
                     focus:outline-none disabled:cursor-not-allowed disabled:opacity-50
                     transition-all scrollbar-thin"
          style={{
            maxHeight: '120px',
            color: 'var(--ink)',
            caretColor: 'var(--blue)',
          }}
          onChange={e => { onChange(e.target.value); autoResize() }}
          onKeyDown={handleKeyDown}
        />
        {value.length >= WARN_AT && (
          <span
            className="text-[10px] pb-1.5 flex-shrink-0"
            style={{ color: remaining < 0 ? 'var(--red)' : 'var(--ink-4)' }}
          >
            {remaining}
          </span>
        )}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                     text-white disabled:opacity-30 disabled:cursor-not-allowed
                     transition-all duration-200"
          style={{ background: canSend ? 'var(--blue)' : 'var(--ink-4)' }}
          aria-label={t('attachBtn')}
        >
          {sending
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Send size={15} className="translate-x-0.5" />
          }
        </button>
      </div>

      {/* 키보드 힌트 */}
      <div className="flex items-center justify-between mt-1.5 px-1">
        <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>
          <kbd className="font-mono-ui">Enter</kbd>
          <span className="mx-1" style={{ color: 'var(--ink-4)' }}>전송 ·</span>
          <kbd className="font-mono-ui">Shift</kbd>
          <span className="mx-0.5">+</span>
          <kbd className="font-mono-ui">Enter</kbd>
          <span className="ml-1">줄바꿈</span>
        </p>
        {myLangName && (
          <p className="text-[10px] text-right" style={{ color: 'var(--ink-4)' }}>
            ✦ {myLangName}로 입력하면 상대방의 언어로 자동 번역됩니다
          </p>
        )}
      </div>
    </div>
  )
}
