import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Ship, Sun, Moon, Eye, EyeOff, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import { SUPPORTED_LANGS, saveLanguage, type LangCode } from '../lib/i18n'

const DEPT_OPTIONS = ['HQ', 'UZ', 'RU', 'JP', 'CN', 'KG', 'VN', 'OTHER']

export default function SignUpPage() {
  const { t, i18n } = useTranslation()
  const { mode, toggle } = useTheme()

  const [showPassword, setShowPassword] = useState(false)
  const [serverError,  setServerError]  = useState<string | null>(null)
  const [done,         setDone]         = useState(false)
  const [langOpen,     setLangOpen]     = useState(false)

  const schema = z.object({
    email:              z.string().email(t('emailInvalid')),
    password:           z.string().min(8, t('pwMinLength')),
    name:               z.string().min(1, t('nameRequired')),
    department:         z.string().min(1, t('deptRequired')),
    position:           z.string().optional(),
    preferred_language: z.string().optional(),
  })
  type FormValues = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { preferred_language: i18n.language },
  })

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      const { data, error } = await supabase.auth.signUp({
        email:    values.email,
        password: values.password,
        options: {
          data: {
            name:               values.name,
            department:         values.department,
            position:           values.position ?? '',
            preferred_language: values.preferred_language ?? i18n.language,
          },
        },
      })
      if (error) {
        if (error.message.toLowerCase().includes('already registered')) {
          throw new Error(t('signupEmailExists'))
        }
        throw error
      }

      // 관리자에게 가입 알림 이메일 발송 (fire-and-forget)
      supabase.functions.invoke('send-signup-notification', {
        body: {
          userId:     data.user?.id,
          name:       values.name,
          email:      values.email,
          department: values.department,
        },
      }).catch(() => {})

      setDone(true)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : t('signupError'))
    }
  }

  const handleLangSelect = (code: LangCode) => {
    i18n.changeLanguage(code)
    saveLanguage(code)
    setLangOpen(false)
  }

  const currentLang = SUPPORTED_LANGS.find(l => l.code === i18n.language) ?? SUPPORTED_LANGS[0]

  if (done) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${mode === 'dark' ? 'login-bg-dark' : 'login-bg-light'}`}>
        <div className="w-full max-w-sm animate-card-in text-center">
          <div className="card-accent-bar" />
          <div className="bg-white dark:bg-mtl-slate rounded-b-2xl shadow-2xl px-8 py-12">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-5">
              <span className="text-3xl">✓</span>
            </div>
            <p className="text-sm font-medium text-gray-800 dark:text-mtl-mist whitespace-pre-line leading-relaxed mb-6">
              {t('signupSuccess')}
            </p>
            <Link
              to="/login"
              className="inline-block w-full py-2.5 rounded-lg font-semibold text-sm text-white
                         bg-mtl-navy hover:bg-mtl-navy/90
                         dark:bg-mtl-cyan dark:hover:bg-mtl-cyan/90 dark:text-mtl-ocean
                         transition-all duration-200 text-center"
            >
              {t('backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${mode === 'dark' ? 'login-bg-dark' : 'login-bg-light'}`}>

      {/* 우측 상단 컨트롤 */}
      <div className="fixed top-4 right-4 flex items-center gap-2 z-10">
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
            <ChevronDown size={14} className={`transition-transform duration-200 ${langOpen ? 'rotate-180' : ''}`} />
          </button>
          {langOpen && (
            <>
              <div className="fixed inset-0" onClick={() => setLangOpen(false)} />
              <div className="absolute right-0 mt-1 w-40 rounded-xl shadow-lg overflow-hidden
                              bg-white dark:bg-mtl-slate border border-gray-100 dark:border-white/10 py-1 z-50">
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
                    <span>{lang.flag}</span><span>{lang.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button
          onClick={toggle}
          className="p-2 rounded-lg bg-white/70 dark:bg-white/10 text-gray-600 dark:text-gray-300
                     hover:bg-white dark:hover:bg-white/20 backdrop-blur-sm transition-all duration-200"
          aria-label={t('themeToggle')}
        >
          {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* 카드 */}
      <div className="w-full max-w-sm animate-card-in">
        <div className="card-accent-bar" />
        <div className="bg-white dark:bg-mtl-slate rounded-b-2xl shadow-2xl px-8 py-8">

          {/* 로고 */}
          <div className="flex flex-col items-center mb-6">
            <div className="bg-white rounded-xl p-3 shadow-md mb-3">
              <img src="/mtl-logo.png" alt="MTL 로고" className="h-10 w-auto object-contain" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <Ship size={15} className="text-mtl-cyan" />
              <span className="font-display text-xl font-bold tracking-wide text-mtl-navy dark:text-mtl-mist">
                MTL LINK
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('signupTitle')}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3.5">

            {/* 이메일 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                {t('email')} *
              </label>
              <input type="email" autoComplete="username" className="mtl-input" placeholder="your@email.com" {...register('email')} />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                {t('password')} *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="mtl-input pr-10"
                  placeholder="••••••••"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            {/* 이름 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                {t('name')} *
              </label>
              <input type="text" className="mtl-input" placeholder="Hong Gil-dong" {...register('name')} />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
            </div>

            {/* 소속 / 직급 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5 uppercase tracking-wider">
                  {t('department')} *
                </label>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1.5">{t('deptHelp')}</p>
                <select className="mtl-input" {...register('department')}>
                  <option value="">—</option>
                  {DEPT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {errors.department && <p className="mt-1 text-xs text-red-500">{errors.department.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                  {t('position')}
                </label>
                <input type="text" className="mtl-input" placeholder="Manager" {...register('position')} />
              </div>
            </div>

            {/* 선호 언어 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5 uppercase tracking-wider">
                {t('preferredLang')} *
              </label>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1.5">{t('langHelp')}</p>
              <select className="mtl-input" {...register('preferred_language')}>
                {SUPPORTED_LANGS.map(l => (
                  <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
                ))}
              </select>
            </div>

            {/* 서버 에러 */}
            {serverError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
                <p className="text-xs text-red-600 dark:text-red-400">{serverError}</p>
              </div>
            )}

            {/* 제출 */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-lg font-semibold text-sm text-white
                         bg-mtl-navy hover:bg-mtl-navy/90
                         dark:bg-mtl-cyan dark:hover:bg-mtl-cyan/90 dark:text-mtl-ocean
                         disabled:opacity-60 disabled:cursor-not-allowed
                         transition-all duration-200 mt-1"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('signupSubmitting')}
                </span>
              ) : t('signupSubmit')}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-gray-400 dark:text-gray-600">
            <Link to="/login" className="underline hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
              {t('backToLogin')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
