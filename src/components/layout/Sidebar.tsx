import { SquarePen, LogOut, Search, MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useRooms } from '../../hooks/useRooms'
import { Avatar } from '../ui/Avatar'
import { RoomList } from '../chat/RoomList'
import { FriendsList } from '../chat/FriendsList'
import { SidebarTabs, type SidebarTab } from '../chat/SidebarTabs'

interface Props {
  selectedRoomId: string | null
  onSelectRoom:   (id: string) => void
  onNewChat:      () => void
  activeTab:      SidebarTab
  onTabChange:    (tab: SidebarTab) => void
  onSelectFriend: (userId: string) => void
}

export function Sidebar({
  selectedRoomId, onSelectRoom, onNewChat,
  activeTab, onTabChange, onSelectFriend,
}: Props) {
  const { t } = useTranslation()
  const { profile, user, signOut } = useAuth()
  const { rooms, loading } = useRooms()

  return (
    <div className="flex flex-col h-full">

      {/* ── 헤더 ─────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-3 flex-shrink-0
                          bg-white dark:bg-surface-panel
                          border-b border-gray-200 dark:border-[#374045]">
        <div className="flex items-center gap-2.5">
          <div className="bg-white rounded-lg p-1 shadow-sm border border-gray-100 dark:border-0 dark:shadow-none">
            <img src="/mtl-logo.png" alt="MTL" className="h-7 w-auto object-contain" />
          </div>
          <span className="font-display font-bold text-[17px] tracking-wide
                           text-mtl-navy dark:text-[#e9edef]">
            MTL LINK
          </span>
        </div>
        <button
          onClick={onNewChat}
          className="p-2 rounded-full
                     hover:bg-gray-100 dark:hover:bg-surface-hover
                     text-gray-500 dark:text-[#aebac1] transition-colors"
          aria-label="새 채팅"
        >
          <SquarePen size={19} />
        </button>
      </header>

      {/* ── 탭 ───────────────────────────────────────── */}
      <SidebarTabs active={activeTab} onChange={onTabChange} />

      {/* ── 채팅 탭 ──────────────────────────────────── */}
      {activeTab === 'chat' && (
        <>
          <div className="px-3 py-2 flex-shrink-0 bg-[#f9f9f9] dark:bg-surface">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg
                            bg-white dark:bg-surface-input
                            border border-gray-200 dark:border-0">
              <Search size={15} className="text-gray-400 dark:text-[#8696a0] flex-shrink-0" />
              <input
                type="text"
                placeholder={t('searchChat')}
                readOnly
                className="flex-1 bg-transparent text-sm outline-none cursor-default
                           text-gray-700 dark:text-[#e9edef]
                           placeholder-gray-400 dark:placeholder-[#8696a0]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin bg-white dark:bg-surface">
            {rooms.length === 0 && !loading
              ? <EmptyRoomList onNewChat={onNewChat} t={t} />
              : (
                <RoomList
                  rooms={rooms}
                  loading={loading}
                  selectedRoomId={selectedRoomId}
                  currentUserId={user?.id ?? ''}
                  onSelectRoom={onSelectRoom}
                />
              )
            }
          </div>
        </>
      )}

      {/* ── 친구 탭 ──────────────────────────────────── */}
      {activeTab === 'friends' && (
        <div className="flex flex-col flex-1 min-h-0">
          <FriendsList onSelectFriend={onSelectFriend} />
        </div>
      )}

      {/* ── 프로필 푸터 ──────────────────────────────── */}
      {profile && (
        <footer className="flex items-center gap-3 px-4 py-3 flex-shrink-0
                           bg-[#f0f0f0] dark:bg-surface-panel
                           border-t border-gray-200 dark:border-[#374045]">
          <Avatar name={profile.name} avatarUrl={profile.avatar_url} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-gray-900 dark:text-[#e9edef]">
              {profile.name}
            </p>
            {(profile.department || profile.position) && (
              <p className="text-xs truncate text-gray-400 dark:text-[#8696a0]">
                {[profile.department, profile.position].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <button
            onClick={signOut}
            className="p-2 rounded-full
                       hover:bg-gray-200 dark:hover:bg-surface-hover
                       text-gray-400 dark:text-[#8696a0]
                       hover:text-gray-700 dark:hover:text-[#e9edef] transition-colors"
            aria-label="로그아웃"
          >
            <LogOut size={17} />
          </button>
        </footer>
      )}
    </div>
  )
}

function EmptyRoomList({ onNewChat, t }: { onNewChat: () => void; t: (k: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
      <div className="w-16 h-16 rounded-full
                      bg-gray-100 dark:bg-surface-panel
                      flex items-center justify-center mb-4">
        <MessageSquare size={28} className="text-gray-300 dark:text-[#8696a0]" />
      </div>
      <p className="text-sm font-medium text-gray-500 dark:text-[#8696a0] mb-1">
        {t('noRooms')}
      </p>
      <p className="text-xs text-gray-400 dark:text-[#556e78] mb-5 leading-relaxed whitespace-pre-line">
        {t('noRoomsDesc')}
      </p>
      <button
        onClick={onNewChat}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold
                   bg-mtl-navy dark:bg-accent text-white
                   hover:bg-mtl-navy/90 dark:hover:bg-accent-hover transition-colors"
      >
        <SquarePen size={13} />
        {t('newChatBtn')}
      </button>
    </div>
  )
}
