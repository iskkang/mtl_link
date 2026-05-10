import { supabase } from '../lib/supabase'

const BUCKET   = 'profile-images'
const MAX_SIZE = 1024 * 1024  // 1MB guard after compression

/** 256×256 center-crop → JPEG 0.85 */
export async function compressAvatar(file: File): Promise<Blob> {
  const img = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width  = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  const minDim = Math.min(img.width, img.height)
  const sx = (img.width  - minDim) / 2
  const sy = (img.height - minDim) / 2
  ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 256, 256)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('canvas.toBlob failed')),
      'image/jpeg',
      0.85,
    )
  })
}

/**
 * Upload avatar: compress → Storage upsert → profiles.avatar_url update.
 * Returns the new public URL (with ?v=timestamp cache-bust).
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const blob = await compressAvatar(file)
  if (blob.size > MAX_SIZE) throw new Error('Image too large after compression')

  const path = `${userId}/avatar.jpg`
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (upErr) throw upErr

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const url = `${urlData.publicUrl}?v=${Date.now()}`

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (updErr) throw updErr

  return url
}

/** Remove avatar from Storage and clear profiles.avatar_url. */
export async function deleteAvatar(userId: string): Promise<void> {
  const path = `${userId}/avatar.jpg`
  await supabase.storage.from(BUCKET).remove([path])
  await supabase
    .from('profiles')
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq('id', userId)
}
