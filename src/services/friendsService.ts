import { supabase, getSessionUser } from '../lib/supabase'

export interface FriendProfile {
  id:                 string
  name:               string
  avatar_url:         string | null
  avatar_color:       string | null
  department:         string | null
  position:           string | null
  email:              string
  preferred_language: string | null
  is_bot:             boolean | null
  presence_status:    string | null
  status_message:     string | null
}

export async function fetchFriends(): Promise<FriendProfile[]> {
  const user = await getSessionUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, avatar_color, department, position, email, preferred_language, is_bot, presence_status, status_message')
    .eq('status', 'active')
    .is('deactivated_at', null)
    .neq('id', user.id)
    .order('name')

  if (error) throw error
  return (data ?? []) as FriendProfile[]
}
