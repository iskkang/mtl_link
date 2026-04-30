import { useState, useEffect, useMemo } from 'react'
import { Search, ChevronDown, ChevronRight, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FriendItem } from './FriendItem'
import { FriendProfileModal } from './FriendProfileModal'
import { fetchFriends, type FriendProfile } from '../../services/friendsService'
import { usePresence } from '../../hooks/usePresence'

const DEPT_ORDER = ['HQ', 'UZ', 'RU', 'JP', 'CN', 'KG', 'VN', 'OTHER']

interface Props {
  onSelectFriend: (userId: string) => void
}

export function FriendsList({ onSelectFriend }: Props) {
  const { t } = useTranslation()
  const [friends,        setFriends]       = useState<FriendProfile[]>([])
  const [loading,        setLoading]       = useState(true)
  const [query,          setQuery]         = useState('')
  const [collapsed,      setCollapsed]     = useState<Record<string, boolean>>({})
  const [profileTarget,  setProfileTarget] = useState<FriendProfile | null>(null)
  const { onlineIds } = usePresence()

  useEffect(() => {
    fetchFriends()
      .then(setFriends)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return friends
    const q = query.toLowerCase()
    return friends.filter(f =>
      f.name.toLowerCase().includes(q) ||
      (f.department ?? '').toLowerCase().includes(q),
    )
  }, [friends, query])

  const { groupMap, deptOrder } = useMemo(() => {
    const map: Record<string, FriendProfile[]> = {}
    for (const f of filtered) {
      const dept = DEPT_ORDER.includes(f.department ?? '') ? f.department! : '기타'
      if (!map[dept]) map[dept] = []
      map[dept].push(f)
    }
    const order = [
      ...DEPT_ORDER.filter(d => map[d]),
      ...(map['기타'] ? ['기타'] : []),
    ]
    return { groupMap: map, deptOrder: order }
  }, [filtered])

  const toggleCollapse = (dept: string) =>
    setCollapsed(prev => ({ ...prev, [dept]: !prev[dept] }))

  return (
    <>
      {/* 검색 */}
      <div className="px-3 py-2 flex-shrink-0 bg-[#f9f9f9] dark:bg-surface">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg
                        bg-white dark:bg-surface-input
                        border border-gray-200 dark:border-0">
          <Search size={15} className="text-gray-400 dark:text-[#8696a0] flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('searchFriends')}
            className="flex-1 bg-transparent text-sm outline-none
                       text-gray-700 dark:text-[#e9edef]
                       placeholder-gray-400 dark:placeholder-[#8696a0]"
          />
        </div>
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin bg-white dark:bg-surface">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="w-5 h-5 rounded-full border-2 border-mtl-cyan/30 border-t-mtl-cyan animate-spin" />
          </div>
        ) : deptOrder.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Users size={28} className="text-gray-300 dark:text-[#556e78] mb-3" />
            <p className="text-sm text-gray-400 dark:text-[#8696a0]">
              {query ? t('friendsNoResult') : t('friendsEmpty')}
            </p>
          </div>
        ) : (
          deptOrder.map(dept => (
            <div key={dept}>
              <button
                type="button"
                onClick={() => toggleCollapse(dept)}
                className="w-full flex items-center gap-1.5 px-4 py-1.5
                           bg-gray-50 dark:bg-surface-panel
                           text-[11px] font-semibold uppercase tracking-wider
                           text-gray-400 dark:text-[#8696a0]
                           hover:bg-gray-100 dark:hover:bg-surface-hover
                           transition-colors"
              >
                {collapsed[dept]
                  ? <ChevronRight size={11} />
                  : <ChevronDown size={11} />}
                {dept} ({groupMap[dept].length})
              </button>
              {!collapsed[dept] && groupMap[dept].map(friend => (
                <FriendItem
                  key={friend.id}
                  friend={friend}
                  isOnline={onlineIds.has(friend.id)}
                  onViewProfile={() => setProfileTarget(friend)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* 프로필 모달 */}
      {profileTarget && (
        <FriendProfileModal
          friend={profileTarget}
          isOnline={onlineIds.has(profileTarget.id)}
          onClose={() => setProfileTarget(null)}
          onMessage={() => onSelectFriend(profileTarget.id)}
        />
      )}
    </>
  )
}
