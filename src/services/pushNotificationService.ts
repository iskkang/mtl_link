import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  // new Uint8Array(n) returns Uint8Array<ArrayBuffer> — PushManager 타입 요구사항 충족
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY
}

export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  console.log('[Push] subscribeToPushNotifications() called')
  console.log('[Push] VAPID key length:', VAPID_PUBLIC_KEY?.length ?? 'MISSING')

  if (!isPushSupported()) {
    console.warn('[Push] Not supported (SW/PushManager/VAPID missing)')
    return null
  }
  if (Notification.permission !== 'granted') {
    console.warn('[Push] Permission not granted:', Notification.permission)
    return null
  }

  try {
    const registration = await navigator.serviceWorker.ready
    console.log('[Push] SW ready, scope:', registration.scope)

    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      console.log('[Push] No existing subscription, creating new...')
      // Uint8Array 직접 전달 (ArrayBuffer 불가 — Chrome 요구사항)
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      })
      console.log('[Push] Subscribed:', subscription.endpoint.slice(0, 60) + '...')
    } else {
      console.log('[Push] Reusing existing subscription')
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.warn('[Push] No authenticated user')
      return null
    }

    const json = subscription.toJSON() as {
      endpoint: string
      keys: { p256dh: string; auth: string }
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      { user_id: user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
      { onConflict: 'user_id,endpoint' },
    )
    if (error) {
      console.error('[Push] DB upsert error:', error)
    } else {
      console.log('[Push] Subscription saved to DB ✓')
    }

    return subscription
  } catch (err) {
    console.error('[Push] subscribe failed:', err)
    return null
  }
}

export async function unsubscribeFromPushNotifications(): Promise<void> {
  if (!isPushSupported()) return

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return

    await subscription.unsubscribe()
    console.log('[Push] Unsubscribed from browser')

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', subscription.endpoint)
      console.log('[Push] Subscription removed from DB')
    }
  } catch (err) {
    console.warn('[Push] unsubscribe failed:', err)
  }
}
