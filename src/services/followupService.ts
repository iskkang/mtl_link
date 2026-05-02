import { supabase } from '../lib/supabase'

export interface PendingFollowup {
  message_id: string
  room_id:    string
  content:    string
  created_at: string
  hours_since: number
  room: {
    id:        string
    name:      string | null
    room_type: string
  }
}

export async function getMyPendingFollowups(): Promise<PendingFollowup[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('messages')
    .select('id, room_id, content, created_at, room:rooms(id, name, room_type)')
    .eq('sender_id', user.id)
    .eq('needs_response', true)
    .eq('response_received', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw error

  const now = Date.now()
  return (data ?? []).map(m => ({
    message_id:  m.id,
    room_id:     m.room_id,
    content:     m.content ?? '',
    created_at:  m.created_at,
    hours_since: Math.floor((now - new Date(m.created_at).getTime()) / 3_600_000),
    room:        m.room as PendingFollowup['room'],
  }))
}

export async function toggleNeedsResponse(messageId: string, value: boolean): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ needs_response: value })
    .eq('id', messageId)
  if (error) throw error
}

export async function markResponseReceived(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ response_received: true })
    .eq('id', messageId)
  if (error) throw error
}
