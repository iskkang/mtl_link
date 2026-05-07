import { useEffect, useRef } from 'react'
import { Avatar } from '../ui/Avatar'

interface MentionMember {
  id:           string
  name:         string
  avatar_url?:  string | null
  avatar_color?: string | null
}

interface Props {
  query:         string
  members:       MentionMember[]
  selectedIndex: number
  onSelect:      (member: MentionMember) => void
}

export function MentionPopup({ query, members, selectedIndex, onSelect }: Props) {
  const listRef    = useRef<HTMLUListElement>(null)
  const q          = query.toLowerCase()
  const candidates = members
    .filter(m => m.name.toLowerCase().includes(q))
    .slice(0, 6)

  // 선택된 항목을 뷰포트 안으로 스크롤
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!candidates.length) return null

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-1 rounded-xl overflow-hidden z-50"
      style={{
        background:  'var(--card)',
        border:      '1px solid var(--line)',
        boxShadow:   'var(--shadow-lg)',
        maxHeight:   '200px',
        overflowY:   'auto',
      }}
    >
      <ul ref={listRef}>
        {candidates.map((member, idx) => (
          <li key={member.id}>
            <button
              type="button"
              // onMouseDown prevents textarea blur before click fires
              onMouseDown={e => e.preventDefault()}
              onClick={() => onSelect(member)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
              style={{
                background: idx === selectedIndex ? 'var(--bg-hover)' : 'transparent',
                color:      'var(--ink)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = idx === selectedIndex ? 'var(--bg-hover)' : 'transparent')}
            >
              <Avatar name={member.name} avatarUrl={member.avatar_url} avatarColor={member.avatar_color} size="xs" />
              <span className="text-sm font-medium truncate">{member.name}</span>
              <span className="text-xs ml-auto flex-shrink-0" style={{ color: 'var(--brand)' }}>@</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
