import { supabase } from '../lib/supabase'
import type { AttachmentItem, AttachmentFetchOptions } from '../types/attachment'

const ATTACH_SELECT = `
  id, message_id, room_id, uploaded_by, file_name, file_path,
  file_size, mime_type, attachment_type, created_at,
  uploader:profiles!message_attachments_uploaded_by_fkey(id, name, avatar_url, avatar_color)
` as const

export async function fetchRoomAttachments(opts: AttachmentFetchOptions): Promise<AttachmentItem[]> {
  const { roomId, filter, before, limit = 40 } = opts

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase.from('message_attachments') as any)
    .select(ATTACH_SELECT)
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (filter !== 'all') q = q.eq('attachment_type', filter)
  if (before)           q = q.lt('created_at', before)

  const { data, error } = await q
  if (error) throw error

  return (data ?? []) as AttachmentItem[]
}

export async function fetchAllAttachments(opts: AttachmentFetchOptions): Promise<AttachmentItem[]> {
  const allItems: AttachmentItem[] = []
  let cursor: string | undefined

  while (true) {
    const page = await fetchRoomAttachments({ ...opts, before: cursor })
    allItems.push(...page)
    if (page.length < (opts.limit ?? 40)) break
    cursor = page[page.length - 1].created_at
  }

  return allItems
}
