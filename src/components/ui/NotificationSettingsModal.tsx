import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNotificationSettings } from '../../hooks/useNotificationSettings'

const MAX_KEYWORDS = 20

interface Props {
  onClose: () => void
}

export function NotificationSettingsModal({ onClose }: Props) {
  const { t } = useTranslation()
  const { settings, loading, saving, save } = useNotificationSettings()

  const [kwInput, setKwInput]   = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const errorTimer              = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef                = useRef<HTMLInputElement>(null)
  const onCloseRef              = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  // PWA back-button
  useEffect(() => {
    history.pushState({ notifModal: true }, '')
    const handler = () => onCloseRef.current()
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  function showError(msg: string) {
    if (errorTimer.current) clearTimeout(errorTimer.current)
    setErrorMsg(msg)
    errorTimer.current = setTimeout(() => setErrorMsg(null), 2500)
  }

  function addKeywords() {
    const input = kwInput.trim()
    if (!input) return

    // 쉼표 구분 입력 지원
    const incoming = input
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    const merged = Array.from(new Set([...settings.keywords, ...incoming]))
    if (merged.length > MAX_KEYWORDS) {
      showError(t('notifKeywordsLimit'))
      return
    }

    save({ keywords: merged })
    setKwInput('')
    inputRef.current?.focus()
  }

  function removeKeyword(kw: string) {
    save({ keywords: settings.keywords.filter(k => k !== kw) })
  }

  if (loading) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed z-[61] inset-x-4 bottom-4 rounded-2xl flex flex-col
                   md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:top-1/2 md:-translate-y-1/2
                   md:w-[440px] md:bottom-auto"
        style={{
          background: 'var(--card)',
          boxShadow:  'var(--shadow-lg)',
          maxHeight:  '85dvh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3.5 border-b flex-shrink-0"
          style={{ borderColor: 'var(--line)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            {t('notifSettings')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg transition-colors"
            style={{ color: 'var(--ink-3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

          {/* DND section */}
          <section>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                  {t('notifDnd')}
                </p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                  {t('notifDndDesc')}
                </p>
              </div>
              {/* Toggle — auto-saves on click */}
              <button
                type="button"
                role="switch"
                aria-checked={settings.dnd_enabled}
                onClick={() => save({ dnd_enabled: !settings.dnd_enabled })}
                disabled={saving}
                className="flex-shrink-0 w-10 h-6 rounded-full transition-colors relative mt-0.5"
                style={{ background: settings.dnd_enabled ? 'var(--brand)' : 'var(--line)' }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                  style={{ transform: settings.dnd_enabled ? 'translateX(16px)' : 'translateX(0)' }}
                />
              </button>
            </div>

            {settings.dnd_enabled && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs mb-1" style={{ color: 'var(--ink-3)' }}>
                    {t('notifDndStart')}
                  </label>
                  <input
                    type="time"
                    value={settings.dnd_start}
                    onChange={e => save({ dnd_start: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{
                      background:  'var(--bg)',
                      borderColor: 'var(--line)',
                      color:       'var(--ink)',
                    }}
                  />
                </div>
                <span className="mt-4 text-sm" style={{ color: 'var(--ink-3)' }}>–</span>
                <div className="flex-1">
                  <label className="block text-xs mb-1" style={{ color: 'var(--ink-3)' }}>
                    {t('notifDndEnd')}
                  </label>
                  <input
                    type="time"
                    value={settings.dnd_end}
                    onChange={e => save({ dnd_end: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{
                      background:  'var(--bg)',
                      borderColor: 'var(--line)',
                      color:       'var(--ink)',
                    }}
                  />
                </div>
              </div>
            )}
          </section>

          <div className="border-t" style={{ borderColor: 'var(--line)' }} />

          {/* Keywords section */}
          <section>
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                {t('notifKeywords')}
              </p>
              <span className="text-xs" style={{ color: 'var(--ink-3)' }}>
                {settings.keywords.length} / {MAX_KEYWORDS}
              </span>
            </div>
            <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--ink-3)' }}>
              {t('notifKeywordsDesc')}
            </p>

            {/* Input row */}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={kwInput}
                onChange={e => setKwInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeywords() } }}
                placeholder={t('notifKeywordsPlaceholder')}
                maxLength={100}
                disabled={settings.keywords.length >= MAX_KEYWORDS}
                className="flex-1 px-3 py-2 rounded-lg border text-sm"
                style={{
                  background:  'var(--bg)',
                  borderColor: 'var(--line)',
                  color:       'var(--ink)',
                }}
              />
              <button
                type="button"
                onClick={addKeywords}
                disabled={saving || !kwInput.trim() || settings.keywords.length >= MAX_KEYWORDS}
                className="px-3 py-2 rounded-lg text-sm font-medium transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--brand)', color: '#fff' }}
              >
                {t('notifKeywordsAdd')}
              </button>
            </div>

            {/* Error message */}
            {errorMsg && (
              <p className="mt-1.5 text-xs" style={{ color: 'var(--red)' }}>
                {errorMsg}
              </p>
            )}

            {/* Chips */}
            {settings.keywords.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {settings.keywords.map(kw => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs font-medium"
                    style={{ background: 'var(--blue-soft)', color: 'var(--ink)' }}
                  >
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => removeKeyword(kw)}
                      disabled={saving}
                      aria-label={t('notifKeywordsRemove')}
                      className="flex items-center p-0.5 rounded-full transition-colors
                                 disabled:opacity-40"
                      style={{ color: 'var(--ink-3)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.1)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Saving indicator */}
        {saving && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs"
            style={{ background: 'var(--card)', boxShadow: 'var(--shadow-lg)', color: 'var(--ink-3)' }}
          >
            {t('notifSaved')}…
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}
