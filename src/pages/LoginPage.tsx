import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sun, Moon, Eye, EyeOff, Ship } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../contexts/ThemeContext'

const schema = z.object({
  email:    z.string().email('올바른 이메일 주소를 입력하세요'),
  password: z.string().min(1, '비밀번호를 입력하세요'),
})
type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const { signIn } = useAuth()
  const { mode, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'

  const [showPassword, setShowPassword] = useState(false)
  const [serverError,  setServerError]  = useState<string | null>(null)

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
      setServerError('이메일 또는 비밀번호가 올바르지 않습니다.')
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${mode === 'dark' ? 'login-bg-dark' : 'login-bg-light'}`}>

      {/* 테마 토글 */}
      <button
        onClick={toggle}
        className="fixed top-4 right-4 p-2 rounded-lg
                   bg-white/70 dark:bg-white/10
                   text-gray-600 dark:text-gray-300
                   hover:bg-white dark:hover:bg-white/20
                   backdrop-blur-sm transition-all duration-200 z-10"
        aria-label="테마 전환"
      >
        {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* 로그인 카드 */}
      <div className="w-full max-w-sm animate-card-in">
        {/* 상단 그라디언트 바 */}
        <div className="card-accent-bar" />

        <div className="bg-white dark:bg-mtl-slate rounded-b-2xl shadow-2xl px-8 py-10">

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
              <Ship size={16} className="text-mtl-cyan" />
              <span className="font-display text-2xl font-bold tracking-wide text-mtl-navy dark:text-mtl-mist">
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
                이메일
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
                비밀번호
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
                         dark:bg-mtl-cyan dark:hover:bg-mtl-cyan/90 dark:text-mtl-ocean
                         disabled:opacity-60 disabled:cursor-not-allowed
                         transition-all duration-200 mt-2"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  로그인 중…
                </span>
              ) : '로그인'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-600">
            계정 문의는 시스템 관리자에게 연락하세요
          </p>
        </div>
      </div>
    </div>
  )
}
