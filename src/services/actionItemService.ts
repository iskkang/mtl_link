import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type ActionItem = Database['public']['Tables']['action_items']['Row'] & {
  creator?:  { id: string; name: string; avatar_url: string | null; avatar_color: string | null } | null
  assignee?: { id: string; name: string; avatar_url: string | null; avatar_color: string | null } | null
}

const ACTION_ITEM_SELECT = `
  *,
  creator:profiles!action_items_created_by_fkey(id, name, avatar_url, avatar_color),
  assignee:profiles!action_items_assigned_to_fkey(id, name, avatar_url, avatar_color)
`

export async function createActionItem(params: {
  message_id:  string | null
  room_id:     string
  assigned_to: string
  title:       string
  due_date?:   string | null
}): Promise<ActionItem> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('action_items')
    .insert({
      message_id:  params.message_id,
      room_id:     params.room_id,
      created_by:  user.id,
      assigned_to: params.assigned_to,
      title:       params.title,
      due_date:    params.due_date ?? null,
    })
    .select(ACTION_ITEM_SELECT)
    .single()

  if (error) throw error
  return data as ActionItem
}

export async function getMyActionItems(): Promise<ActionItem[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('action_items')
    .select(ACTION_ITEM_SELECT)
    .eq('assigned_to', user.id)
    .not('status', 'in', '("done","cancelled")')
    .order('due_date', { ascending: true, nullsFirst: false })

  if (error) throw error
  return (data ?? []) as ActionItem[]
}

export async function getCreatedActionItems(): Promise<ActionItem[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('action_items')
    .select(ACTION_ITEM_SELECT)
    .eq('created_by', user.id)
    .not('status', 'in', '("done","cancelled")')
    .order('due_date', { ascending: true, nullsFirst: false })

  if (error) throw error
  return (data ?? []) as ActionItem[]
}

export async function getDoneActionItems(): Promise<ActionItem[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('action_items')
    .select(ACTION_ITEM_SELECT)
    .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
    .eq('status', 'done')
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) throw error
  return (data ?? []) as ActionItem[]
}

export async function completeActionItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('action_items')
    .update({ status: 'done' })
    .eq('id', id)

  if (error) throw error
}

export async function cancelActionItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('action_items')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (error) throw error
}

export async function snoozeActionItem(id: string, until: string): Promise<void> {
  const { error } = await supabase
    .from('action_items')
    .update({ status: 'snoozed', snoozed_until: until })
    .eq('id', id)

  if (error) throw error
}
