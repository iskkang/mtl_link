const IMAGE_TYPES: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png':  ['png'],
  'image/webp': ['webp'],
}
const DOCUMENT_TYPES: Record<string, string[]> = {
  'application/pdf':  ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'text/csv': ['csv'],
  'application/vnd.ms-powerpoint': ['ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
}
const ARCHIVE_TYPES: Record<string, string[]> = {
  'application/zip':            ['zip'],
  'application/x-zip-compressed': ['zip'],
}
const SIZE_LIMITS = {
  image:    10 * 1024 * 1024,
  document: 30 * 1024 * 1024,
  archive:  50 * 1024 * 1024,
}
const BLOCKED = ['exe','bat','cmd','js','msi','scr','ps1','vbs','sh','jar','com']

export type AttachmentKind = 'image' | 'document' | 'archive'

export interface ValidationResult {
  ok:      boolean
  kind?:   AttachmentKind
  error?:  string
}

export function validateFile(file: File): ValidationResult {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (BLOCKED.includes(ext)) return { ok: false, error: `차단된 확장자: .${ext}` }

  const check = (types: Record<string, string[]>, kind: AttachmentKind, limit: number) => {
    const exts = types[file.type]
    if (!exts) return null
    if (!exts.includes(ext)) return { ok: false, error: '확장자와 파일 형식이 일치하지 않습니다' }
    if (file.size > limit) return { ok: false, error: `최대 ${limit / 1024 / 1024}MB를 초과합니다` }
    return { ok: true, kind } as ValidationResult
  }

  return (
    check(IMAGE_TYPES,    'image',    SIZE_LIMITS.image)    ??
    check(DOCUMENT_TYPES, 'document', SIZE_LIMITS.document) ??
    check(ARCHIVE_TYPES,  'archive',  SIZE_LIMITS.archive)  ??
    { ok: false, error: '지원하지 않는 파일 형식입니다' }
  )
}

export interface BatchValidationResult {
  ok:       boolean
  error?:   string
  results?: ValidationResult[]
}

export function validateFiles(files: File[]): BatchValidationResult {
  if (!files.length)  return { ok: false, error: '파일이 없습니다' }
  if (files.length > 5) return { ok: false, error: '한 번에 최대 5개까지 첨부할 수 있습니다' }
  const results = files.map(validateFile)
  const failed  = results.find(r => !r.ok)
  if (failed) return { ok: false, error: failed.error, results }
  return { ok: true, results }
}
