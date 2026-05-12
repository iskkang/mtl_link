import { useEffect, useRef } from 'react'
import { useRoomStore } from '../stores/roomStore'

const FAVICON_SRC = '/favicon-32x32.png'

export function useDynamicFavicon() {
  const totalUnread = useRoomStore(s =>
    s.rooms.reduce((sum, r) => sum + (r.unread_count ?? 0), 0),
  )
  const originalHref = useRef<string | null>(null)

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>(
      "link[rel='icon'][sizes='32x32']",
    )
    if (!link) return

    if (!originalHref.current) {
      originalHref.current = link.href
    }

    if (totalUnread === 0) {
      link.href = originalHref.current
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width  = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 32, 32)
      // red dot badge — top-right corner
      ctx.beginPath()
      ctx.arc(26, 6, 7, 0, Math.PI * 2)
      ctx.fillStyle = '#EF4444'
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2
      ctx.stroke()
      link.href = canvas.toDataURL('image/png')
    }
    img.src = FAVICON_SRC
  }, [totalUnread])
}
