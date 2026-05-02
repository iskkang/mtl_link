import { useEffect, useRef } from 'react'
import type { ActionItem } from '../services/actionItemService'

const NOTIFIED_KEY = 'mtl_notified_tasks'
const CHECK_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

function getNotified(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function markNotified(id: string) {
  const set = getNotified()
  set.add(id)
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...set]))
}

export function useDueDateNotifications(items: ActionItem[]) {
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => {
    if (Notification.permission !== 'granted') return

    const check = () => {
      const now = Date.now()
      const notified = getNotified()

      for (const item of itemsRef.current) {
        if (!item.due_date) continue
        if (item.status !== 'pending' && item.status !== 'snoozed') continue

        const due = new Date(item.due_date).getTime()
        const diff = due - now

        // Notify if due within 30 minutes and not yet notified
        if (diff > 0 && diff <= 30 * 60 * 1000 && !notified.has(item.id)) {
          const mins = Math.round(diff / 60000)
          new Notification('MTL Link — 할 일 마감 임박', {
            body: `"${item.title}" — ${mins}분 후 마감`,
            icon: '/icons/icon-192x192.png',
          })
          markNotified(item.id)
        }

        // Notify if overdue (past due) and not yet notified
        if (diff <= 0 && !notified.has(`overdue:${item.id}`)) {
          new Notification('MTL Link — 할 일 마감 초과', {
            body: `"${item.title}" 마감일이 지났습니다`,
            icon: '/icons/icon-192x192.png',
          })
          markNotified(`overdue:${item.id}`)
        }
      }
    }

    check()
    const timer = setInterval(check, CHECK_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])
}
