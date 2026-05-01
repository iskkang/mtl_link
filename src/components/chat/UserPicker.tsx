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
  onPickSingle?: (userId: string) => void
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
            <div className="w-9 h-9 rounded-full animate-pulse flex-shrink-0" style={{ background: 'var(--line)' }} />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 rounded animate-pulse" style={{ background: 'var(--line)' }} />
              <div className="h-2.5 w-32 rounded animate-pulse" style={{ background: 'var(--bg)' }} />
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
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'var(--bg)' }}
        >
          <Search size={14} className="flex-shrink-0" style={{ color: 'var(--ink-4)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 부서로 검색"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--ink)' }}
            autoFocus
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-xs transition-colors"
              style={{ color: 'var(--ink-4)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-4)')}
            >✕</button>
          )}
        </div>
      </div>

      {/* 유저 목록 */}
      <div className="overflow-y-auto scrollbar-thin flex-1">
        {filtered.length === 0 ? (
          <p className="text-center text-sm py-8" style={{ color: 'var(--ink-4)' }}>
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
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 disabled:opacity-60"
                style={{ background: isSelected && mode === 'multi' ? 'rgba(37,99,235,0.08)' : 'transparent' }}
                onMouseEnter={e => {
                  if (!(isSelected && mode === 'multi'))
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    isSelected && mode === 'multi' ? 'rgba(37,99,235,0.08)' : 'transparent'
                }}
              >
                <div className="relative flex-shrink-0">
                  <Avatar name={profile.name} avatarUrl={profile.avatar_url} size="sm" />
                  {isLoading && (
                    <div className="absolute inset-0 rounded-full bg-black/20 flex items-center justify-center">
                      <Loader2 size={14} className="animate-spin text-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                    {profile.name}
                  </p>
                  {(profile.department || profile.position) && (
                    <p className="text-xs truncate" style={{ color: 'var(--ink-4)' }}>
                      {[profile.department, profile.position].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>

                {mode === 'multi' && (
                  <div
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                    style={isSelected
                      ? { background: 'var(--blue)', borderColor: 'var(--blue)' }
                      : { background: 'transparent', borderColor: 'var(--line)' }
                    }
                  >
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
