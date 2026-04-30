import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRoomStore } from '../stores/roomStore'
import { getRoomDisplayName } from '../services/roomService'
import type { Message } from '../types/chat'

const NOTIF_KEY = 'mtl_notif'

interface Options {
  userId:       string | undefined
  currentRoomId: string | null
  onSelectRoom: (roomId: string) => void
}

export function useGlobalMessageMonitor({ userId, currentRoomId, onSelectRoom }: Options) {
  const { incrementUnread } = useRoomStore()
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

  const toggleNotif = () => {
    const next = !notifEnabledRef.current
    setNotifEnabled(next)
    notifEnabledRef.current = next
    localStorage.setItem(NOTIF_KEY, next ? 'on' : 'off')
    if (next && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
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
      }
    }
  }

  const dismissPrompt = () => {
    setShowPrompt(false)
    promptShownRef.current = true
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

          // Browser notification
          if (
            !isCurrent &&
            notifEnabledRef.current &&
            'Notification' in window &&
            Notification.permission === 'granted' &&
            !room.is_muted
          ) {
            const sender  = room.members.find(m => m.id === msg.sender_id)
            const title   = sender?.name ?? getRoomDisplayName(room, userIdRef.current ?? '')
            const preview = msg.content?.slice(0, 80) ?? ''

            try {
              const notif = new Notification(title, {
                body: preview || '📎 파일',
                icon: sender?.avatar_url ?? '/mtl-logo.png',
                tag:  msg.room_id,
              } as NotificationOptions)
              notif.onclick = () => {
                window.focus()
                onSelectRef.current(msg.room_id)
                notif.close()
              }
            } catch {
              // Notification may be blocked or unavailable
            }
          }
        },
      )
      .subscribe((_status, err) => {
        if (err) console.error('[GlobalMessageMonitor]', err)
      })

    return () => { channel.unsubscribe() }
  }, [userId, incrementUnread]) // only re-subscribe when userId changes

  return { notifEnabled, toggleNotif, showPrompt, requestPermission, dismissPrompt }
}
