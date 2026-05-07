import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface NotificationSettings {
  push_enabled: boolean
  dnd_enabled:  boolean
  dnd_start:    string   // "HH:MM"
  dnd_end:      string   // "HH:MM"
  timezone:     string
  keywords:     string[]
}

const DEFAULTS: NotificationSettings = {
  push_enabled: true,
  dnd_enabled:  false,
  dnd_start:    '22:00',
  dnd_end:      '08:00',
  timezone:     'Asia/Seoul',
  keywords:     [],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export function useNotificationSettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULTS)
  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    let alive = true
    db
      .from('user_notification_settings')
      .select('push_enabled, dnd_enabled, dnd_start, dnd_end, timezone, keywords')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }: { data: Partial<NotificationSettings> | null }) => {
        if (alive && data) {
          setSettings({
            push_enabled: data.push_enabled ?? DEFAULTS.push_enabled,
            dnd_enabled:  data.dnd_enabled  ?? DEFAULTS.dnd_enabled,
            dnd_start:    (data.dnd_start   ?? DEFAULTS.dnd_start).slice(0, 5),
            dnd_end:      (data.dnd_end     ?? DEFAULTS.dnd_end).slice(0, 5),
            timezone:     data.timezone     ?? DEFAULTS.timezone,
            keywords:     data.keywords     ?? [],
          })
        }
        if (alive) setLoading(false)
      })
    return () => { alive = false }
  }, [user])

  // Patch-save: 부분 업데이트 + 즉시 낙관적 반영
  const save = useCallback(async (patch: Partial<NotificationSettings>): Promise<boolean> => {
    if (!user) return false
    const next = { ...settings, ...patch }
    setSettings(next)   // 낙관적 업데이트
    setSaving(true)
    try {
      const { error } = await db
        .from('user_notification_settings')
        .upsert({
          user_id:      user.id,
          push_enabled: next.push_enabled,
          dnd_enabled:  next.dnd_enabled,
          dnd_start:    next.dnd_start,
          dnd_end:      next.dnd_end,
          timezone:     next.timezone,
          keywords:     next.keywords,
          updated_at:   new Date().toISOString(),
        }, { onConflict: 'user_id' })
      if (error) throw error
      return true
    } catch (err) {
      console.error('[useNotificationSettings] save failed:', err)
      setSettings(settings)   // 롤백
      return false
    } finally {
      setSaving(false)
    }
  // settings를 deps에서 제외: 호출 시점의 최신 settings는 next 계산 시 이미 캡처됨
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, settings])

  return { settings, loading, saving, save }
}
