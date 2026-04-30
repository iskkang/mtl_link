import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../contexts/ThemeContext'

type FormValues = { password: string; confirm: string }

export default function ChangePasswordPage() {
  const { t } = useTranslation()
  const { user, refreshProfile } = useAuth()
  const { mode } = useTheme()
  const navigate = useNavigate()
  const [showPw,      setShowPw]      = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const schema = useMemo(() =>
    z.object({
      password: z
        .string()
        .min(8, t('errMin8'))
        .regex(/[A-Z]/, t('errUpper'))
        .regex(/[a-z]/, t('errLower'))
        .regex(/[0-9]/, t('errNumber'))
        .regex(/[^A-Za-z0-9]/, t('errSpecial')),
      confirm: z.string(),
    }).refine(d => d.password === d.confirm, {
      message: t('changePwMismatch'),
      path: ['confirm'],
    }),
  [t])

  const REQUIREMENTS = useMemo(() => [
    { label: t('reqMin8'),    test: (v: string) => v.length >= 8 },
    { label: t('reqUpper'),   test: (v: string) => /[A-Z]/.test(v) },
    { label: t('reqLower'),   test: (v: string) => /[a-z]/.test(v) },
    { label: t('reqNumber'),  test: (v: string) => /[0-9]/.test(v) },
    { label: t('reqSpecial'), test: (v: string) => /[^A-Za-z0-9]/.test(v) },
  ], [t])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const passwordValue = watch('password', '')

  const onSubmit = async (values: FormValues) => {
    if (!user) return
    setServerError(null)
    try {
      const { error: authError } = await supabase.auth.updateUser({ password: values.password })
      if (authError) throw authError

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', user.id)
      if (profileError) throw profileError

      await refreshProfile()
      navigate('/', { replace: true })
    } catch (err) {
      setServerError(err instanceof Error ? err.message : t('changePwError'))
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${mode === 'dark' ? 'login-bg-dark' : 'login-bg-light'}`}>
      <div className="w-full max-w-sm animate-card-in">
        <div className="card-accent-bar" />

        <div className="bg-white dark:bg-mtl-slate rounded-b-2xl shadow-2xl px-8 py-10">

          {/* 헤더 */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-full bg-mtl-cyan/10 dark:bg-mtl-cyan/20 flex items-center justify-center mb-4">
              <ShieldCheck size={24} className="text-mtl-cyan" />
            </div>
            <h1 className="font-display text-2xl font-bold text-mtl-navy dark:text-mtl-mist tracking-wide">
              {t('changePwTitle')}
            </h1>
            <p className="mt-2 text-xs text-center text-gray-400 dark:text-gray-500 leading-relaxed">
              {t('changePwSubtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {/* 새 비밀번호 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                {t('changePwNew')}
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="mtl-input pr-10"
                  placeholder={t('changePwNew')}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  tabIndex={-1}
                  aria-label={showPw ? t('changePwNew') : t('changePwNew')}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* 비밀번호 요구사항 체크리스트 */}
            {passwordValue.length > 0 && (
              <ul className="rounded-lg bg-gray-50 dark:bg-mtl-ocean/50 border border-gray-100 dark:border-gray-700/50 px-4 py-3 space-y-1.5">
                {REQUIREMENTS.map(req => {
                  const ok = req.test(passwordValue)
                  return (
                    <li key={req.label} className={`flex items-center gap-2 text-xs transition-colors ${ok ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-600'}`}>
                      <span className={`inline-block w-3.5 h-3.5 rounded-full border flex-shrink-0 transition-all ${ok ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 dark:border-gray-600'}`} />
                      {req.label}
                    </li>
                  )
                })}
              </ul>
            )}

            {/* 비밀번호 확인 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                {t('changePwConfirm')}
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="mtl-input pr-10"
                  placeholder={t('changePwConfirm')}
                  {...register('confirm')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(p => !p)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  tabIndex={-1}
                  aria-label={t('changePwConfirm')}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirm && (
                <p className="mt-1 text-xs text-red-500">{errors.confirm.message}</p>
              )}
            </div>

            {/* 서버 에러 */}
            {serverError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
                <p className="text-xs text-red-600 dark:text-red-400">{serverError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-lg font-semibold text-sm text-white
                         bg-mtl-navy hover:bg-mtl-navy/90
                         dark:bg-mtl-cyan dark:hover:bg-mtl-cyan/90 dark:text-mtl-ocean
                         disabled:opacity-60 disabled:cursor-not-allowed
                         transition-all duration-200 mt-2"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('changePwSubmitting')}
                </span>
              ) : t('changePwSubmit')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
