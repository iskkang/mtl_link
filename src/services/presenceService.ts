import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type PresenceStatus = Database['public']['Tables']['profiles']['Row']['presence_status']
type ProfileUpdate  = Database['public']['Tables']['profiles']['Update']

export async function updatePresenceStatus(
  userId: string,
  status: PresenceStatus,
  statusMessage?: string | null,
): Promise<void> {
  const update: ProfileUpdate = { presence_status: status }
  if (statusMessage !== undefined) update.status_message = statusMessage
  const { error } = await supabase.from('profiles').update(update).eq('id', userId)
  if (error) throw error
}
