import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGS, saveLanguage, type LangCode } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const current =
    SUPPORTED_LANGS.find(l => i18n.language.startsWith(l.code)) ?? SUPPORTED_LANGS[0]

  const handleSelect = async (code: LangCode) => {
    setOpen(false)
    await i18n.changeLanguage(code)
    saveLanguage(code)
    if (user) {
      supabase
        .from('profiles')
        .update({ preferred_language: code })
        .eq('id', user.id)
        .then(() => {})
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-1.5 py-1.5 rounded-lg transition-colors"
        style={{ color: 'var(--side-mute)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        title={current.label}
        aria-label={current.label}
      >
        <span className="text-[17px] leading-none">{current.flag}</span>
      </button>

      {open && (
        <div
          className="absolute bottom-full right-0 mb-2 z-50 rounded-xl shadow-xl py-1 min-w-[140px] border"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--line)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {SUPPORTED_LANGS.map(lang => {
            const isActive = i18n.language.startsWith(lang.code)
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang.code)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors"
                style={{
                  color: isActive ? 'var(--blue)' : 'var(--ink)',
                  background: isActive ? 'rgba(37,99,235,0.05)' : 'transparent',
                  fontWeight: isActive ? 600 : 400,
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
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: 'var(--blue)' }} />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
