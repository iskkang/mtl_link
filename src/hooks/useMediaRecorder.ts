import { useCallback, useRef, useState } from 'react'

const MAX_MS = 60_000

export type RecordingState = 'idle' | 'recording' | 'processing'

/**
 * onBlob: 녹음이 끝날 때마다 호출 (사용자 정지 or 60초 자동 정지)
 */
export function useMediaRecorder(onBlob: (blob: Blob) => void) {
  const [recState,  setRecState]  = useState<RecordingState>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)

  // 항상 최신 콜백을 참조하기 위한 ref
  const onBlobRef = useRef(onBlob)
  onBlobRef.current = onBlob

  const mrRef       = useRef<MediaRecorder | null>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const tickRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startMsRef  = useRef(0)

  const clearTimers = () => {
    if (tickRef.current)     { clearInterval(tickRef.current);  tickRef.current     = null }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null }
  }

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  // 공통 정지 로직 — useCallback([]) 으로 stable ref 보장
  const stopRecording = useCallback(() => {
    clearTimers()
    const mr = mrRef.current
    if (!mr || mr.state === 'inactive') {
      setRecState('idle')
      setElapsedMs(0)
      return
    }
    setRecState('processing')
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
      mrRef.current     = null
      chunksRef.current = []
      releaseStream()
      setRecState('idle')
      setElapsedMs(0)
      onBlobRef.current(blob)
    }
    mr.stop()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(async (): Promise<boolean> => {
    if (mrRef.current) return false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')           ? 'audio/webm'
        : ''

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      mrRef.current     = mr
      startMsRef.current = Date.now()

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start(250)

      setRecState('recording')
      setElapsedMs(0)

      tickRef.current     = setInterval(() => setElapsedMs(Date.now() - startMsRef.current), 100)
      autoStopRef.current = setTimeout(stopRecording, MAX_MS)

      return true
    } catch {
      releaseStream()
      return false
    }
  }, [stopRecording])

  const cancel = useCallback(() => {
    clearTimers()
    const mr = mrRef.current
    if (mr && mr.state !== 'inactive') {
      mr.onstop = null
      mr.stop()
    }
    mrRef.current     = null
    chunksRef.current = []
    releaseStream()
    setRecState('idle')
    setElapsedMs(0)
  }, [])

  return { recState, elapsedMs, start, stop: stopRecording, cancel }
}
