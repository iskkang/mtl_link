import { useState, useEffect, useRef } from 'react'
import { X, Users, MessageSquare, Loader2 } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { UserPicker } from './UserPicker'
import { createDirectRoom, createGroupRoom, fetchRooms } from '../../services/roomService'
import { fetchActiveProfiles } from '../../services/profileService'
import { useRoomStore } from '../../stores/roomStore'
import { useAuth } from '../../hooks/useAuth'
import { getUserFriendlyMessage } from '../../lib/errors'

type Tab = 'direct' | 'group'

interface Props {
  open:          boolean
  onClose:       () => void
  onRoomCreated: (roomId: string) => void
}

export function NewRoomModal({ open, onClose, onRoomCreated }: Props) {
  const { user } = useAuth()
  const setRooms = useRoomStore(s => s.setRooms)

  const [tab,       setTab]       = useState<Tab>('direct')
  const [groupName, setGroupName] = useState('')
  const [selected,  setSelected]  = useState<string[]>([])
  const [creating,  setCreating]  = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSelected([])
    setGroupName('')
    setError(null)
    if (tab === 'group') setTimeout(() => nameInputRef.current?.focus(), 50)
  }, [tab])

  useEffect(() => {
    if (open) {
      setTab('direct')
      setSelected([])
      setGroupName('')
      setError(null)
      setCreating(false)
      setLoadingId(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const refreshRooms = async () => {
    const rooms = await fetchRooms()
    setRooms(rooms)
  }

  const handleCreateDirect = async (targetId: string) => {
    if (creating) return
    setLoadingId(targetId)
    setCreating(true)
    setError(null)
    try {
      const roomId = await createDirectRoom(targetId)
      await refreshRooms()
      onRoomCreated(roomId)
    } catch (err) {
      setError(getUserFriendlyMessage(err))
      setCreating(false)
      setLoadingId(null)
    }
  }

  const handleCreateGroup = async () => {
    const name = groupName.trim()
    if (!name || selected.length < 2) return
    setCreating(true)
    setError(null)
    try {
      const memberIds = user ? [user.id, ...selected] : selected
      const roomId    = await createGroupRoom(name, memberIds)
      await refreshRooms()
      onRoomCreated(roomId)
    } catch (err) {
      setError(getUserFriendlyMessage(err))
      setCreating(false)
    }
  }

  if (!open) return null

  const groupReady = groupName.trim().length > 0 && selected.length >= 2

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md flex flex-col rounded-2xl overflow-hidden shadow-2xl max-h-[90vh]"
        style={{ background: 'var(--card)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 상단 그라디언트 바 */}
        <div className="h-1 flex-shrink-0" style={{ background: 'linear-gradient(90deg, #3390EC, #6366F1)' }} />

        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0 border-b"
          style={{ borderColor: 'var(--line)' }}
        >
          <h2 className="text-xl font-bold tracking-wide" style={{ color: 'var(--ink)' }}>
            새 채팅
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full transition-colors"
            style={{ color: 'var(--ink-4)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b flex-shrink-0" style={{ borderColor: 'var(--line)' }}>
          {([
            { key: 'direct', label: '1:1 채팅', Icon: MessageSquare },
            { key: 'group',  label: '그룹 채팅', Icon: Users },
          ] as const).map(({ key, label, Icon }) => {
            const isActive = tab === key
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors"
                style={{
                  borderColor: isActive ? 'var(--brand)' : 'transparent',
                  color: isActive ? 'var(--ink)' : 'var(--ink-4)',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-4)' }}
              >
                <Icon size={16} />
                {label}
              </button>
            )
          })}
        </div>

        {/* 본문 */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

          {/* 에러 */}
          {error && (
            <div className="mx-4 mt-3 px-4 py-2.5 rounded-lg flex-shrink-0 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {tab === 'direct' ? (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden pt-3">
              <p className="px-4 pb-2 text-xs flex-shrink-0" style={{ color: 'var(--ink-4)' }}>
                대화할 팀원을 선택하세요
              </p>
              <UserPicker
                mode="single"
                selected={[]}
                onChange={() => {}}
                excludeId={user?.id}
                onPickSingle={handleCreateDirect}
                loadingId={loadingId}
              />
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* 그룹 이름 */}
              <div className="px-4 pt-4 pb-3 flex-shrink-0">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-3)' }}>
                  그룹 이름 <span className="text-red-400">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="그룹 이름을 입력하세요"
                  maxLength={50}
                  className="mtl-input"
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup() }}
                />
              </div>

              {/* 선택된 멤버 칩 */}
              {selected.length > 0 && (
                <SelectedChips
                  selectedIds={selected}
                  onRemove={id => setSelected(s => s.filter(x => x !== id))}
                  excludeId={user?.id}
                />
              )}

              {/* 멤버 선택 */}
              <div className="px-4 pt-1 pb-1 flex-shrink-0">
                <span className="text-xs" style={{ color: 'var(--ink-4)' }}>
                  멤버 선택{' '}
                  <span style={{ color: selected.length >= 2 ? 'var(--brand)' : 'var(--ink-4)' }}>
                    ({selected.length}명 선택)
                  </span>
                  <span style={{ color: 'var(--ink-4)' }}> — 2명 이상</span>
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <UserPicker
                  mode="multi"
                  selected={selected}
                  onChange={setSelected}
                  excludeId={user?.id}
                />
              </div>

              {/* 생성 버튼 */}
              <div className="px-4 py-4 flex-shrink-0 border-t" style={{ borderColor: 'var(--line)' }}>
                <button
                  onClick={handleCreateGroup}
                  disabled={!groupReady || creating}
                  className="w-full py-2.5 rounded-lg font-semibold text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                  style={{ background: 'var(--brand)' }}
                >
                  {creating ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      생성 중…
                    </span>
                  ) : (
                    `그룹 만들기${selected.length >= 2 ? ` (${selected.length + 1}명)` : ''}`
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SelectedChips({
  selectedIds,
  onRemove,
  excludeId,
}: {
  selectedIds: string[]
  onRemove:    (id: string) => void
  excludeId?:  string
}) {
  const [profiles, setProfiles] = useState<{ id: string; name: string; avatar_url: string | null; avatar_color: string | null }[]>([])

  useEffect(() => {
    fetchActiveProfiles(excludeId).then(ps =>
      setProfiles(ps.filter(p => selectedIds.includes(p.id))),
    )
  }, [selectedIds, excludeId])

  if (!profiles.length) return null

  return (
    <div className="flex flex-wrap gap-1.5 px-4 pb-2 flex-shrink-0">
      {profiles.map(p => (
        <span
          key={p.id}
          className="flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full text-xs border"
          style={{
            background: 'rgba(51,144,236,0.1)',
            color: 'var(--ink)',
            borderColor: 'rgba(51,144,236,0.25)',
          }}
        >
          <Avatar name={p.name} avatarUrl={p.avatar_url} avatarColor={p.avatar_color} size="xs" />
          {p.name}
          <button
            onClick={() => onRemove(p.id)}
            className="ml-0.5 transition-colors leading-none"
            style={{ color: 'var(--ink-4)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-4)')}
            aria-label={`${p.name} 제거`}
          >✕</button>
        </span>
      ))}
    </div>
  )
}
