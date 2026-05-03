import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { SUPPORTED_LANGS, saveLanguage, type LangCode } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'

interface Props {
  onClose: () => void
}

export function LanguagePickerModal({ onClose }: Props) {
  const { i18n } = useTranslation()
  const { user } = useAuth()

  const handleSelect = async (code: LangCode) => {
    await i18n.changeLanguage(code)
    saveLanguage(code)
    if (user) {
      supabase.from('profiles').update({ preferred_language: code }).eq('id', user.id).then(() => {})
    }
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-72 rounded-2xl overflow-hidden shadow-xl border"
        style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--line)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            언어 / Language
          </p>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg transition-colors"
            style={{ color: 'var(--ink-4)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-0.5 p-2">
          {SUPPORTED_LANGS.map(lang => {
            const isActive = i18n.language.startsWith(lang.code)
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang.code)}
                className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] transition-colors"
                style={{
                  background: isActive ? 'rgba(51,144,236,0.10)' : 'transparent',
                  color:      isActive ? 'var(--brand)'          : 'var(--ink-3)',
                  fontWeight: isActive ? 600                     : 400,
                  border:     isActive ? '1px solid rgba(51,144,236,0.25)' : '1px solid transparent',
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)'
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
              >
                <span className="text-base leading-none">{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
