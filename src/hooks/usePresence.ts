import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function usePresence() {
  const { user } = useAuth()
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return

    const channel = supabase.channel('presence:global', {
      config: { presence: { key: user.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnlineIds(new Set(Object.keys(state)))
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id:   user.id,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  return { onlineIds }
}
