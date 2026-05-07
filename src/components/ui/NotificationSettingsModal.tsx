import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNotificationSettings } from '../../hooks/useNotificationSettings'
import type { NotificationSettings } from '../../hooks/useNotificationSettings'

const MAX_KEYWORDS = 10

interface Props {
  onClose: () => void
}

export function NotificationSettingsModal({ onClose }: Props) {
  const { t } = useTranslation()
  const { settings, loading, saving, save } = useNotificationSettings()

  const [draft, setDraft]         = useState<NotificationSettings | null>(null)
  const [kwInput, setKwInput]     = useState('')
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null)
  const toastRef                  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef                  = useRef<HTMLInputElement>(null)
  const onCloseRef                = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  // Initialise draft once settings load
  useEffect(() => {
    if (!loading && draft === null) setDraft(settings)
  }, [loading, settings, draft])

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

  function showToast(msg: string, ok: boolean) {
    if (toastRef.current) clearTimeout(toastRef.current)
    setToast({ msg, ok })
    toastRef.current = setTimeout(() => setToast(null), 2500)
  }

  async function handleSave() {
    if (!draft) return
    try {
      await save(draft)
      showToast(t('notifSaved'), true)
    } catch {
      showToast(t('notifSaveFailed'), false)
    }
  }

  function addKeyword() {
    const kw = kwInput.trim()
    if (!kw || !draft) return
    if (draft.keywords.length >= MAX_KEYWORDS) {
      showToast(t('notifKeywordsLimit'), false)
      return
    }
    if (!draft.keywords.includes(kw)) {
      setDraft({ ...draft, keywords: [...draft.keywords, kw] })
    }
    setKwInput('')
    inputRef.current?.focus()
  }

  function removeKeyword(kw: string) {
    if (!draft) return
    setDraft({ ...draft, keywords: draft.keywords.filter(k => k !== kw) })
  }

  if (loading || !draft) return null

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
          background:  'var(--card)',
          boxShadow:   'var(--shadow-lg)',
          maxHeight:   '85dvh',
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
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('notifDnd')}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{t('notifDndDesc')}</p>
              </div>
              {/* Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={draft.dnd_enabled}
                onClick={() => setDraft({ ...draft, dnd_enabled: !draft.dnd_enabled })}
                className="flex-shrink-0 w-10 h-6 rounded-full transition-colors relative mt-0.5"
                style={{ background: draft.dnd_enabled ? 'var(--brand)' : 'var(--line)' }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                  style={{ transform: draft.dnd_enabled ? 'translateX(16px)' : 'translateX(0)' }}
                />
              </button>
            </div>

            {draft.dnd_enabled && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs mb-1" style={{ color: 'var(--ink-3)' }}>
                    {t('notifDndStart')}
                  </label>
                  <input
                    type="time"
                    value={draft.dnd_start}
                    onChange={e => setDraft({ ...draft, dnd_start: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{
                      background:   'var(--bg)',
                      borderColor:  'var(--line)',
                      color:        'var(--ink)',
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
                    value={draft.dnd_end}
                    onChange={e => setDraft({ ...draft, dnd_end: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{
                      background:   'var(--bg)',
                      borderColor:  'var(--line)',
                      color:        'var(--ink)',
                    }}
                  />
                </div>
              </div>
            )}
          </section>

          <div className="border-t" style={{ borderColor: 'var(--line)' }} />

          {/* Keywords section */}
          <section>
            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('notifKeywords')}</p>
            <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--ink-3)' }}>{t('notifKeywordsDesc')}</p>

            {/* Input row */}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={kwInput}
                onChange={e => setKwInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
                placeholder={t('notifKeywordsPlaceholder')}
                maxLength={30}
                className="flex-1 px-3 py-2 rounded-lg border text-sm"
                style={{
                  background:  'var(--bg)',
                  borderColor: 'var(--line)',
                  color:       'var(--ink)',
                }}
              />
              <button
                type="button"
                onClick={addKeyword}
                disabled={!kwInput.trim() || draft.keywords.length >= MAX_KEYWORDS}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--brand)', color: '#fff' }}
              >
                <Plus size={14} />
                {t('notifKeywordsAdd')}
              </button>
            </div>

            {/* Chips */}
            {draft.keywords.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {draft.keywords.map(kw => (
                  <span
                    key={kw}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: 'var(--blue-soft)', color: 'var(--ink)' }}
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() => removeKeyword(kw)}
                      className="flex items-center"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {draft.keywords.length >= MAX_KEYWORDS && (
              <p className="text-xs mt-2" style={{ color: 'var(--ink-3)' }}>
                {t('notifKeywordsLimit')}
              </p>
            )}
          </section>
        </div>

        {/* Footer */}
        <div
          className="flex-shrink-0 px-4 py-3 border-t"
          style={{ borderColor: 'var(--line)', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60"
            style={{ background: 'var(--brand)', color: '#fff' }}
          >
            {saving ? '…' : t('msgEditSave')}
          </button>
        </div>

        {/* In-modal toast */}
        {toast && (
          <div
            className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap"
            style={{
              background: toast.ok ? '#22c55e' : 'var(--red)',
              color:      '#fff',
              boxShadow:  'var(--shadow-lg)',
            }}
          >
            {toast.msg}
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}
