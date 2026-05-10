import { useCallback } from 'react'
import { useAuth } from './useAuth'
import { updatePresenceStatus } from '../services/presenceService'
import type { Database } from '../types/database'

type PresenceStatus = Database['public']['Tables']['profiles']['Row']['presence_status']

export function useUserStatus() {
  const { profile, user, refreshProfile } = useAuth()

  const status: PresenceStatus =
    (profile?.presence_status as PresenceStatus | undefined | null) ?? 'offline'
  const statusMessage = profile?.status_message ?? null

  const setStatus = useCallback(
    async (newStatus: PresenceStatus, newMessage?: string | null) => {
      if (!user?.id) return
      await updatePresenceStatus(user.id, newStatus, newMessage)
      await refreshProfile()
    },
    [user?.id, refreshProfile],
  )

  return { status, statusMessage, setStatus }
}
