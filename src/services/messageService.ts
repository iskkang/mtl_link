import { supabase } from '../lib/supabase'
import { useMessageStore } from '../stores/messageStore'
import { validateFiles } from '../lib/fileValidation'

// ─── 텍스트 메시지 (Optimistic UI) ──────────────────────────────

export async function sendTextMessage(
  roomId: string,
  content: string,
  sourceLanguage?: string,
): Promise<void> {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('메시지가 비어있습니다')
  if (trimmed.length > 4000) throw new Error('메시지는 4,000자 이내로 입력하세요')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('인증되지 않았습니다')

  const localId = crypto.randomUUID()
  const now     = new Date().toISOString()
  const srcLang = (sourceLanguage ?? null) as import('../types/database').SupportedLanguage | null

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
    created_at:           now,
    edited_at:            null,
    deleted_at:           null,
    sender:               null,
    attachments:          [],
  })

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        room_id:         roomId,
        sender_id:       user.id,
        message_type:    'text',
        content:         trimmed,
        source_language: srcLang,
      })
      .select()
      .single()
    if (error) throw error

    useMessageStore.getState().upsertMessage(roomId, {
      ...data,
      _localId:    localId,
      _status:     'sent',
      sender:      null,
      attachments: [],
    })
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

export async function sendFileMessage(roomId: string, files: File[], caption?: string): Promise<void> {
  const validation = validateFiles(files)
  if (!validation.ok) throw new Error(validation.error)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('인증되지 않았습니다')

  const isImage    = validation.results!.every(r => r.kind === 'image')
  const msgType    = isImage ? 'image' as const : 'file' as const

  // 업로드 중 이탈 방지
  const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
  window.addEventListener('beforeunload', onBeforeUnload)

  try {
    // 1. 메시지 행 먼저 생성
    const { data: msg, error: msgErr } = await supabase
      .from('messages')
      .insert({
        room_id:      roomId,
        sender_id:    user.id,
        message_type: msgType,
        content:      caption ?? null,
      })
      .select()
      .single()
    if (msgErr) throw msgErr

    // Realtime이 메시지를 먼저 받아도 괜찮도록 store에 즉시 추가
    useMessageStore.getState().upsertMessage(roomId, {
      ...msg,
      _status:     'sending',
      sender:      null,
      attachments: [],
    })

    // 2. 파일 병렬 업로드
    const results = await Promise.allSettled(
      files.map(async (file, idx) => {
        const safe = file.name.replace(/[^\w.\-가-힣]/g, '_')
        const path = `${roomId}/${msg.id}/${Date.now()}_${idx}_${safe}`

        const { error: upErr } = await supabase.storage
          .from('chat-files')
          .upload(path, file, { contentType: file.type })
        if (upErr) throw upErr

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
            attachment_type: validation.results![idx].kind!,
          })
        if (attErr) throw attErr
      }),
    )

    // 최종 상태 업데이트
    useMessageStore.getState().updateStatus(roomId, msg.id, 'sent')

    const failed = results.filter(r => r.status === 'rejected')
    if (failed.length > 0) throw new Error(`${failed.length}개 파일 업로드 실패`)

  } finally {
    window.removeEventListener('beforeunload', onBeforeUnload)
  }
}
