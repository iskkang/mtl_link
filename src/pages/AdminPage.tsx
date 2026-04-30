import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  UserPlus, MessageSquare, Sun, Moon,
  ShieldCheck, ShieldOff, UserX, UserCheck,
  Copy, Check, X, Search, ChevronDown,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../hooks/useAuth'
import { Avatar } from '../components/ui/Avatar'
import {
  fetchAllProfiles,
  createUser,
  setUserStatus,
  setUserAdmin,
  approveUser,
  rejectUser,
  type CreateUserInput,
  type CreateUserResult,
} from '../services/adminService'
import type { Profile } from '../types/chat'

const DEPT_OPTIONS = ['운항팀', '영업팀', '재무팀', '관리팀', '기술팀', '']

// ─── AdminPage ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { mode, toggle } = useTheme()
  const { user, profile: myProfile } = useAuth()

  const [profiles,    setProfiles]    = useState<Profile[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [addOpen,     setAddOpen]     = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'pending' | 'rejected'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try { setProfiles(await fetchAllProfiles()) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase()
    const matchQuery = !q ||
      p.name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      (p.department ?? '').toLowerCase().includes(q) ||
      (p.position ?? '').toLowerCase().includes(q)
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    return matchQuery && matchStatus
  })

  const totalActive  = profiles.filter(p => p.status === 'active').length
  const totalAdmin   = profiles.filter(p => p.is_admin).length
  const totalPending = profiles.filter(p => p.status === 'pending').length

  const handleStatusToggle = async (p: Profile) => {
    const next = p.status === 'active' ? 'inactive' : 'active'
    setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, status: next } : x))
    try { await setUserStatus(p.id, next) }
    catch { setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, status: p.status } : x)) }
  }

  const handleAdminToggle = async (p: Profile) => {
    if (p.id === user?.id) return
    const next = !p.is_admin
    setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, is_admin: next } : x))
    try { await setUserAdmin(p.id, next) }
    catch { setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, is_admin: p.is_admin } : x)) }
  }

  const handleApprove = async (p: Profile) => {
    setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, status: 'active' } : x))
    try { await approveUser(p.id) }
    catch { setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, status: p.status } : x)) }
  }

  const handleReject = async (p: Profile) => {
    setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, status: 'rejected' } : x))
    try { await rejectUser(p.id) }
    catch { setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, status: p.status } : x)) }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-surface-chat flex flex-col">

      {/* ── 헤더 ────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center justify-between
                         px-6 py-3 bg-white dark:bg-surface-panel
                         border-b border-gray-200 dark:border-[#374045] shadow-sm">
        <div className="flex items-center gap-4">
          <img src="/mtl-logo.png" alt="MTL" className="h-8 w-auto object-contain" />
          <div>
            <h1 className="font-display text-base font-bold text-mtl-navy dark:text-[#e9edef] leading-none">
              관리자
            </h1>
            <p className="text-[10px] text-gray-400 dark:text-[#8696a0] mt-0.5">
              MTL Shipping Agency
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                       text-gray-500 dark:text-[#aebac1]
                       hover:bg-gray-100 dark:hover:bg-surface-hover transition-colors"
          >
            <MessageSquare size={14} /> 채팅으로
          </Link>
          <button
            onClick={toggle}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-hover
                       text-gray-500 dark:text-[#aebac1] transition-colors"
            aria-label="테마 전환"
          >
            {mode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          {myProfile && (
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-[#374045]">
              <Avatar name={myProfile.name} avatarUrl={myProfile.avatar_url} size="xs" />
              <span className="text-xs text-gray-600 dark:text-[#aebac1]">{myProfile.name}</span>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6">

        {/* ── 통계 카드 ─────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: '전체 직원', value: profiles.length, color: 'text-mtl-cyan dark:text-accent' },
            { label: '재직 중',   value: totalActive,     color: 'text-emerald-500 dark:text-emerald-400' },
            { label: '관리자',    value: totalAdmin,      color: 'text-mtl-navy dark:text-mtl-mist' },
            { label: '승인 대기', value: totalPending,    color: totalPending > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-gray-400 dark:text-[#8696a0]' },
          ].map(s => (
            <div key={s.label}
                 className="bg-white dark:bg-surface-panel rounded-2xl px-5 py-4
                            border border-gray-100 dark:border-[#374045] shadow-sm">
              <p className="text-xs text-gray-400 dark:text-[#8696a0] mb-1">{s.label}</p>
              <p className={`text-2xl font-bold font-display ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── 툴바 ─────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#8696a0]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="이름·이메일·부서 검색"
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl
                         bg-white dark:bg-surface-panel
                         border border-gray-200 dark:border-[#374045]
                         text-gray-700 dark:text-[#e9edef]
                         placeholder-gray-400 dark:placeholder-[#8696a0]
                         focus:outline-none focus:ring-2 focus:ring-mtl-cyan/30 dark:focus:ring-accent/30"
            />
          </div>

          {/* 상태 필터 */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
              className="appearance-none pl-3 pr-8 py-2 text-sm rounded-xl
                         bg-white dark:bg-surface-panel
                         border border-gray-200 dark:border-[#374045]
                         text-gray-700 dark:text-[#e9edef]
                         focus:outline-none focus:ring-2 focus:ring-mtl-cyan/30 dark:focus:ring-accent/30 cursor-pointer"
            >
              <option value="all">전체</option>
              <option value="active">재직</option>
              <option value="inactive">비활성</option>
              <option value="pending">승인 대기</option>
              <option value="rejected">거절됨</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-[#8696a0]" />
          </div>

          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                       bg-mtl-cyan dark:bg-accent text-white
                       hover:bg-mtl-cyan/90 dark:hover:bg-accent-hover
                       transition-colors shadow-sm flex-shrink-0"
          >
            <UserPlus size={15} /> 직원 추가
          </button>
        </div>

        {/* ── 직원 목록 ─────────────────────────────── */}
        <div className="bg-white dark:bg-surface-panel rounded-2xl
                        border border-gray-100 dark:border-[#374045] shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <span className="w-8 h-8 border-3 border-gray-200 dark:border-[#374045] border-t-mtl-cyan dark:border-t-accent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400 dark:text-[#8696a0]">
              검색 결과가 없습니다
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-[#374045]">
                  {['직원', '부서 / 직급', '상태', '권한', '작업'].map(h => (
                    <th key={h}
                        className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider
                                   text-gray-400 dark:text-[#8696a0]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-[#374045]/60">
                {filtered.map(p => (
                  <EmployeeRow
                    key={p.id}
                    profile={p}
                    isSelf={p.id === user?.id}
                    onStatusToggle={handleStatusToggle}
                    onAdminToggle={handleAdminToggle}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="mt-3 text-xs text-gray-300 dark:text-[#374045] text-right">
          {filtered.length}명 표시 / 전체 {profiles.length}명
        </p>
      </div>

      {/* ── 직원 추가 모달 ────────────────────────── */}
      {addOpen && (
        <AddUserModal
          onCreated={() => { setAddOpen(false); load() }}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  )
}

// ─── 직원 행 ──────────────────────────────────────────────────────────────

function EmployeeRow({
  profile: p, isSelf,
  onStatusToggle, onAdminToggle, onApprove, onReject,
}: {
  profile:        Profile
  isSelf:         boolean
  onStatusToggle: (p: Profile) => void
  onAdminToggle:  (p: Profile) => void
  onApprove:      (p: Profile) => void
  onReject:       (p: Profile) => void
}) {
  const isActive   = p.status === 'active'
  const isPending  = p.status === 'pending'
  const isRejected = p.status === 'rejected'
  const dimmed     = !isActive && !isPending

  const statusBadge = () => {
    if (isActive)   return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />재직</span>
    if (isPending)  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />대기</span>
    if (isRejected) return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-500 dark:bg-red-400" />거절</span>
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-surface-hover text-gray-400 dark:text-[#8696a0]"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" />비활성</span>
  }

  return (
    <tr className={`transition-colors hover:bg-gray-50/60 dark:hover:bg-surface-hover/30 ${dimmed ? 'opacity-50' : ''}`}>
      {/* 직원 */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-[#e9edef] truncate flex items-center gap-1.5">
              {p.name}
              {isSelf && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-mtl-cyan/10 dark:bg-accent/10
                                 text-mtl-cyan dark:text-accent font-medium">나</span>
              )}
            </p>
            <p className="text-xs text-gray-400 dark:text-[#8696a0] truncate">{p.email}</p>
          </div>
        </div>
      </td>

      {/* 부서/직급 */}
      <td className="px-4 py-3">
        <p className="text-sm text-gray-700 dark:text-[#aebac1]">{p.department ?? '—'}</p>
        <p className="text-xs text-gray-400 dark:text-[#8696a0]">{p.position ?? '—'}</p>
      </td>

      {/* 상태 */}
      <td className="px-4 py-3">{statusBadge()}</td>

      {/* 권한 */}
      <td className="px-4 py-3">
        {p.is_admin ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                           bg-mtl-navy/10 dark:bg-mtl-mist/10 text-mtl-navy dark:text-mtl-mist">
            <ShieldCheck size={11} /> 관리자
          </span>
        ) : (
          <span className="text-xs text-gray-400 dark:text-[#8696a0]">일반</span>
        )}
      </td>

      {/* 작업 */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {/* 승인 대기 / 거절 상태: 승인·거절 버튼 */}
          {(isPending || isRejected) ? (
            <>
              <ActionIconBtn title="승인" onClick={() => onApprove(p)}>
                <UserCheck size={14} className="text-emerald-500 dark:text-emerald-400" />
              </ActionIconBtn>
              {isPending && (
                <ActionIconBtn title="거절" onClick={() => onReject(p)}>
                  <UserX size={14} className="text-red-500 dark:text-red-400" />
                </ActionIconBtn>
              )}
            </>
          ) : (
            <>
              <ActionIconBtn
                title={isActive ? '비활성화' : '복귀'}
                onClick={() => onStatusToggle(p)}
                disabled={isSelf}
              >
                {isActive ? <UserX size={14} /> : <UserCheck size={14} />}
              </ActionIconBtn>
              <ActionIconBtn
                title={p.is_admin ? '관리자 해제' : '관리자 지정'}
                onClick={() => onAdminToggle(p)}
                disabled={isSelf}
              >
                {p.is_admin ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
              </ActionIconBtn>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

function ActionIconBtn({
  children, title, onClick, disabled,
}: {
  children: React.ReactNode
  title:    string
  onClick:  () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="p-1.5 rounded-lg text-gray-400 dark:text-[#8696a0]
                 hover:bg-gray-100 dark:hover:bg-surface-hover
                 hover:text-gray-700 dark:hover:text-[#e9edef]
                 disabled:opacity-20 disabled:cursor-not-allowed
                 transition-colors"
    >
      {children}
    </button>
  )
}

// ─── 직원 추가 모달 ────────────────────────────────────────────────────────

function AddUserModal({
  onCreated,
  onClose,
}: {
  onCreated: () => void
  onClose:   () => void
}) {
  const [form, setForm] = useState<CreateUserInput>({
    email: '', name: '', department: '', position: '',
  })
  const [submitting, setSubmitting]  = useState(false)
  const [error,      setError]       = useState<string | null>(null)
  const [result,     setResult]      = useState<CreateUserResult | null>(null)
  const [copied,     setCopied]      = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email.trim() || !form.name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await createUser({
        email:      form.email.trim(),
        name:       form.name.trim(),
        department: form.department?.trim() || undefined,
        position:   form.position?.trim()   || undefined,
      })
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : '직원 생성 실패')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.temp_password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const set = (k: keyof CreateUserInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden
                   bg-white dark:bg-surface-panel
                   border border-gray-100 dark:border-[#374045]"
        onClick={e => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4
                        border-b border-gray-100 dark:border-[#374045]">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-[#e9edef]">
              직원 추가
            </h2>
            <p className="text-xs text-gray-400 dark:text-[#8696a0] mt-0.5">
              생성 후 임시 비밀번호를 직원에게 직접 전달하세요
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-hover
                       text-gray-400 dark:text-[#8696a0] transition-colors"
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>

        {result ? (
          /* 성공 화면 */
          <div className="px-6 py-5">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30
                              flex items-center justify-center mb-3">
                <Check size={22} className="text-emerald-500 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-gray-800 dark:text-[#e9edef]">
                {result.email} 계정이 생성되었습니다
              </p>
              <p className="text-xs text-gray-400 dark:text-[#8696a0] mt-1">
                아래 임시 비밀번호를 안전하게 전달해 주세요
              </p>
            </div>

            {/* 임시 비밀번호 */}
            <div className="mb-5 p-4 rounded-xl bg-gray-50 dark:bg-surface-input
                            border border-gray-200 dark:border-[#374045]">
              <p className="text-[10px] text-gray-400 dark:text-[#8696a0] mb-2 uppercase tracking-wider font-semibold">
                임시 비밀번호
              </p>
              <div className="flex items-center justify-between gap-3">
                <code className="text-base font-mono font-semibold text-mtl-navy dark:text-mtl-cyan tracking-widest select-all">
                  {result.temp_password}
                </code>
                <button
                  onClick={handleCopy}
                  className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs
                              transition-colors
                              ${copied
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                : 'hover:bg-gray-200 dark:hover:bg-surface-hover text-gray-500 dark:text-[#aebac1]'
                              }`}
                  aria-label="비밀번호 복사"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? '복사됨' : '복사'}
                </button>
              </div>
            </div>

            <button
              onClick={onCreated}
              className="w-full py-2.5 rounded-xl text-sm font-medium
                         bg-mtl-cyan dark:bg-accent text-white
                         hover:bg-mtl-cyan/90 dark:hover:bg-accent-hover transition-colors"
            >
              확인
            </button>
          </div>
        ) : (
          /* 입력 폼 */
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <Field label="이메일 *">
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                required
                placeholder="employee@mtl-ship.com"
                autoFocus
                className={inputCls}
              />
            </Field>

            <Field label="이름 *">
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                required
                placeholder="홍길동"
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="부서">
                <select value={form.department} onChange={set('department')} className={inputCls}>
                  <option value="">선택 안 함</option>
                  {DEPT_OPTIONS.filter(Boolean).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </Field>

              <Field label="직급">
                <input
                  type="text"
                  value={form.position}
                  onChange={set('position')}
                  placeholder="사원 / 대리 …"
                  className={inputCls}
                />
              </Field>
            </div>

            {error && (
              <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20
                            px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm
                           hover:bg-gray-100 dark:hover:bg-surface-hover
                           text-gray-600 dark:text-[#aebac1] transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitting || !form.email.trim() || !form.name.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium
                           bg-mtl-cyan dark:bg-accent text-white
                           hover:bg-mtl-cyan/90 dark:hover:bg-accent-hover
                           disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submitting
                  ? <span className="inline-flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      생성 중…
                    </span>
                  : '직원 생성'
                }
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── 공통 폼 필드 ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-[#8696a0] mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputCls = `
  w-full px-3 py-2.5 rounded-xl text-sm
  bg-gray-50 dark:bg-surface-input
  border border-gray-200 dark:border-[#374045]
  text-gray-800 dark:text-[#e9edef]
  placeholder-gray-400 dark:placeholder-[#8696a0]
  focus:outline-none focus:ring-2 focus:ring-mtl-cyan/30 dark:focus:ring-accent/30
  transition-colors
`
