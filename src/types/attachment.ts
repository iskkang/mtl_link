import type { Database } from './database'

export type AttachmentType = Database['public']['Tables']['message_attachments']['Row']['attachment_type']

export interface AttachmentItem {
  id:              string
  message_id:      string
  room_id:         string
  uploaded_by:     string | null
  file_name:       string
  file_path:       string
  file_size:       number
  mime_type:       string
  attachment_type: AttachmentType
  created_at:      string
  uploader: {
    id:         string
    name:       string
    avatar_url: string | null
    avatar_color: string | null
  } | null
}

export type AttachmentFilter = 'all' | AttachmentType

export interface AttachmentFetchOptions {
  roomId?: string
  filter:  AttachmentFilter
  before?: string
  limit?:  number
}
