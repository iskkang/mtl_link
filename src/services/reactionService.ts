import { supabase } from '../lib/supabase'

export async function addReaction(messageId: string, roomId: string, emoji: string) {
  const userId = (await supabase.auth.getUser()).data.user?.id
  if (!userId) throw new Error('Not authenticated')
  const { error } = await supabase
    .from('message_reactions')
    .insert({ message_id: messageId, room_id: roomId, user_id: userId, emoji })
  if (error && error.code !== '23505') throw error  // 23505 = unique_violation (already reacted)
}

export async function removeReaction(messageId: string, emoji: string) {
  const { error } = await supabase
    .from('message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('emoji', emoji)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
  if (error) throw error
}

export async function toggleReaction(
  messageId: string,
  roomId: string,
  emoji: string,
  currentUserId: string,
  currentReactions: { emoji: string; user_id: string }[],
) {
  const alreadyReacted = currentReactions.some(
    r => r.emoji === emoji && r.user_id === currentUserId,
  )
  if (alreadyReacted) {
    await removeReaction(messageId, emoji)
  } else {
    await addReaction(messageId, roomId, emoji)
  }
}
