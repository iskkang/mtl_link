import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'

interface Props {
  children: ReactNode
  adminOnly?: boolean
}

export function ProtectedRoute({ children, adminOnly = false }: Props) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-mtl-ocean">
        <div className="spinner" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 가입 승인 대기 / 거절
  if (profile?.status === 'pending')  return <Navigate to="/pending"  replace />
  if (profile?.status === 'rejected') return <Navigate to="/rejected" replace />

  // 최초 로그인 후 비밀번호 변경 강제
  if (profile?.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  if (adminOnly && !profile?.is_admin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
