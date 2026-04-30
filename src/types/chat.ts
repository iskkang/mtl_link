import type { Database } from './database'

export type Profile              = Database['public']['Tables']['profiles']['Row']
export type Room                 = Database['public']['Tables']['rooms']['Row']
export type RoomMember           = Database['public']['Tables']['room_members']['Row']
export type Message              = Database['public']['Tables']['messages']['Row']
export type Attachment           = Database['public']['Tables']['message_attachments']['Row']
export type TranslationPreference = Database['public']['Tables']['translation_preferences']['Row']

/** 메시지 + 발신자 프로필 + 첨부파일 (UI 렌더링용) */
export interface MessageWithSender extends Message {
  sender:     Pick<Profile, 'id' | 'name' | 'avatar_url'> | null
  attachments: Attachment[]
  /** Optimistic UI용 로컬 ID */
  _localId?: string
  /** 전송 상태 */
  _status?:  'sending' | 'sent' | 'failed'
}

/** 방 목록 아이템 (사이드바용) */
export interface RoomListItem extends Room {
  members:      Pick<Profile, 'id' | 'name' | 'avatar_url'>[]
  unread_count: number
  is_pinned:    boolean
  is_muted:     boolean
  last_read_at: string | null
}

/** 지원 언어 코드 */
export type SupportedLanguage = Database['public']['Tables']['profiles']['Row']['preferred_language']

/** 번역 도착어 (none 포함) */
export type TranslationTarget = Database['public']['Tables']['translation_preferences']['Row']['target_language']
