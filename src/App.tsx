import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { AppRoutes } from './routes'
import { InstallBanner } from './components/ui/InstallBanner'
import { UploadProgressWidget } from './components/upload/UploadProgressWidget'

export default function App() {
  useEffect(() => {
    if (window.history.state === null) {
      window.history.replaceState({ root: true }, '')
    }
  }, [])

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <InstallBanner />
        </BrowserRouter>
        <UploadProgressWidget />
      </AuthProvider>
    </ThemeProvider>
  )
}
