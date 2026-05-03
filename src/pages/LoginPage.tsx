import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sun, Moon, Eye, EyeOff, Ship, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../contexts/ThemeContext'
import { SUPPORTED_LANGS, saveLanguage, type LangCode } from '../lib/i18n'

export default function LoginPage() {
  const { t, i18n } = useTranslation()
  const { signIn }  = useAuth()
  const { mode, toggle } = useTheme()
  const navigate    = useNavigate()
  const location    = useLocation()
  const from        = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'

  const [showPassword, setShowPassword] = useState(false)
  const [serverError,  setServerError]  = useState<string | null>(null)
  const [langOpen,     setLangOpen]     = useState(false)

  const schema = z.object({
    email:    z.string().email(t('emailInvalid')),
    password: z.string().min(1, t('passwordRequired')),
  })
  type FormValues = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      await signIn(values.email, values.password)
      navigate(from, { replace: true })
    } catch {
      setServerError(t('invalidCreds'))
    }
  }

  const handleLangSelect = (code: LangCode) => {
    i18n.changeLanguage(code)
    saveLanguage(code)
    setLangOpen(false)
  }

  const currentLang = SUPPORTED_LANGS.find(l => l.code === i18n.language) ?? SUPPORTED_LANGS[0]

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${mode === 'dark' ? 'login-bg-dark' : 'login-bg-light'}`}>

      {/* 우측 상단 컨트롤 */}
      <div className="fixed top-4 right-4 flex items-center gap-2 z-10">

        {/* 언어 선택 드롭다운 */}
        <div className="relative">
          <button
            onClick={() => setLangOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm
                       bg-white/70 dark:bg-white/10
                       text-gray-700 dark:text-gray-200
                       hover:bg-white dark:hover:bg-white/20
                       backdrop-blur-sm transition-all duration-200"
          >
            <span>{currentLang.flag}</span>
            <span className="font-medium">{currentLang.label}</span>
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${langOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {langOpen && (
            <>
              {/* 외부 클릭 닫기 */}
              <div className="fixed inset-0" onClick={() => setLangOpen(false)} />
              <div className="absolute right-0 mt-1 w-40 rounded-xl shadow-lg overflow-hidden
                              bg-white dark:bg-mtl-slate
                              border border-gray-100 dark:border-white/10
                              py-1 z-50">
                {SUPPORTED_LANGS.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => handleLangSelect(lang.code)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm text-left transition-colors
                      ${i18n.language === lang.code
                        ? 'bg-mtl-cyan/10 dark:bg-mtl-cyan/20 text-mtl-navy dark:text-mtl-cyan font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                      }`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 테마 토글 */}
        <button
          onClick={toggle}
          className="p-2 rounded-lg
                     bg-white/70 dark:bg-white/10
                     text-gray-600 dark:text-gray-300
                     hover:bg-white dark:hover:bg-white/20
                     backdrop-blur-sm transition-all duration-200"
          aria-label="테마 전환"
        >
          {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* 로그인 카드 */}
      <div className="w-full max-w-sm animate-card-in">
        {/* 상단 그라디언트 바 */}
        <div className="card-accent-bar" />

        <div className="rounded-b-2xl shadow-2xl px-8 py-10" style={{ background: 'var(--card)' }}>

          {/* 로고 + 브랜드 */}
          <div className="flex flex-col items-center mb-8">
            <div className="bg-white rounded-xl p-3 shadow-md mb-4">
              <img
                src="/mtl-logo.png"
                alt="MTL 로고"
                className="h-12 w-auto object-contain"
              />
            </div>

            <div className="flex items-center gap-2 mb-1">
              <Ship size={16} style={{ color: 'var(--brand)' }} />
              <span className="text-2xl font-bold tracking-wide" style={{ color: 'var(--ink)' }}>
                MTL LINK
              </span>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 tracking-widest uppercase">
              Maritime Team Link
            </p>
          </div>

          {/* 폼 */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {/* 이메일 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                {t('email')}
              </label>
              <input
                type="email"
                autoComplete="username"
                className="mtl-input"
                placeholder="your@email.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                {t('password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="mtl-input pr-10"
                  placeholder="••••••••"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  tabIndex={-1}
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* 서버 에러 */}
            {serverError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
                <p className="text-xs text-red-600 dark:text-red-400">{serverError}</p>
              </div>
            )}

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-lg font-semibold text-sm text-white
                         bg-mtl-navy hover:bg-mtl-navy/90
                         disabled:opacity-60 disabled:cursor-not-allowed
                         transition-all duration-200 mt-2"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('submitting')}
                </span>
              ) : t('submit')}
            </button>
          </form>

          {/* 회원가입 */}
          <div className="mt-5 text-center">
            <Link
              to="/signup"
              className="inline-block text-xs font-medium text-mtl-cyan dark:text-brand-500
                         hover:underline transition-colors"
            >
              {t('signupBtn')}
            </Link>
          </div>

          <p className="mt-3 text-center text-xs text-gray-400 dark:text-gray-600">
            {t('contact')}
          </p>
        </div>
      </div>
    </div>
  )
}
