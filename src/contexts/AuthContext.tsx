import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useRoomStore } from '../stores/roomStore'
import { useRequestStore } from '../stores/requestStore'
import { subscribeToPushNotifications } from '../services/pushNotificationService'
import { saveLanguage, SUPPORTED_LANGS } from '../lib/i18n'
import i18n from 'i18next'
import type { Profile } from '../types/chat'

interface AuthContextValue {
  user:            User | null
  profile:         Profile | null
  loading:         boolean
  signIn:          (email: string, password: string) => Promise<void>
  signOut:         () => Promise<void>
  refreshProfile:  () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data ?? null)

    // localStorage가 비어 있을 때만 (새 기기/캐시 삭제) 프로필 언어로 동기화
    const storedLang = localStorage.getItem('mtl_lang')
    if (!storedLang && data?.preferred_language && SUPPORTED_LANGS.some(l => l.code === data.preferred_language)) {
      i18n.changeLanguage(data.preferred_language)
      saveLanguage(data.preferred_language as (typeof SUPPORTED_LANGS)[number]['code'])
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id)
  }, [user, fetchProfile])

  useEffect(() => {
    let active = true

    /*
     * onAuthStateChange가 v2에서 INITIAL_SESSION 이벤트를 즉시 발행하므로
     * getSession()을 따로 호출할 필요가 없다.
     *
     * 단, Supabase 내부 잠금 문제를 피하기 위해
     * onAuthStateChange 콜백 안에서 Supabase 메서드를 호출할 때는
     * setTimeout(fn, 0) 으로 마이크로태스크 큐 밖에서 실행한다.
     */
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return

        console.log('[Auth] Event:', event)

        if (event === 'TOKEN_REFRESHED') {
          console.log('[Auth] Token refreshed successfully')
        }

        const currentUser = session?.user ?? null
        setUser(currentUser)

        if (currentUser) {
          setTimeout(() => {
            if (!active) return
            fetchProfile(currentUser.id).finally(() => {
              if (!active) return
              setLoading(false)
              // 이미 알림 허용된 경우 구독 갱신 (조용히)
              if (
                localStorage.getItem('mtl_notif') !== 'off' &&
                'Notification' in window &&
                Notification.permission === 'granted'
              ) {
                subscribeToPushNotifications().catch(() => {})
              }
            })
            void useRequestStore.getState().loadCounts()
          }, 0)
        } else {
          // 로그아웃 또는 세션 만료 시 stale 데이터 제거
          useRoomStore.getState().reset()
          useRequestStore.setState({ receivedCount: 0, sentCount: 0 })
          setProfile(null)
          setLoading(false)

          if (event === 'SIGNED_OUT') {
            const publicPaths = ['/login', '/signup', '/pending', '/rejected', '/install', '/change-password']
            const isPublic = publicPaths.some(p => window.location.pathname.startsWith(p))
            if (!isPublic) {
              console.log('[Auth] Session ended, redirecting to login')
              window.location.href = '/login'
            }
          }
        }
      },
    )

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  // Realtime subscription for request counts — active whenever a user is logged in
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('request-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        void useRequestStore.getState().loadCounts()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    useRoomStore.getState().reset()
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
