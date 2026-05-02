import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { AppRoutes } from './routes'
import { InstallBanner } from './components/ui/InstallBanner'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <InstallBanner />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
