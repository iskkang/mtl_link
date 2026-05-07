import type { Database } from './database'

export type Profile              = Database['public']['Tables']['profiles']['Row']
export type Room                 = Database['public']['Tables']['rooms']['Row']
export type RoomMember           = Database['public']['Tables']['room_members']['Row']
export type Message              = Database['public']['Tables']['messages']['Row']
export type Attachment           = Database['public']['Tables']['message_attachments']['Row']
export type TranslationPreference = Database['public']['Tables']['translation_preferences']['Row']

/** 인용 답장 원본 메시지 참조 */
export interface ReplyRef {
  id:           string
  content:      string | null
  message_type: string
  deleted_at:   string | null
  sender:       Pick<Profile, 'id' | 'name'> | null
}

/** 메시지 + 발신자 프로필 + 첨부파일 (UI 렌더링용) */
export interface MessageWithSender extends Message {
  sender:        Pick<Profile, 'id' | 'name' | 'avatar_url' | 'avatar_color' | 'is_bot'> | null
  attachments:   Attachment[]
  reply_message: ReplyRef | null
  /** DB에서 join된 번역 캐시 (message_translations 테이블) */
  translations?: { language: string; translated_text: string }[]
  /** DB에서 join된 이모지 반응 (message_reactions 테이블) */
  reactions?: { emoji: string; user_id: string }[]
  /** Optimistic UI용 로컬 ID */
  _localId?: string
  /** 전송 상태 */
  _status?:  'sending' | 'sent' | 'failed'
  /** 클라이언트 사이드 번역 결과 (검색용) */
  _translatedText?: string | null
}

/** 방 목록 아이템 (사이드바용) */
export interface RoomListItem extends Room {
  members:      (Pick<Profile, 'id' | 'name' | 'avatar_url' | 'avatar_color' | 'preferred_language' | 'is_bot'> & { last_read_at: string | null })[]
  unread_count: number
  is_pinned:    boolean
  is_muted:     boolean
  last_read_at: string | null
}

/** 지원 언어 코드 */
export type SupportedLanguage = Database['public']['Tables']['profiles']['Row']['preferred_language']

/** 번역 도착어 (none 포함) */
export type TranslationTarget = Database['public']['Tables']['translation_preferences']['Row']['target_language']
