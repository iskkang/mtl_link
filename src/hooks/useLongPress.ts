import { useRef, useCallback } from 'react'

interface Options {
  delay?:         number
  moveThreshold?: number
  onLongPress:    () => void
}

/**
 * Pointer-event based long-press hook for mobile touch devices.
 * Ignores mouse pointers so desktop hover actions are unaffected.
 */
export function useLongPress({ delay = 500, moveThreshold = 10, onLongPress }: Options) {
  const timer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPos = useRef<{ x: number; y: number } | null>(null)

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    startPos.current = null
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    startPos.current = { x: e.clientX, y: e.clientY }
    timer.current = setTimeout(() => {
      onLongPress()
      try { navigator.vibrate(10) } catch { /* unsupported */ }
    }, delay)
  }, [delay, onLongPress])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!startPos.current) return
    const dx = Math.abs(e.clientX - startPos.current.x)
    const dy = Math.abs(e.clientY - startPos.current.y)
    if (dx > moveThreshold || dy > moveThreshold) cancel()
  }, [moveThreshold, cancel])

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp:     cancel,
    onPointerCancel: cancel,
  }
}
