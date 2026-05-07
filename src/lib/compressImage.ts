import imageCompression from 'browser-image-compression'

const SKIP_BELOW_BYTES = 300 * 1024 // 300 KB

const COMPRESSION_OPTIONS = {
  maxSizeMB:        1,
  maxWidthOrHeight: 1920,
  useWebWorker:     true,
  fileType:         'image/webp',
  initialQuality:   0.82,
}

export interface CompressResult {
  file:           File
  originalSize:   number
  compressedSize: number
  skipped:        boolean
}

/**
 * 이미지 파일을 WebP로 압축한다.
 * GIF·SVG·비이미지·300KB 미만은 원본을 그대로 반환한다.
 * 압축 실패 시에도 원본 fallback으로 업로드가 끊기지 않는다.
 */
export async function compressImage(file: File): Promise<CompressResult> {
  const originalSize = file.size
  const skip = (reason: string): CompressResult => {
    console.debug(`[compressImage] skip(${reason}): ${file.name}`)
    return { file, originalSize, compressedSize: originalSize, skipped: true }
  }

  if (!file.type.startsWith('image/'))  return skip('not-image')
  if (file.type === 'image/gif')        return skip('gif')
  if (file.type === 'image/svg+xml')    return skip('svg')
  if (originalSize < SKIP_BELOW_BYTES)  return skip('too-small')

  try {
    const compressed = await imageCompression(file, COMPRESSION_OPTIONS)

    if (compressed.size >= originalSize) return skip('no-gain')

    const ratio = ((1 - compressed.size / originalSize) * 100).toFixed(1)
    console.debug(
      `[compressImage] ${file.name}: ${(originalSize / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB (${ratio}% 감소)`,
    )

    return { file: compressed, originalSize, compressedSize: compressed.size, skipped: false }
  } catch (err) {
    console.error('[compressImage] 압축 실패, 원본 사용:', err)
    return skip('error')
  }
}
