import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react'
import { Send, MessageCircleQuestion } from 'lucide-react'
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
  isRequest?:       boolean
  onToggleRequest?: () => void
  placeholder?:     string
  autoFocus?:       boolean
}

const MAX_LEN = 4000
const WARN_AT = 3500

export function MessageInput({ value, onChange, onSend, disabled, hasPendingFiles, targetLanguage, isRequest, onToggleRequest, placeholder, autoFocus }: Props) {
  const { t } = useTranslation()
  const [sending,   setSending]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus])

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
        {/* 요청 토글 버튼 */}
        {onToggleRequest && (
          <button
            type="button"
            onClick={onToggleRequest}
            title={isRequest ? t('inputRequestActive') : t('inputMarkAsRequest')}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full transition-colors"
            style={isRequest
              ? { color: '#CA8A04', background: 'rgba(234,179,8,0.15)' }
              : { color: 'var(--ink-4)', background: 'transparent' }
            }
            onMouseEnter={e => { if (!isRequest) (e.currentTarget.style.background = 'var(--bg-hover)') }}
            onMouseLeave={e => { if (!isRequest) (e.currentTarget.style.background = 'transparent') }}
          >
            <MessageCircleQuestion size={16} />
          </button>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          disabled={disabled || sending}
          placeholder={
            hasPendingFiles
              ? t('captionPlaceholder')
              : disabled
                ? t('selectRoomHint')
                : (placeholder ?? t('msgPlaceholder'))
          }
          rows={1}
          maxLength={MAX_LEN + 100}
          className="flex-1 resize-none bg-transparent text-sm leading-relaxed py-1.5
                     focus:outline-none disabled:cursor-not-allowed disabled:opacity-50
                     transition-all scrollbar-thin"
          style={{
            maxHeight: '120px',
            color: 'var(--ink)',
            caretColor: 'var(--brand)',
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
          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
                      text-white transition-all duration-200 disabled:cursor-not-allowed
                      ${canSend ? 'bg-brand-500 shadow-fab' : 'bg-brand-500/40 dark:bg-brand-500/30'}`}
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
          <span className="mx-1" style={{ color: 'var(--ink-4)' }}>{t('kbdSend')} ·</span>
          <kbd className="font-mono-ui">Shift</kbd>
          <span className="mx-0.5">+</span>
          <kbd className="font-mono-ui">Enter</kbd>
          <span className="ml-1">{t('kbdNewline')}</span>
        </p>
        {activeTranslation && (
          <p className="text-[10px] text-right" style={{ color: 'var(--ink-4)' }}>
            {t('autoTranslateHint')}
          </p>
        )}
      </div>
    </div>
  )
}
