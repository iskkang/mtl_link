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
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
})
