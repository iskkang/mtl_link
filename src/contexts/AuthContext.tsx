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
      (_, session) => {
        if (!active) return
        const currentUser = session?.user ?? null
        setUser(currentUser)

        if (currentUser) {
          setTimeout(() => {
            if (!active) return
            fetchProfile(currentUser.id).finally(() => {
              if (active) setLoading(false)
            })
          }, 0)
        } else {
          // 로그아웃 또는 세션 만료 시 stale 데이터 제거
          useRoomStore.getState().reset()
          setProfile(null)
          setLoading(false)
        }
      },
    )

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

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
