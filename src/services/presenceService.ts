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

  // status='dnd' 변경 시 알림 차단 자동 연동
  // user_notification_settings is not in generated types → cast to any
  if (status === 'dnd') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: dndErr } = await (supabase as any)
      .from('user_notification_settings')
      .upsert({ user_id: userId, dnd_enabled: true }, { onConflict: 'user_id' })
    if (dndErr) {
      // Non-fatal: DND sync failure doesn't block the status update
      console.warn('[presence] DND sync warning:', dndErr.message)
    }
  }
}
