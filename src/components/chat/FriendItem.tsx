import { Avatar } from '../ui/Avatar'
import { SUPPORTED_LANGS } from '../../lib/i18n'
import type { FriendProfile } from '../../services/friendsService'

interface Props {
  friend:         FriendProfile
  isOnline:       boolean
  onViewProfile:  () => void
}

const langFlag = (code: string | null) =>
  SUPPORTED_LANGS.find(l => l.code === code)?.flag ?? null

export function FriendItem({ friend, isOnline, onViewProfile }: Props) {
  const flag = langFlag(friend.preferred_language)

  return (
    <button
      type="button"
      onClick={onViewProfile}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left
                 hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors"
    >
      <div className="relative flex-shrink-0">
        <Avatar name={friend.name} avatarUrl={friend.avatar_url} size="sm" />
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full
                      border-2 border-white dark:border-surface
                      ${isOnline ? 'bg-emerald-400' : 'bg-gray-300 dark:bg-[#556e78]'}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-gray-900 dark:text-[#e9edef]">
          {friend.name}
        </p>
        {friend.position && (
          <p className="text-xs truncate text-gray-400 dark:text-[#8696a0]">
            {friend.position}
          </p>
        )}
      </div>
      {flag && (
        <span className="text-base flex-shrink-0" title={friend.preferred_language ?? ''}>
          {flag}
        </span>
      )}
    </button>
  )
}
