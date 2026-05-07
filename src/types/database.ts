/**
 * 수동 작성 타입 — 마이그레이션 스키마 기반
 * Supabase 프로젝트 연결 후 아래 명령어로 자동 생성 타입으로 교체하세요:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type SupportedLanguage = 'ko' | 'en' | 'ru' | 'zh' | 'ja' | 'uz'
export type TranslationTarget  = SupportedLanguage | 'none'

export type Database = {
  public: {
    Tables: {
      // ─── profiles ───────────────────────────────────────────────────────────
      profiles: {
        Row: {
          id:                   string
          email:                string
          name:                 string
          department:           string | null
          position:             string | null
          avatar_url:           string | null
          status:               'active' | 'inactive' | 'pending' | 'rejected'
          is_admin:             boolean
          is_bot:               boolean
          must_change_password: boolean
          preferred_language:   SupportedLanguage
          created_at:           string
          updated_at:           string
        }
        Insert: {
          id:                    string
          email:                 string
          name:                  string
          department?:           string | null
          position?:             string | null
          avatar_url?:           string | null
          status?:               'active' | 'inactive' | 'pending' | 'rejected'
          is_admin?:             boolean
          is_bot?:               boolean
          must_change_password?: boolean
          preferred_language?:   SupportedLanguage
          created_at?:           string
          updated_at?:           string
        }
        Update: {
          id?:                   string
          email?:                string
          name?:                 string
          department?:           string | null
          position?:             string | null
          avatar_url?:           string | null
          status?:               'active' | 'inactive' | 'pending' | 'rejected'
          is_admin?:             boolean
          is_bot?:               boolean
          must_change_password?: boolean
          preferred_language?:   SupportedLanguage
          created_at?:           string
          updated_at?:           string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }

      // ─── rooms ──────────────────────────────────────────────────────────────
      rooms: {
        Row: {
          id:                           string
          room_type:                    'direct' | 'group' | 'channel'
          name:                         string | null
          created_by:                   string | null
          last_message:                 string | null
          last_message_at:              string | null
          default_translation_language: SupportedLanguage | null
          slug:                         string | null
          description:                  string | null
          is_announcement:              boolean
          is_private:                   boolean
          is_default:                   boolean
          created_at:                   string
          updated_at:                   string
        }
        Insert: {
          id?:                           string
          room_type:                     'direct' | 'group' | 'channel'
          name?:                         string | null
          created_by?:                   string | null
          last_message?:                 string | null
          last_message_at?:              string | null
          default_translation_language?: SupportedLanguage | null
          slug?:                         string | null
          description?:                  string | null
          is_announcement?:              boolean
          is_private?:                   boolean
          is_default?:                   boolean
          created_at?:                   string
          updated_at?:                   string
        }
        Update: {
          id?:                           string
          room_type?:                    'direct' | 'group' | 'channel'
          name?:                         string | null
          created_by?:                   string | null
          last_message?:                 string | null
          last_message_at?:              string | null
          default_translation_language?: SupportedLanguage | null
          slug?:                         string | null
          description?:                  string | null
          is_announcement?:              boolean
          is_private?:                   boolean
          is_default?:                   boolean
          created_at?:                   string
          updated_at?:                   string
        }
        Relationships: [
          {
            foreignKeyName: 'rooms_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      // ─── room_members ────────────────────────────────────────────────────────
      room_members: {
        Row: {
          id:           string
          room_id:      string
          user_id:      string
          role:         'owner' | 'admin' | 'member'
          joined_at:    string
          last_read_at: string | null
          is_muted:     boolean
          is_pinned:    boolean
        }
        Insert: {
          id?:           string
          room_id:       string
          user_id:       string
          role?:         'owner' | 'admin' | 'member'
          joined_at?:    string
          last_read_at?: string | null
          is_muted?:     boolean
          is_pinned?:    boolean
        }
        Update: {
          id?:           string
          room_id?:      string
          user_id?:      string
          role?:         'owner' | 'admin' | 'member'
          joined_at?:    string
          last_read_at?: string | null
          is_muted?:     boolean
          is_pinned?:    boolean
        }
        Relationships: [
          {
            foreignKeyName: 'room_members_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'room_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      // ─── messages ────────────────────────────────────────────────────────────
      messages: {
        Row: {
          id:                   string
          room_id:              string
          sender_id:            string | null
          message_type:         'text' | 'image' | 'file' | 'link' | 'system' | 'voice_translated' | 'text_translated'
          content:              string | null
          content_original:     string | null
          source_language:      SupportedLanguage | null
          target_language:      SupportedLanguage | null
          translation_provider: 'claude' | 'openai' | 'google' | 'deepl' | null
          reply_to_id:          string | null
          thread_root_id:       string | null
          thread_reply_count:   number
          mentions:             string[]
          created_at:           string
          edited_at:            string | null
          deleted_at:           string | null
          needs_response:       boolean
          response_received:    boolean
          followup_reminded_at: string | null
        }
        Insert: {
          id?:                   string
          room_id:               string
          sender_id?:            string | null
          message_type?:         'text' | 'image' | 'file' | 'link' | 'system' | 'voice_translated' | 'text_translated'
          content?:              string | null
          content_original?:     string | null
          source_language?:      SupportedLanguage | null
          target_language?:      SupportedLanguage | null
          translation_provider?: 'claude' | 'openai' | 'google' | 'deepl' | null
          reply_to_id?:          string | null
          thread_root_id?:       string | null
          thread_reply_count?:   number
          mentions?:             string[]
          created_at?:           string
          edited_at?:            string | null
          deleted_at?:           string | null
          needs_response?:       boolean
          response_received?:    boolean
          followup_reminded_at?: string | null
        }
        Update: {
          id?:                   string
          room_id?:              string
          sender_id?:            string | null
          message_type?:         'text' | 'image' | 'file' | 'link' | 'system' | 'voice_translated' | 'text_translated'
          content?:              string | null
          content_original?:     string | null
          source_language?:      SupportedLanguage | null
          target_language?:      SupportedLanguage | null
          translation_provider?: 'claude' | 'openai' | 'google' | 'deepl' | null
          reply_to_id?:          string | null
          thread_root_id?:       string | null
          thread_reply_count?:   number
          mentions?:             string[]
          created_at?:           string
          edited_at?:            string | null
          deleted_at?:           string | null
          needs_response?:       boolean
          response_received?:    boolean
          followup_reminded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'messages_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_sender_id_fkey'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      // ─── message_attachments ─────────────────────────────────────────────────
      message_attachments: {
        Row: {
          id:              string
          message_id:      string
          room_id:         string
          uploaded_by:     string | null
          file_name:       string
          file_path:       string
          file_size:       number
          mime_type:       string
          attachment_type: 'image' | 'video' | 'document' | 'archive' | 'other'
          created_at:      string
        }
        Insert: {
          id?:              string
          message_id:       string
          room_id:          string
          uploaded_by?:     string | null
          file_name:        string
          file_path:        string
          file_size?:       number
          mime_type:        string
          attachment_type:  'image' | 'video' | 'document' | 'archive' | 'other'
          created_at?:      string
        }
        Update: {
          id?:              string
          message_id?:      string
          room_id?:         string
          uploaded_by?:     string | null
          file_name?:       string
          file_path?:       string
          file_size?:       number
          mime_type?:       string
          attachment_type?: 'image' | 'video' | 'document' | 'archive' | 'other'
          created_at?:      string
        }
        Relationships: [
          {
            foreignKeyName: 'message_attachments_message_id_fkey'
            columns: ['message_id']
            isOneToOne: false
            referencedRelation: 'messages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'message_attachments_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'rooms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'message_attachments_uploaded_by_fkey'
            columns: ['uploaded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      // ─── message_links ───────────────────────────────────────────────────────
      message_links: {
        Row: {
          id:          string
          message_id:  string
          room_id:     string
          url:         string
          title:       string | null
          description: string | null
          image_url:   string | null
          domain:      string | null
          created_at:  string
        }
        Insert: {
          id?:          string
          message_id:   string
          room_id:      string
          url:          string
          title?:       string | null
          description?: string | null
          image_url?:   string | null
          domain?:      string | null
          created_at?:  string
        }
        Update: {
          title?:       string | null
          description?: string | null
          image_url?:   string | null
          domain?:      string | null
        }
        Relationships: []
      }

      // ─── message_reactions ──────────────────────────────────────────────────
      message_reactions: {
        Row: {
          message_id: string
          room_id:    string
          user_id:    string
          emoji:      string
          created_at: string
        }
        Insert: {
          message_id: string
          room_id:    string
          user_id:    string
          emoji:      string
          created_at?: string
        }
        Update: {
          emoji?: string
        }
        Relationships: []
      }

      // ─── message_translations ───────────────────────────────────────────────
      message_translations: {
        Row: {
          id:              string
          message_id:      string
          room_id:         string
          language:        SupportedLanguage
          translated_text: string
          created_at:      string
        }
        Insert: {
          id?:             string
          message_id:      string
          room_id:         string
          language:        SupportedLanguage
          translated_text: string
          created_at?:     string
        }
        Update: {
          translated_text?: string
        }
        Relationships: []
      }

      // ─── translation_preferences ─────────────────────────────────────────────
      translation_preferences: {
        Row: {
          id:              string
          from_user_id:    string
          to_user_id:      string
          target_language: TranslationTarget
          created_at:      string
          updated_at:      string
        }
        Insert: {
          id?:             string
          from_user_id:    string
          to_user_id:      string
          target_language: TranslationTarget
          created_at?:     string
          updated_at?:     string
        }
        Update: {
          id?:              string
          from_user_id?:    string
          to_user_id?:      string
          target_language?: TranslationTarget
          created_at?:      string
          updated_at?:      string
        }
        Relationships: [
          {
            foreignKeyName: 'translation_preferences_from_user_id_fkey'
            columns: ['from_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'translation_preferences_to_user_id_fkey'
            columns: ['to_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      // ─── action_items ────────────────────────────────────────────────────────
      action_items: {
        Row: {
          id:            string
          message_id:    string | null
          room_id:       string
          created_by:    string
          assigned_to:   string
          title:         string
          due_date:      string | null
          status:        'pending' | 'done' | 'cancelled' | 'snoozed'
          snoozed_until: string | null
          created_at:    string
          updated_at:    string
        }
        Insert: {
          id?:            string
          message_id?:    string | null
          room_id:        string
          created_by:     string
          assigned_to:    string
          title:          string
          due_date?:      string | null
          status?:        'pending' | 'done' | 'cancelled' | 'snoozed'
          snoozed_until?: string | null
          created_at?:    string
          updated_at?:    string
        }
        Update: {
          title?:         string
          due_date?:      string | null
          status?:        'pending' | 'done' | 'cancelled' | 'snoozed'
          snoozed_until?: string | null
          updated_at?:    string
        }
        Relationships: [
          {
            foreignKeyName: 'action_items_message_id_fkey'
            columns: ['message_id']
            isOneToOne: false
            referencedRelation: 'messages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'action_items_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'action_items_assigned_to_fkey'
            columns: ['assigned_to']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      // ─── push_subscriptions ───────────────────────────────────────────────────
      push_subscriptions: {
        Row: {
          id:         string
          user_id:    string
          endpoint:   string
          p256dh:     string
          auth:       string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?:        string
          user_id:    string
          endpoint:   string
          p256dh:     string
          auth:       string
          created_at?: string
          updated_at?: string
        }
        Update: {
          p256dh?:     string
          auth?:       string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      // ─── ai_conversations ────────────────────────────────────────────────────
      ai_conversations: {
        Row: {
          id:                 string
          user_id:            string
          question:           string | null
          answer:             string | null
          category:           string
          confidence_label:   string
          saved_to_knowledge: boolean
          created_at:         string
        }
        Insert: {
          id?:                 string
          user_id:             string
          question?:           string | null
          answer?:             string | null
          category?:           string
          confidence_label?:   string
          saved_to_knowledge?: boolean
          created_at?:         string
        }
        Update: {
          id?:                 string
          user_id?:            string
          question?:           string | null
          answer?:             string | null
          category?:           string
          confidence_label?:   string
          saved_to_knowledge?: boolean
          created_at?:         string
        }
        Relationships: [
          {
            foreignKeyName: 'ai_conversations_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }

    Views: {
      [_ in never]: never
    }

    Functions: {
      get_or_create_direct_room: {
        Args: { p_target_user_id: string }
        Returns: string
      }
      create_group_room: {
        Args: { p_name: string; p_member_ids: string[] }
        Returns: string
      }
      is_room_member: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: boolean
      }
      get_target_language: {
        Args: { p_room_id: string; p_to_user_id?: string }
        Returns: string
      }
      leave_room: {
        Args: { p_room_id: string }
        Returns: void
      }
      join_channel: {
        Args: { p_room_id: string }
        Returns: void
      }
    }

    Enums: {
      [_ in never]: never
    }

    CompositeTypes: {
      [_ in never]: never
    }
  }
}
