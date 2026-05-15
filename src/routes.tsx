import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './components/layout/ProtectedRoute'

const LoginPage          = lazy(() => import('./pages/LoginPage'))
const SignUpPage         = lazy(() => import('./pages/SignUpPage'))
const PendingPage        = lazy(() => import('./pages/PendingPage'))
const RejectedPage       = lazy(() => import('./pages/RejectedPage'))
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'))
const ChatPage           = lazy(() => import('./pages/ChatPage'))
const AdminPage          = lazy(() => import('./pages/AdminPage'))
const InstallPage        = lazy(() => import('./pages/InstallPage'))
const ActionItemsPage    = lazy(() => import('./pages/ActionItemsPage'))

const PageFallback = (
  <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-mtl-ocean">
    <div className="spinner" />
  </div>
)

export function AppRoutes() {
  return (
    <Suspense fallback={PageFallback}>
      <Routes>
        <Route path="/install"  element={<InstallPage />} />
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/signup"   element={<SignUpPage />} />
        <Route path="/pending"  element={<PendingPage />} />
        <Route path="/rejected" element={<RejectedPage />} />
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
        <Route path="/tasks" element={
          <ProtectedRoute>
            <ActionItemsPage />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
