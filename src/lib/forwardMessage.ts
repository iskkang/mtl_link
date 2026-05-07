import { supabase } from './supabase'

/**
 * Forward a message to one or more rooms.
 * Attachment rows are re-inserted pointing to the same Storage path (no re-upload).
 * Forward chain is preserved: re-forwarding keeps the original author, not the intermediary.
 */
export async function forwardMessage(
  sourceMessageId: string,
  targetRoomIds:   string[],
): Promise<void> {
  if (targetRoomIds.length === 0) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('인증되지 않았습니다')

  // Fetch source message + sender name
  const { data: src, error: srcErr } = await supabase
    .from('messages')
    .select('*, sender:profiles!sender_id(name)')
    .eq('id', sourceMessageId)
    .single()
  if (srcErr || !src) throw srcErr ?? new Error('메시지를 찾을 수 없습니다')

  // Preserve original author across forward chains
  const senderName = Array.isArray(src.sender)
    ? (src.sender[0]?.name ?? null)
    : (src.sender as { name: string } | null)?.name ?? null

  const fromUserId   = (src.forwarded_from_user_id   ?? src.sender_id) as string
  const fromUserName = (src.forwarded_from_user_name  ?? senderName)   as string | null
  const fromMsgId    = (src.forwarded_from_message_id ?? sourceMessageId) as string

  // Fetch attachments to copy
  const { data: atts } = await supabase
    .from('message_attachments')
    .select('*')
    .eq('message_id', sourceMessageId)

  await Promise.all(
    targetRoomIds.map(async (roomId) => {
      const { data: newMsg, error: msgErr } = await supabase
        .from('messages')
        .insert({
          room_id:                   roomId,
          sender_id:                 user.id,
          message_type:              src.message_type,
          content:                   src.content,
          source_language:           src.source_language,
          forwarded_from_user_id:    fromUserId,
          forwarded_from_user_name:  fromUserName,
          forwarded_from_message_id: fromMsgId,
        })
        .select()
        .single()
      if (msgErr) throw msgErr

      if (atts && atts.length > 0) {
        const attRows = atts.map((a) => ({
          message_id:      newMsg.id,
          room_id:         roomId,
          uploaded_by:     user.id,
          file_name:       a.file_name,
          file_path:       a.file_path,
          file_size:       a.file_size,
          mime_type:       a.mime_type,
          attachment_type: a.attachment_type,
        }))
        const { error: attErr } = await supabase
          .from('message_attachments')
          .insert(attRows)
        if (attErr) throw attErr
      }
    }),
  )
}
