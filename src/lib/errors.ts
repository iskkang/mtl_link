import type { PostgrestError } from '@supabase/supabase-js'

export function getErrorMessage(err: unknown): string {
  if (!err) return '알 수 없는 오류'
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return '알 수 없는 오류'
}

export function isRLSError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as PostgrestError
  return e.code === 'PGRST301' || !!e.message?.includes('row-level security')
}

export function getUserFriendlyMessage(err: unknown): string {
  const msg = getErrorMessage(err)
  if (isRLSError(err)) return '권한이 없습니다'
  if (msg.includes('JWT expired')) return '세션이 만료되었습니다. 다시 로그인해주세요'
  if (msg.includes('Network')) return '네트워크 오류. 연결을 확인해주세요'
  if (msg.includes('413')) return '파일이 너무 큽니다'
  return msg
}
