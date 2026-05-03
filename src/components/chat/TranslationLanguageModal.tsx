import { useState } from 'react'
import { Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { TranslationTarget } from '../../types/chat'

const LANGUAGES = [
  { code: 'ko', flagCode: 'KR', name: '한국어',  nativeName: '한국어'    },
  { code: 'ru', flagCode: 'RU', name: '러시아어', nativeName: 'Русский'  },
  { code: 'en', flagCode: 'US', name: '영어',    nativeName: 'English'  },
  { code: 'uz', flagCode: 'UZ', name: '우즈벡어', nativeName: "O'zbek"  },
  { code: 'zh', flagCode: 'CN', name: '중국어',  nativeName: '中文'     },
  { code: 'ja', flagCode: 'JP', name: '일본어',  nativeName: '日本語'   },
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
  toUserName: _toUserName,
  currentLanguage,
  onSaved,
  onClose,
}: Props) {
  const [selected, setSelected] = useState(currentLanguage === 'none' ? 'ko' : currentLanguage)
  const [saving,   setSaving]   = useState(false)

  const handleSelect = async (code: string) => {
    if (code === selected || !toUserId) return
    setSelected(code)
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase
        .from('translation_preferences')
        .upsert(
          { from_user_id: user.id, to_user_id: toUserId, target_language: code as TranslationTarget },
          { onConflict: 'from_user_id,to_user_id' },
        )
      onSaved(code)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative w-[340px] rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-[15px] font-bold mb-1" style={{ color: 'var(--ink)' }}>
            받는 언어 변경
          </h3>
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
            상대방이 어떤 언어로 보내든, 내가 선택한 언어로 번역되어 도착해요.
          </p>
        </div>

        {/* 구분선 */}
        <div style={{ height: '1px', background: 'var(--line)' }} />

        {/* 언어 목록 */}
        <div className="py-1">
          {LANGUAGES.map(lang => {
            const isActive = selected === lang.code
            return (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                disabled={saving}
                className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
                style={{
                  background: isActive ? 'rgba(51,144,236,0.07)' : 'transparent',
                  border: isActive ? '1px solid rgba(51,144,236,0.18)' : '1px solid transparent',
                  borderRadius: isActive ? '10px' : '0',
                  margin: isActive ? '2px 8px' : '0',
                  width: isActive ? 'calc(100% - 16px)' : '100%',
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)'
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
              >
                {/* 국가 코드 */}
                <span
                  className="w-8 text-[11px] font-black font-mono-ui text-center flex-shrink-0"
                  style={{ color: isActive ? 'var(--brand)' : 'var(--ink-3)' }}
                >
                  {lang.flagCode}
                </span>

                {/* 언어 이름 */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                    {lang.name}
                  </p>
                  <p className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--ink-4)' }}>
                    {lang.nativeName}
                  </p>
                </div>

                {/* 체크마크 */}
                {isActive && (
                  <Check size={16} className="flex-shrink-0" style={{ color: 'var(--brand)' }} />
                )}
              </button>
            )
          })}
        </div>

        {/* 구분선 */}
        <div style={{ height: '1px', background: 'var(--line)' }} />

        {/* 닫기 버튼 */}
        <div className="flex justify-end px-5 py-3">
          <button
            onClick={onClose}
            className="px-5 py-2 text-[13px] font-medium rounded-xl transition-colors"
            style={{ color: 'var(--ink-2)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
