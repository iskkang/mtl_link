import { supabase } from '../lib/supabase'

export interface TranslateParams {
  message_id:      string
  room_id:         string
  source_text:     string
  source_language: string
  target_language: string
}

export async function translateMessage(params: TranslateParams): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{
    translated_text?: string
    error?: string
  }>('translate-text', { body: params })

  if (error) throw error
  if (!data?.translated_text) throw new Error(data?.error ?? 'Translation failed')
  return data.translated_text
}
