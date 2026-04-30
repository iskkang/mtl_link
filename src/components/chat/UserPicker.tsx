import { useState, useEffect, useMemo } from 'react'
import { Search, Check, Loader2 } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { fetchActiveProfiles } from '../../services/profileService'
import type { Profile } from '../../types/chat'

interface Props {
  mode:       'single' | 'multi'
  selected:   string[]
  onChange:   (ids: string[]) => void
  excludeId?: string
  /** single 모드에서 선택 즉시 호출 (방 생성 트리거) */
  onPickSingle?: (userId: string) => void
  /** 현재 생성 중인 1:1 대상 userId — 로딩 인디케이터용 */
  loadingId?: string | null
}

export function UserPicker({ mode, selected, onChange, excludeId, onPickSingle, loadingId }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [fetching, setFetching] = useState(true)
  const [search,   setSearch]   = useState('')

  useEffect(() => {
    setFetching(true)
    fetchActiveProfiles(excludeId)
      .then(setProfiles)
      .catch(console.error)
      .finally(() => setFetching(false))
  }, [excludeId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.department?.toLowerCase().includes(q) ||
      p.position?.toLowerCase().includes(q),
    )
  }, [profiles, search])

  const toggle = (id: string) => {
    if (mode === 'single') {
      onPickSingle?.(id)
      return
    }
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  if (fetching) {
    return (
      <div className="flex flex-col gap-2 px-1 py-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-surface-hover animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 bg-gray-200 dark:bg-surface-hover rounded animate-pulse" />
              <div className="h-2.5 w-32 bg-gray-100 dark:bg-[#374045] rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* 검색 */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg
                        bg-gray-100 dark:bg-surface-input">
          <Search size={14} className="text-gray-400 dark:text-[#8696a0] flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 부서로 검색"
            className="flex-1 bg-transparent text-sm outline-none
                       text-gray-700 dark:text-[#e9edef]
                       placeholder-gray-400 dark:placeholder-[#8696a0]"
            autoFocus
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-[#e9edef] text-xs"
            >✕</button>
          )}
        </div>
      </div>

      {/* 유저 목록 */}
      <div className="overflow-y-auto scrollbar-thin flex-1">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-400 dark:text-[#8696a0] py-8">
            {search ? '검색 결과가 없습니다' : '사용자가 없습니다'}
          </p>
        ) : (
          filtered.map(profile => {
            const isSelected = selected.includes(profile.id)
            const isLoading  = loadingId === profile.id

            return (
              <button
                key={profile.id}
                onClick={() => toggle(profile.id)}
                disabled={isLoading}
                className={`
                  w-full flex items-center gap-3 px-4 py-2.5 text-left
                  transition-colors duration-100
                  ${isSelected && mode === 'multi'
                    ? 'bg-accent/10 dark:bg-accent/10'
                    : 'hover:bg-gray-50 dark:hover:bg-surface-hover'
                  }
                  disabled:opacity-60
                `}
              >
                {/* 아바타 */}
                <div className="relative flex-shrink-0">
                  <Avatar name={profile.name} avatarUrl={profile.avatar_url} size="sm" />
                  {isLoading && (
                    <div className="absolute inset-0 rounded-full bg-black/20 flex items-center justify-center">
                      <Loader2 size={14} className="animate-spin text-white" />
                    </div>
                  )}
                </div>

                {/* 이름 + 부서 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-gray-900 dark:text-[#e9edef]">
                    {profile.name}
                  </p>
                  {(profile.department || profile.position) && (
                    <p className="text-xs truncate text-gray-400 dark:text-[#8696a0]">
                      {[profile.department, profile.position].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>

                {/* 선택 표시 */}
                {mode === 'multi' && (
                  <div className={`
                    w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                    transition-colors
                    ${isSelected
                      ? 'bg-accent border-accent'
                      : 'border-gray-300 dark:border-[#556e78]'
                    }
                  `}>
                    {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
