import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface NotificationSettings {
  dnd_enabled:  boolean
  dnd_start:    string   // "HH:MM"
  dnd_end:      string   // "HH:MM"
  keywords:     string[]
}

const DEFAULTS: NotificationSettings = {
  dnd_enabled: false,
  dnd_start:   '22:00',
  dnd_end:     '07:00',
  keywords:    [],
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
    db
      .from('user_notification_settings')
      .select('dnd_enabled, dnd_start, dnd_end, keywords')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }: { data: NotificationSettings | null }) => {
        if (data) {
          setSettings({
            dnd_enabled: data.dnd_enabled ?? false,
            dnd_start:   data.dnd_start   ?? DEFAULTS.dnd_start,
            dnd_end:     data.dnd_end     ?? DEFAULTS.dnd_end,
            keywords:    data.keywords    ?? [],
          })
        }
        setLoading(false)
      })
  }, [user])

  const save = useCallback(async (next: NotificationSettings): Promise<void> => {
    if (!user) throw new Error('unauthenticated')
    setSaving(true)
    try {
      const { error } = await db
        .from('user_notification_settings')
        .upsert({
          user_id:     user.id,
          dnd_enabled: next.dnd_enabled,
          dnd_start:   next.dnd_start,
          dnd_end:     next.dnd_end,
          keywords:    next.keywords,
        }, { onConflict: 'user_id' })
      if (error) throw error
      setSettings(next)
    } finally {
      setSaving(false)
    }
  }, [user])

  return { settings, loading, saving, save }
}
