import { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { subscribeToPushNotifications } from '../../services/pushNotificationService'

const DISMISSED_KEY = 'mtl_notif_perm_dismissed_at'
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000 // 24시간

export function NotificationPermissionCard() {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    if (Notification.permission !== 'default') {
      setShow(false)
      return
    }

    const dismissedAt = localStorage.getItem(DISMISSED_KEY)
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10)
      if (elapsed < DISMISS_DURATION_MS) {
        setShow(false)
        return
      }
    }

    setShow(true)
  }, [])

  const handleAllow = async () => {
    setRequesting(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        await subscribeToPushNotifications().catch((err) => {
          console.error('[NotifPermCard] 구독 실패:', err)
        })
      }
      setShow(false)
      localStorage.removeItem(DISMISSED_KEY)
    } finally {
      setRequesting(false)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString())
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      className="mx-3 my-3 p-3 rounded-xl border"
      style={{ borderColor: 'var(--brand)', background: 'var(--blue-soft)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 p-2 rounded-full text-white"
          style={{ background: 'var(--brand)' }}
        >
          <Bell size={16} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
            {t('notifPermTitle')}
          </h3>
          <p className="text-xs mt-1 leading-snug" style={{ color: 'var(--ink-3)' }}>
            {t('notifPermDesc')}
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAllow}
              disabled={requesting}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-white
                         disabled:opacity-50 transition-opacity"
              style={{ background: 'var(--brand)' }}
            >
              {requesting ? '…' : t('notifPermAllow')}
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
              style={{ color: 'var(--ink-2)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.4)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {t('notifPermLater')}
            </button>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          aria-label={t('notifPermLater')}
          className="flex-shrink-0 p-1 rounded transition-colors"
          style={{ color: 'var(--ink-3)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
