import { supabase } from '../lib/supabase'
import type { Profile } from '../types/chat'

export interface CreateUserInput {
  email:              string
  name:               string
  department?:        string
  position?:          string
  preferred_language?: string
}

export interface CreateUserResult {
  ok:            true
  user_id:       string
  email:         string
  temp_password: string
  message:       string
}

// ─── 직원 목록 ──────────────────────────────────────────────────────────────

export async function fetchAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Profile[]
}

// ─── 직원 추가 (Edge Function) ──────────────────────────────────────────────

export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: input,
  })
  if (error) throw new Error(error.message ?? '직원 생성 실패')
  if (!data?.ok) throw new Error(data?.error ?? '직원 생성 실패')
  return data as CreateUserResult
}

// ─── 상태 변경 (활성 / 비활성) ───────────────────────────────────────────────

export async function setUserStatus(
  userId: string,
  status: 'active' | 'inactive',
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', userId)
  if (error) throw error
}

// ─── 관리자 권한 토글 ────────────────────────────────────────────────────────

export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_admin: isAdmin })
    .eq('id', userId)
  if (error) throw error
}

// ─── 가입 승인 / 거절 ────────────────────────────────────────────────────────

export async function approveUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ status: 'active' })
    .eq('id', userId)
  if (error) throw error
}

export async function rejectUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ status: 'rejected' })
    .eq('id', userId)
  if (error) throw error
}
