import { useState, useRef, useCallback, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getUserFriendlyMessage } from '../../lib/errors'

interface Props {
  value:     string
  onChange:  (v: string) => void
  onSend:    (content: string) => Promise<void>
  disabled?: boolean
}

const MAX_LEN = 4000
const WARN_AT = 3500

export function MessageInput({ value, onChange, onSend, disabled }: Props) {
  const { t } = useTranslation()
  const [sending,   setSending]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canSend = value.trim().length > 0 && !sending && !disabled && value.length <= MAX_LEN

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
      onChange(content) // 실패 시 복원
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

  return (
    <div className="flex-shrink-0 px-3 py-2
                    bg-[#f9f9f9] dark:bg-surface-panel
                    border-t border-gray-200 dark:border-[#374045]">

      {/* 에러 */}
      {error && (
        <div className="mb-2 px-3 py-1.5 rounded-lg
                        bg-red-50 dark:bg-red-900/20
                        text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* 입력창 */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            disabled={disabled || sending}
            placeholder={disabled ? t('selectRoomHint') : t('msgPlaceholder')}
            rows={1}
            maxLength={MAX_LEN + 100}
            className="
              w-full resize-none rounded-2xl px-4 py-2.5 text-sm leading-relaxed
              bg-white dark:bg-surface-input
              border border-gray-200 dark:border-0
              text-gray-800 dark:text-[#e9edef]
              placeholder-gray-400 dark:placeholder-[#8696a0]
              focus:outline-none focus:ring-2 focus:ring-mtl-cyan/30 dark:focus:ring-accent/30
              disabled:cursor-not-allowed disabled:opacity-50
              transition-all scrollbar-thin
            "
            style={{ maxHeight: '120px' }}
            onChange={e => { onChange(e.target.value); autoResize() }}
            onKeyDown={handleKeyDown}
          />
          {/* 글자 수 경고 */}
          {value.length >= WARN_AT && (
            <span className={`absolute bottom-2 right-3 text-[10px] ${
              remaining < 0 ? 'text-red-500' : 'text-gray-400 dark:text-[#8696a0]'
            }`}>
              {remaining}
            </span>
          )}
        </div>

        {/* 전송 버튼 */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="
            w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
            bg-accent hover:bg-accent-hover
            text-white
            disabled:opacity-30 disabled:cursor-not-allowed
            transition-all duration-200
          "
          aria-label={t('attachBtn')}
        >
          {sending
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Send size={16} className="translate-x-0.5" />
          }
        </button>
      </div>
    </div>
  )
}
