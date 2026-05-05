import { supabase } from '../lib/supabase'
import { useMessageStore } from '../stores/messageStore'
import { useRoomStore } from '../stores/roomStore'
import { validateFiles } from '../lib/fileValidation'
import { detectLanguage } from '../utils/detectLanguage'
import type { ReplyRef } from '../types/chat'

// ─── 텍스트 메시지 (Optimistic UI) ──────────────────────────────

export async function sendTextMessage(
  roomId: string,
  content: string,
  sourceLanguage?: string,
  replyToId?: string | null,
  replyMessage?: ReplyRef | null,
  needsResponse?: boolean,
  threadRootId?: string | null,
): Promise<void> {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('메시지가 비어있습니다')
  if (trimmed.length > 4000) throw new Error('메시지는 4,000자 이내로 입력하세요')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('인증되지 않았습니다')

  const localId = crypto.randomUUID()
  const now     = new Date().toISOString()
  const srcLang = (sourceLanguage ?? detectLanguage(trimmed) ?? 'en') as import('../types/database').SupportedLanguage | null

  useMessageStore.getState().upsertMessage(roomId, {
    id:                   localId,
    _localId:             localId,
    _status:              'sending',
    room_id:              roomId,
    sender_id:            user.id,
    message_type:         'text',
    content:              trimmed,
    content_original:     null,
    source_language:      srcLang,
    target_language:      null,
    translation_provider: null,
    reply_to_id:          replyToId ?? null,
    thread_root_id:       threadRootId ?? null,
    thread_reply_count:   0,
    created_at:           now,
    edited_at:            null,
    deleted_at:           null,
    needs_response:       needsResponse ?? false,
    response_received:    false,
    followup_reminded_at: null,
    sender:               null,
    attachments:          [],
    reply_message:        replyMessage ?? null,
  })
  if (!threadRootId) {
    useRoomStore.getState().updateLastMessage(roomId, trimmed, now)
  }

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        room_id:         roomId,
        sender_id:       user.id,
        message_type:    'text',
        content:         trimmed,
        source_language: srcLang,
        reply_to_id:     replyToId ?? null,
        thread_root_id:  threadRootId ?? null,
        needs_response:  needsResponse || false,
      })
      .select()
      .single()
    if (error) throw error

    useMessageStore.getState().upsertMessage(roomId, {
      ...data,
      _localId:      localId,
      _status:       'sent',
      sender:        null,
      attachments:   [],
      reply_message: replyMessage ?? null,
    })

    // 푸시 알림 (실패해도 메시지 전송에 영향 없음)
    supabase.functions.invoke('send-push-notification', {
      body: { roomId, senderId: user.id, body: trimmed.slice(0, 100) },
    }).catch(() => {})
  } catch (err) {
    useMessageStore.getState().updateStatus(roomId, localId, 'failed')
    throw err
  }
}

// ─── 메시지 수정 / 삭제 ──────────────────────────────────────────

export async function editMessage(messageId: string, content: string): Promise<void> {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('내용을 입력하세요')
  const { error } = await supabase
    .from('messages')
    .update({ content: trimmed, edited_at: new Date().toISOString() })
    .eq('id', messageId)
  if (error) throw error
}

export async function softDeleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId)
  if (error) throw error
}

// ─── 파일 메시지 ─────────────────────────────────────────────────

export async function sendFileMessage(
  roomId:        string,
  files:         File[],
  caption?:      string,
  replyToId?:    string | null,
  replyMessage?: ReplyRef | null,
  threadRootId?: string | null,
): Promise<void> {
  const validation = validateFiles(files)
  if (!validation.ok) throw new Error(validation.error)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('인증되지 않았습니다')

  const hasNonImage = validation.results!.some(r => r.kind !== 'image')
  const msgType     = hasNonImage ? 'file' as const : 'image' as const

  const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
  window.addEventListener('beforeunload', onBeforeUnload)

  try {
    // 1. 메시지 행 생성
    const { data: msg, error: msgErr } = await supabase
      .from('messages')
      .insert({
        room_id:        roomId,
        sender_id:      user.id,
        message_type:   msgType,
        content:        caption?.trim() || null,
        reply_to_id:    replyToId ?? null,
        thread_root_id: threadRootId ?? null,
      })
      .select()
      .single()
    if (msgErr) throw msgErr

    useMessageStore.getState().upsertMessage(roomId, {
      ...msg,
      _status:       'sending',
      sender:        null,
      attachments:   [],
      reply_message: replyMessage ?? null,
    })

    // 2. 파일 병렬 업로드 → chat-attachments (public bucket)
    const results = await Promise.allSettled(
      files.map(async (file, idx) => {
        const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
        const path = `${roomId}/${msg.id}/${Date.now()}_${idx}.${ext}`
        // file.type이 빈 문자열인 경우(예: .md, .csv on Windows) 폴백
        const contentType = file.type || 'application/octet-stream'

        const { error: upErr } = await supabase.storage
          .from('chat-attachments')
          .upload(path, file, { contentType })
        if (upErr) {
          console.error('[sendFileMessage] storage upload error:', upErr)
          throw new Error(upErr.message)
        }

        const kind = validation.results![idx].kind ?? 'other'
        const { error: attErr } = await supabase
          .from('message_attachments')
          .insert({
            message_id:      msg.id,
            room_id:         roomId,
            uploaded_by:     user.id,
            file_name:       file.name,
            file_path:       path,
            file_size:       file.size,
            mime_type:       file.type,
            attachment_type: kind,
          })
        if (attErr) {
          console.error('[sendFileMessage] attachment insert error:', attErr)
          throw new Error(attErr.message)
        }
      }),
    )

    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')

    useMessageStore.getState().updateStatus(roomId, msg.id, failed.length > 0 ? 'failed' : 'sent')

    if (failed.length > 0) {
      const reasons = failed.map(r => r.reason instanceof Error ? r.reason.message : String(r.reason))
      throw new Error(reasons[0])
    }

    // 푸시 알림 (스레드 답글은 제외)
    if (!threadRootId) {
      const pushBody = msgType === 'image' ? '📷 사진' : '📎 파일'
      supabase.functions.invoke('send-push-notification', {
        body: { roomId, senderId: user.id, body: pushBody },
      }).catch(() => {})
    }

  } finally {
    window.removeEventListener('beforeunload', onBeforeUnload)
  }
}
