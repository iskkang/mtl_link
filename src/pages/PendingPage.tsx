import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, LogOut, Ship } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function PendingPage() {
  const { t } = useTranslation()
  const { user, profile, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true })
    if (!loading && profile?.status === 'active') navigate('/', { replace: true })
  }, [loading, user, profile, navigate])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-mtl-ocean">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-mtl-ocean">
      <div className="w-full max-w-sm text-center">
        <div className="card-accent-bar" />
        <div className="bg-white dark:bg-mtl-slate rounded-b-2xl shadow-2xl px-8 py-12">

          {/* 아이콘 */}
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-5">
            <Clock size={28} className="text-amber-500 dark:text-amber-400" />
          </div>

          {/* 타이틀 */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <Ship size={14} className="text-mtl-cyan" />
            <span className="font-display text-base font-bold tracking-wide text-mtl-navy dark:text-mtl-mist">
              MTL LINK
            </span>
          </div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-mtl-mist mb-3">
            {t('pendingTitle')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-line leading-relaxed mb-2">
            {t('pendingDesc')}
          </p>
          {profile && (
            <p className="text-xs text-gray-400 dark:text-gray-600 mb-8">
              {profile.email}
            </p>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium
                       border border-gray-200 dark:border-[#374045]
                       text-gray-600 dark:text-gray-400
                       hover:bg-gray-50 dark:hover:bg-white/5
                       transition-colors"
          >
            <LogOut size={15} />
            {t('pendingLogout')}
          </button>
        </div>
      </div>
    </div>
  )
}
