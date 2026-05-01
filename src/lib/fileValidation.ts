const IMAGE_TYPES: Record<string, true> = {
  'image/jpeg': true, 'image/jpg': true, 'image/png': true,
  'image/webp': true, 'image/gif': true,
}
const VIDEO_TYPES: Record<string, true> = {
  'video/mp4': true, 'video/webm': true, 'video/ogg': true,
  'video/quicktime': true, 'video/x-msvideo': true, 'video/x-ms-wmv': true,
  'video/3gpp': true,
}
const DOCUMENT_TYPES: Record<string, true> = {
  'application/pdf': true,
  'application/msword': true,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
  'application/vnd.ms-excel': true,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true,
  'text/csv': true,
  'application/vnd.ms-powerpoint': true,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': true,
}
const ARCHIVE_TYPES: Record<string, true> = {
  'application/zip': true, 'application/x-zip-compressed': true,
  'application/x-rar-compressed': true, 'application/x-7z-compressed': true,
}

const MAX_SIZE_BYTES = 50 * 1024 * 1024  // 50MB 통합 제한
const BLOCKED_EXT   = new Set(['exe','bat','cmd','msi','scr','ps1','vbs','sh','jar','com','pif'])

export type AttachmentKind = 'image' | 'video' | 'document' | 'archive' | 'other'

export interface ValidationResult {
  ok:     boolean
  kind?:  AttachmentKind
  error?: string
}

export function validateFile(file: File): ValidationResult {
  if (file.size > MAX_SIZE_BYTES)
    return { ok: false, error: `파일 크기가 50MB를 초과합니다 (${file.name})` }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (BLOCKED_EXT.has(ext))
    return { ok: false, error: '업로드가 안되는 파일양식입니다' }

  if (IMAGE_TYPES[file.type] || file.type.startsWith('image/'))
    return { ok: true, kind: 'image' }
  if (VIDEO_TYPES[file.type] || file.type.startsWith('video/'))
    return { ok: true, kind: 'video' }
  if (DOCUMENT_TYPES[file.type])
    return { ok: true, kind: 'document' }
  if (ARCHIVE_TYPES[file.type])
    return { ok: true, kind: 'archive' }

  // 기타 모든 파일 허용 (크기·확장자 제한만 통과하면 OK)
  return { ok: true, kind: 'other' }
}

export interface BatchValidationResult {
  ok:       boolean
  error?:   string
  results?: ValidationResult[]
}

export function validateFiles(files: File[]): BatchValidationResult {
  if (!files.length)    return { ok: false, error: '파일이 없습니다' }
  if (files.length > 5) return { ok: false, error: '한 번에 최대 5개까지 첨부할 수 있습니다' }
  const results = files.map(validateFile)
  const failed  = results.find(r => !r.ok)
  if (failed) return { ok: false, error: failed.error, results }
  return { ok: true, results }
}
