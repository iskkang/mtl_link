import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import { AlertTriangle } from 'lucide-react'
import { SUPPORTED_LANGS, saveLanguage, type LangCode } from '../lib/i18n'
import { useTheme } from '../contexts/ThemeContext'

const isKakaoTalk = /KAKAOTALK/i.test(navigator.userAgent)

export default function InstallPage() {
  const { t, i18n } = useTranslation()
  const { mode } = useTheme()
  const [tab, setTab] = useState<'android' | 'ios'>('android')

  const installUrl = `${window.location.origin}/install`

  const changeLang = (code: LangCode) => {
    i18n.changeLanguage(code)
    saveLanguage(code)
  }

  const androidSteps = [t('installAndStep1'), t('installAndStep2'), t('installAndStep3')]
  const iosSteps     = [t('installIosStep1'), t('installIosStep2'), t('installIosStep3')]
  const steps        = tab === 'android' ? androidSteps : iosSteps

  const stepIcons: Record<'android' | 'ios', string[]> = {
    android: ['⋮', '＋', '↓'],
    ios:     ['⬆', '＋', '✓'],
  }

  return (
    <div className={`min-h-screen flex flex-col ${mode === 'dark' ? 'login-bg-dark dark' : 'login-bg-light'}`}>

      {/* ── 언어 선택 ─────────────────────────────────── */}
      <div className="flex justify-center flex-wrap gap-1.5 pt-4 pb-2 px-4">
        {SUPPORTED_LANGS.map(lang => {
          const active = i18n.language === lang.code
          return (
            <button
              key={lang.code}
              onClick={() => changeLang(lang.code)}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
              style={active
                ? { background: 'var(--blue)', color: '#fff' }
                : { background: 'var(--card)', color: 'var(--ink-3)', border: '1px solid var(--line)' }
              }
            >
              {lang.flag} {lang.label}
            </button>
          )
        })}
      </div>

      {/* ── 카드 ──────────────────────────────────────── */}
      <div className="flex-1 flex items-start justify-center px-4 py-4 pb-8">
        <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-xl" style={{ background: 'var(--card)' }}>
          <div className="card-accent-bar" />

          {/* 헤더 */}
          <div className="px-6 pt-6 pb-4 text-center">
            <img src="/icons/icon-192x192.png" alt="MTL Link" className="w-16 h-16 rounded-2xl mx-auto mb-3 shadow-md" />
            <h1 className="text-xl font-bold" style={{ color: 'var(--ink)' }}>{t('installTitle')}</h1>
          </div>

          {/* ── 카카오톡 경고 ──────────────────────────── */}
          <div
            className="mx-6 mb-5 rounded-xl p-3.5"
            style={{
              background: isKakaoTalk ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
              border: `1px solid ${isKakaoTalk ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
            }}
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle
                size={15}
                className="flex-shrink-0 mt-0.5"
                style={{ color: isKakaoTalk ? 'var(--red)' : '#D97706' }}
              />
              <div>
                <p className="text-sm font-semibold" style={{ color: isKakaoTalk ? 'var(--red)' : '#92400E', opacity: mode === 'dark' ? 1 : undefined }}>
                  {t('installKakaoTitle')}
                </p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                  {t('installKakaoDesc')}
                </p>
              </div>
            </div>
          </div>

          {/* ── 플랫폼 탭 ──────────────────────────────── */}
          <div className="mx-6 mb-4 flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--line)' }}>
            {(['android', 'ios'] as const).map(p => (
              <button
                key={p}
                onClick={() => setTab(p)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors"
                style={tab === p
                  ? { background: 'var(--blue)', color: '#fff' }
                  : { color: 'var(--ink-3)' }
                }
              >
                {p === 'android' ? '🤖' : '🍎'}
                {p === 'android' ? t('installAndroid') : t('installIphone')}
              </button>
            ))}
          </div>

          {/* ── 단계 카드 ──────────────────────────────── */}
          <div className="px-6 pb-5 space-y-2.5">
            {steps.map((step, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3.5 rounded-xl"
                style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
              >
                {/* 번호 + 아이콘 */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: 'var(--blue)' }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-base leading-none" style={{ color: 'var(--ink-4)' }}>
                    {stepIcons[tab][i]}
                  </span>
                </div>
                <p className="text-sm leading-relaxed pt-1" style={{ color: 'var(--ink)' }}>
                  {step}
                </p>
              </div>
            ))}
          </div>

          {/* ── QR 코드 ────────────────────────────────── */}
          <div className="mx-6 mb-5">
            <div
              className="rounded-xl p-4 text-center"
              style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
            >
              <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--ink)' }}>
                {t('installQrTitle')}
              </p>
              <p className="text-xs mb-3" style={{ color: 'var(--ink-4)' }}>
                {t('installQrDesc')}
              </p>
              <div className="flex justify-center">
                <div className="p-2.5 rounded-xl bg-white inline-block shadow-sm">
                  <QRCodeSVG
                    value={installUrl}
                    size={148}
                    bgColor="#ffffff"
                    fgColor="#1A2238"
                    level="M"
                  />
                </div>
              </div>
              <p className="text-[11px] mt-2.5 font-mono break-all" style={{ color: 'var(--ink-4)' }}>
                {installUrl}
              </p>
            </div>
          </div>

          {/* ── 앱으로 이동 ────────────────────────────── */}
          <div className="px-6 pb-7 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--blue)' }}
            >
              {t('installGoApp')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
