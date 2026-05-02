import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('install-banner-dismissed') === 'true') return
    // Already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') console.log('[PWA] install accepted')
    setDeferredPrompt(null)
    setShow(false)
  }

  const handleDismiss = () => {
    localStorage.setItem('install-banner-dismissed', 'true')
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 rounded-xl p-4 flex items-center gap-3 shadow-xl"
      style={{ background: 'var(--card)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-lg)' }}
    >
      <img src="/icons/icon-72x72.png" alt="MTL Link" className="w-12 h-12 rounded-xl flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>MTL Link 앱 설치</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>홈 화면에 추가하여 앱처럼 사용하세요</p>
      </div>
      <button
        onClick={handleInstall}
        className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white flex-shrink-0"
        style={{ background: 'var(--blue)' }}
      >
        설치
      </button>
      <button
        onClick={handleDismiss}
        className="p-1 flex-shrink-0"
        style={{ color: 'var(--ink-4)' }}
        aria-label="닫기"
      >
        <X size={16} />
      </button>
    </div>
  )
}
