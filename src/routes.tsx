import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './components/layout/ProtectedRoute'

const LoginPage          = lazy(() => import('./pages/LoginPage'))
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'))
const ChatPage           = lazy(() => import('./pages/ChatPage'))
const AdminPage          = lazy(() => import('./pages/AdminPage'))

const PageFallback = (
  <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-mtl-ocean">
    <div className="spinner" />
  </div>
)

export function AppRoutes() {
  return (
    <Suspense fallback={PageFallback}>
      <Routes>
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/change-password" element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        } />
        <Route path="/" element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute adminOnly>
            <AdminPage />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
