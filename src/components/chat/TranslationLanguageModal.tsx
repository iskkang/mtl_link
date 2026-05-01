import { useState } from 'react'
import { X, Globe } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { TranslationTarget } from '../../types/chat'

const LANGUAGES = [
  { code: 'ko',   name: '한국어',    flag: '🇰🇷' },
  { code: 'en',   name: 'English',   flag: '🇺🇸' },
  { code: 'ru',   name: 'Русский',   flag: '🇷🇺' },
  { code: 'zh',   name: '中文',      flag: '🇨🇳' },
  { code: 'ja',   name: '日本語',    flag: '🇯🇵' },
  { code: 'uz',   name: "O'zbek",   flag: '🇺🇿' },
  { code: 'none', name: '번역 안 함', flag: '🚫' },
]

interface Props {
  toUserId:        string | null
  toUserName:      string
  currentLanguage: string
  onSaved:         (lang: string) => void
  onClose:         () => void
}

export function TranslationLanguageModal({
  toUserId,
  toUserName,
  currentLanguage,
  onSaved,
  onClose,
}: Props) {
  const [selected, setSelected] = useState(currentLanguage || 'none')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const handleSave = async () => {
    if (!toUserId) return
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('인증되지 않았습니다')

      const { error: upsertError } = await supabase
        .from('translation_preferences')
        .upsert(
          { from_user_id: user.id, to_user_id: toUserId, target_language: selected as TranslationTarget },
          { onConflict: 'from_user_id,to_user_id' },
        )
      if (upsertError) throw upsertError

      onSaved(selected)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-80 rounded-2xl shadow-2xl border p-5"
        style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Globe size={16} style={{ color: 'var(--blue)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {toUserName}에게 번역 언어
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors"
            style={{ color: 'var(--ink-4)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            aria-label="닫기"
          >
            <X size={15} />
          </button>
        </div>

        {/* 언어 목록 */}
        <div className="space-y-0.5 mb-4">
          {LANGUAGES.map(l => {
            const isSelected = selected === l.code
            return (
              <label
                key={l.code}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors"
                style={{
                  background: isSelected ? 'rgba(37,99,235,0.08)' : 'transparent',
                  color: isSelected ? 'var(--ink)' : 'var(--ink-2)',
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLLabelElement).style.background = 'var(--bg)' }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLLabelElement).style.background = 'transparent' }}
              >
                <input
                  type="radio"
                  name="lang"
                  value={l.code}
                  checked={isSelected}
                  onChange={e => setSelected(e.target.value)}
                  className="sr-only"
                />
                <span className="text-base leading-none">{l.flag}</span>
                <span className="text-sm font-medium">{l.name}</span>
                {isSelected && (
                  <span
                    className="ml-auto w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--blue)' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  </span>
                )}
              </label>
            )
          })}
        </div>

        {error && <p className="mb-3 text-xs text-red-500">{error}</p>}

        {/* 버튼 */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl transition-colors"
            style={{ color: 'var(--ink-3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !toUserId}
            className="px-4 py-2 text-sm rounded-xl font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ background: 'var(--blue)' }}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
