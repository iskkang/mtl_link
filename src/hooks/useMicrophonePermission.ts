import { useEffect, useState } from 'react'

export type MicPermissionState = 'unknown' | 'granted' | 'denied' | 'prompt'

export function useMicrophonePermission() {
  const [state, setState] = useState<MicPermissionState>('unknown')

  useEffect(() => {
    if (!navigator.permissions) { setState('prompt'); return }
    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then(s => {
        setState(s.state as MicPermissionState)
        s.onchange = () => setState(s.state as MicPermissionState)
      })
      .catch(() => setState('prompt'))
  }, [])

  const request = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      setState('granted')
      return true
    } catch {
      setState('denied')
      return false
    }
  }

  return { state, request }
}
