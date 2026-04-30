import { supabase } from '../lib/supabase'
import { useMessageStore } from '../stores/messageStore'

export async function sendVoiceTranslatedMessage({
  roomId,
  audioBlob,
  targetLanguage,
}: {
  roomId:         string
  audioBlob:      Blob
  targetLanguage: string
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('인증되지 않았습니다')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('세션이 없습니다')

  // Edge Function 호출 — audio는 메모리 내에서만 처리, 저장 안 됨
  const formData = new FormData()
  formData.append('audio',           audioBlob, 'voice.webm')
  formData.append('target_language', targetLanguage)
  formData.append('room_id',         roomId)

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-translate`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body:    formData,
    },
  )

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error ?? `음성 번역 실패 (${res.status})`)
  }

  const result = await res.json()

  const { data, error } = await supabase
    .from('messages')
    .insert({
      room_id:              roomId,
      sender_id:            user.id,
      message_type:         targetLanguage === 'none' ? 'text' : 'voice_translated',
      content:              targetLanguage === 'none' ? result.original_text : result.translated_text,
      content_original:     targetLanguage === 'none' ? null : result.original_text,
      source_language:      result.source_language,
      target_language:      result.target_language,
      translation_provider: result.provider ?? null,
    })
    .select()
    .single()

  if (error) throw error

  useMessageStore.getState().upsertMessage(roomId, {
    ...data,
    _status:     'sent',
    sender:      null,
    attachments: [],
  })
}
