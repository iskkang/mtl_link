import { supabase } from '../lib/supabase'

export async function sendOcrTranslation({
  roomId,
  imageFile,
  targetLanguage,
}: {
  roomId:         string
  imageFile:      File
  targetLanguage: string
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  if (imageFile.size > 10 * 1024 * 1024)
    throw new Error('이미지 크기는 10MB 이하여야 합니다')

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(imageFile.type))
    throw new Error('JPG, PNG, WEBP, GIF 형식만 지원합니다')

  const formData = new FormData()
  formData.append('image', imageFile)
  formData.append('target_language', targetLanguage)
  formData.append('room_id', roomId)

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-translate`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body:    formData,
    },
  )

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error ?? `OCR 실패 (${res.status})`)
  }

  const result = await res.json() as {
    extracted_text:    string
    translated_text:   string
    detected_language: string
    target_language:   string
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.from('messages').insert({
    room_id:              roomId,
    sender_id:            user.id,
    message_type:         'text_translated',
    content:              result.translated_text,
    content_original:     result.extracted_text,
    source_language:      (result.detected_language as 'ko' | 'en' | 'ru' | 'uz' | 'zh' | 'ja') ?? null,
    target_language:      (result.target_language   as 'ko' | 'en' | 'ru' | 'uz' | 'zh' | 'ja') ?? null,
    translation_provider: 'claude',
  })

  if (error) throw error
}
