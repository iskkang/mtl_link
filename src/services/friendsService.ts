import { supabase } from '../lib/supabase'

export interface FriendProfile {
  id:                 string
  name:               string
  avatar_url:         string | null
  department:         string | null
  position:           string | null
  email:              string
  preferred_language: string | null
}

export async function fetchFriends(): Promise<FriendProfile[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, department, position, email, preferred_language')
    .eq('status', 'active')
    .neq('id', user.id)
    .order('name')

  if (error) throw error
  return (data ?? []) as FriendProfile[]
}
