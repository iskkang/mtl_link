import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRoomStore } from '../stores/roomStore'
import { subscribeToPushNotifications, unsubscribeFromPushNotifications } from '../services/pushNotificationService'
import type { Message } from '../types/chat'

const NOTIF_KEY = 'mtl_notif'

function playNotificationBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)        // A5
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1) // E5
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
  } catch (err) {
    console.warn('[in-app beep] failed:', err)
  }
}

interface Options {
  userId:       string | undefined
  currentRoomId: string | null
  onSelectRoom: (roomId: string) => void
}

export function useGlobalMessageMonitor({ userId, currentRoomId, onSelectRoom }: Options) {
  const { incrementUnread, incrementThreadUnread } = useRoomStore()
  const rooms = useRoomStore(s => s.rooms)

  // Stable refs so the effect closure always reads latest values
  const currentRoomRef = useRef(currentRoomId)
  const roomsRef       = useRef(rooms)
  const userIdRef      = useRef(userId)
  const onSelectRef    = useRef(onSelectRoom)

  useEffect(() => { currentRoomRef.current = currentRoomId  }, [currentRoomId])
  useEffect(() => { roomsRef.current       = rooms          }, [rooms])
  useEffect(() => { userIdRef.current      = userId         }, [userId])
  useEffect(() => { onSelectRef.current    = onSelectRoom   }, [onSelectRoom])

  // ── Notification permission & toggle ───────────────────────
  const [notifEnabled, setNotifEnabled] = useState(
    () => localStorage.getItem(NOTIF_KEY) !== 'off',
  )
  const notifEnabledRef = useRef(notifEnabled)
  useEffect(() => { notifEnabledRef.current = notifEnabled }, [notifEnabled])

  const [showPrompt, setShowPrompt] = useState(false)
  const promptShownRef = useRef(false)

  const toggleNotif = async () => {
    const next = !notifEnabledRef.current
    setNotifEnabled(next)
    notifEnabledRef.current = next
    localStorage.setItem(NOTIF_KEY, next ? 'on' : 'off')

    if (next) {
      if ('Notification' in window && Notification.permission === 'default') {
        const perm = await Notification.requestPermission()
        if (perm === 'granted') {
          subscribeToPushNotifications().catch(() => {})
        }
      } else if (Notification.permission === 'granted') {
        subscribeToPushNotifications().catch(() => {})
      }
    } else {
      unsubscribeFromPushNotifications().catch(() => {})
    }
  }

  const requestPermission = async () => {
    setShowPrompt(false)
    promptShownRef.current = true
    if ('Notification' in window) {
      const perm = await Notification.requestPermission()
      if (perm === 'granted') {
        setNotifEnabled(true)
        notifEnabledRef.current = true
        localStorage.setItem(NOTIF_KEY, 'on')
        subscribeToPushNotifications().catch(() => {})
      }
    }
  }

  const dismissPrompt = () => {
    setShowPrompt(false)
    promptShownRef.current = true
  }

  // ── Dedup: 동일 메시지 ID가 재연결 등으로 두 번 처리되는 것을 방지 ──
  const MAX_PROCESSED = 500
  const processedIds = useRef<Set<string>>(new Set())

  const markProcessed = (id: string): boolean => {
    if (processedIds.current.has(id)) return false
    processedIds.current.add(id)
    // 삽입 순서 보존(Set) — 500개 초과 시 가장 오래된 항목 제거
    if (processedIds.current.size > MAX_PROCESSED) {
      const oldest = processedIds.current.values().next().value
      if (oldest !== undefined) processedIds.current.delete(oldest)
    }
    return true
  }

  // ── Global messages INSERT listener ────────────────────────
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('global:new-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        payload => {
          const msg = payload.new as Message

          // ★ 이미 처리한 메시지 ID면 즉시 스킵 (재연결 dedup, 이중 카운트 방지)
          if (!markProcessed(msg.id)) return

          if (msg.sender_id === userIdRef.current) return // own message
          if (msg.deleted_at) return

          // Safety: only process rooms we know about (RLS guard)
          const room = roomsRef.current.find(r => r.id === msg.room_id)
          if (!room) return

          const isCurrent = msg.room_id === currentRoomRef.current

          // Unread increment for non-current rooms
          if (!isCurrent) {
            incrementUnread(msg.room_id)
          }

          // Permission prompt: show once when first foreign message arrives
          if (!promptShownRef.current && 'Notification' in window && Notification.permission === 'default') {
            setShowPrompt(true)
          }

          // 앱 활성 중 in-app 사운드 + 진동 (OS 배너는 SW가 담당, 여기선 효과만)
          if (document.visibilityState === 'visible') {
            playNotificationBeep()
            if ('vibrate' in navigator) navigator.vibrate(200)
          }

          // OS 알림은 SW push가 전담하므로 new Notification() 호출 제거.
          // (SW push + new Notification() 이중 알림 문제 해결)
          // in-app 업데이트(unread badge, 사이드바 정렬)는 위 로직으로 그대로 처리됨.

          // ── 스레드 답글: 내 메시지에 달린 답글이면 threadUnread 증가 ──
          if (msg.thread_root_id) {
            const rootId = msg.thread_root_id as string
            supabase
              .from('messages')
              .select('sender_id')
              .eq('id', rootId)
              .single()
              .then(({ data: rootMsg }) => {
                if (rootMsg?.sender_id === userIdRef.current) {
                  incrementThreadUnread(rootId)
                }
              })
          }
        },
      )
      .subscribe((_status, err) => {
        if (err) console.error('[GlobalMessageMonitor]', err)
      })

    return () => { channel.unsubscribe() }
  }, [userId, incrementUnread, incrementThreadUnread]) // only re-subscribe when userId changes

  return { notifEnabled, toggleNotif, showPrompt, requestPermission, dismissPrompt }
}
