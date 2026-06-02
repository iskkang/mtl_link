import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url     = import.meta.env.VITE_SUPABASE_URL     as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY 환경변수가 없습니다.\n' +
    '.env.example 을 참고해 .env.local 파일을 만들어주세요.',
  )
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession:      true,
    autoRefreshToken:    true,
    detectSessionInUrl:  true,
    storage:             window.localStorage,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
})

/** Returns the current user from the local session cache — no network request. */
export async function getSessionUser() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user ?? null
}

/** Call at service / hook level when an API call returns a 403 or JWT error. */
export function handleAuthError(error: { status?: number; message?: string } | null): boolean {
  if (!error) return false
  if (
    error.status === 401 ||
    error.status === 403 ||
    error.message?.includes('JWT') ||
    error.message?.includes('token')
  ) {
    if (import.meta.env.DEV) console.log('[Auth] Token expired or forbidden, signing out')
    supabase.auth.signOut().catch(() => {})
    return true
  }
  return false
}
