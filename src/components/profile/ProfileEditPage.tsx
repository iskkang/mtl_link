import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Camera, Check, Loader2, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { Avatar } from '../ui/Avatar'
import { SUPPORTED_LANGS, saveLanguage, type LangCode } from '../../lib/i18n'
import { AVATAR_COLORS } from '../../constants/avatarColors'
import { supabase } from '../../lib/supabase'
import { uploadAvatar, deleteAvatar } from '../../services/profileImage'

interface Props {
  open:    boolean
  onClose: () => void
}

export function ProfileEditPage({ open, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const { profile, user, refreshProfile } = useAuth()

  const [name,        setName]        = useState('')
  const [department,  setDepartment]  = useState('')
  const [lang,        setLang]        = useState<LangCode>('en')
  const [avatarColor, setAvatarColor] = useState<string | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [toast,       setToast]       = useState<string | null>(null)
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null | undefined>(undefined)
  const [uploadBusy,  setUploadBusy]  = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile && open) {
      setName(profile.name ?? '')
      setDepartment(profile.department ?? '')
      setLang((profile.preferred_language as LangCode) ?? 'en')
      setAvatarColor(profile.avatar_color ?? null)
      setLocalAvatarUrl(profile.avatar_url ?? null)
      setError(null)
      setUploadError(null)
    }
  }, [profile, open])

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setUploadBusy(true)
    setUploadError(null)
    try {
      const url = await uploadAvatar(user.id, file)
      setLocalAvatarUrl(url)
      await refreshProfile()
      showToast(t('profileSaved'), 1500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('profileImageUploadFailed')
      setUploadError(msg)
    } finally {
      setUploadBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteAvatar = async () => {
    if (!user?.id || !confirm(t('confirmDeleteAvatar'))) return
    setUploadBusy(true)
    setUploadError(null)
    try {
      await deleteAvatar(user.id)
      setLocalAvatarUrl(null)
      await refreshProfile()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('profileImageUploadFailed')
      setUploadError(msg)
    } finally {
      setUploadBusy(false)
    }
  }

  const showToast = (msg: string, duration = 2000) => {
    setToast(msg)
    setTimeout(() => setToast(null), duration)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t('profileNameRequired'))
      return
    }
    if (!user) return

    setSaving(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name:               name.trim(),
          department:         department.trim() || null,
          preferred_language: lang,
          avatar_color:       avatarColor,
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      if (lang !== profile?.preferred_language) {
        await i18n.changeLanguage(lang)
        saveLanguage(lang)
      }

      await refreshProfile()

      showToast(t('profileSaved'), 1200)
      setTimeout(onClose, 1300)
    } catch {
      setError('저장에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const inputCls = 'w-full px-3 py-2.5 rounded-xl text-sm border outline-none transition-colors'

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: 'var(--bg)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-14 flex-shrink-0 border-b"
        style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 text-sm transition-opacity active:opacity-60"
          style={{ color: 'var(--ink-2)' }}
          aria-label="뒤로"
        >
          <ArrowLeft size={18} />
        </button>

        <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          {t('profileEdit')}
        </span>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-sm font-semibold transition-opacity"
          style={{ color: saving ? 'var(--ink-4)' : 'var(--brand)', minWidth: 48 }}
        >
          {saving ? t('profileSaving') : t('profileSave')}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">

        {/* Avatar preview + upload */}
        <div className="flex flex-col items-center gap-4 pt-8 pb-6 px-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarFile}
            className="hidden"
          />
          <div className="relative">
            {profile
              ? <Avatar name={profile.name} avatarUrl={localAvatarUrl ?? undefined} avatarColor={avatarColor} size="xl" />
              : <div className="w-20 h-20 rounded-full" style={{ background: 'var(--line)' }} />
            }
            {uploadBusy ? (
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.45)' }}
              >
                <Loader2 size={20} className="animate-spin" style={{ color: 'white' }} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full
                           flex items-center justify-center shadow-md"
                style={{ background: 'var(--brand)', color: 'white' }}
                aria-label={t('changePhoto')}
              >
                <Camera size={13} />
              </button>
            )}
          </div>

          {/* Upload / Remove buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadBusy}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity"
              style={{ background: 'var(--brand)', color: 'white', opacity: uploadBusy ? 0.5 : 1 }}
            >
              {localAvatarUrl ? t('changePhoto') : t('uploadPhoto')}
            </button>
            {localAvatarUrl && (
              <button
                type="button"
                onClick={handleDeleteAvatar}
                disabled={uploadBusy}
                className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 transition-opacity"
                style={{ color: 'var(--ink-3)', border: '1px solid var(--line)', opacity: uploadBusy ? 0.5 : 1 }}
              >
                <Trash2 size={13} />
                {t('removePhoto')}
              </button>
            )}
          </div>
          {uploadError && (
            <p className="text-xs" style={{ color: 'var(--red)' }}>{uploadError}</p>
          )}</div>

          {/* Color palette */}
          <div className="w-full max-w-xs">
            <p
              className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-center"
              style={{ color: 'var(--ink-4)' }}
            >
              {t('profileAvatarColor')}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {AVATAR_COLORS.map(color => {
                const isSelected = (avatarColor ?? null) === color
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAvatarColor(color)}
                    className="w-8 h-8 rounded-full flex items-center justify-center
                               transition-transform hover:scale-110 focus:outline-none"
                    style={{
                      background:  color,
                      boxShadow:   isSelected ? `0 0 0 3px var(--card), 0 0 0 5px ${color}` : 'none',
                    }}
                    aria-label={color}
                  >
                    {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                  </button>
                )
              })}
            </div>
          </div>

        {/* Form */}
        <div className="px-4 space-y-5 max-w-md mx-auto pb-10">
          {error && (
            <p
              className="text-sm px-3 py-2 rounded-lg"
              style={{ color: 'var(--red)', background: 'rgba(239,63,26,0.08)' }}
            >
              {error}
            </p>
          )}

          <Field label={`${t('profileName')} *`}>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(null) }}
              className={inputCls}
              style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
              onFocus={e  => (e.currentTarget.style.borderColor = 'var(--brand)')}
              onBlur={e   => (e.currentTarget.style.borderColor = 'var(--line)')}
            />
          </Field>

          <Field label={t('profileDepartment')}>
            <input
              type="text"
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className={inputCls}
              style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
              onFocus={e  => (e.currentTarget.style.borderColor = 'var(--brand)')}
              onBlur={e   => (e.currentTarget.style.borderColor = 'var(--line)')}
            />
          </Field>

          <Field label={t('profileLanguage')}>
            <select
              value={lang}
              onChange={e => setLang(e.target.value as LangCode)}
              className={inputCls}
              style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
            >
              {SUPPORTED_LANGS.map(l => (
                <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[210]
                     px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium pointer-events-none"
          style={{ background: '#1f2937' }}
        >
          {toast}
        </div>
      )}
    </div>,
    document.body,
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label
        className="block text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--ink-4)' }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}
