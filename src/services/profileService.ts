import { supabase } from '../lib/supabase'
import type { Profile } from '../types/chat'

export async function fetchActiveProfiles(excludeId?: string): Promise<Profile[]> {
  let query = supabase
    .from('profiles')
    .select('*')
    .eq('status', 'active')
    .order('name')

  if (excludeId) query = query.neq('id', excludeId)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}
