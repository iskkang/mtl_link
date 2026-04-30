import { supabase } from '../lib/supabase'

const cache  = new Map<string, { url: string; expiresAt: number }>()
const TTL_MS = 50 * 60 * 1000   // 50분 (Supabase 만료 1시간보다 10분 여유)

export async function getSignedFileUrl(filePath: string): Promise<string> {
  const cached = cache.get(filePath)
  if (cached && cached.expiresAt > Date.now()) return cached.url

  const { data, error } = await supabase.storage
    .from('chat-files')
    .createSignedUrl(filePath, 3600)

  if (error || !data) throw error ?? new Error('Signed URL 생성 실패')
  cache.set(filePath, { url: data.signedUrl, expiresAt: Date.now() + TTL_MS })
  return data.signedUrl
}
