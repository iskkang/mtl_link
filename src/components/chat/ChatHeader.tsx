import { ArrowLeft, Globe, ChevronDown, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../ui/Avatar'
import { ChatHeaderMenu } from './ChatHeaderMenu'
import { getLangName } from '../../lib/langFlags'

interface Props {
  hasRoom:       boolean
  displayName:   string | null
  avatarInfo:    { name: string; avatarUrl: string | null } | null
  isGroup:       boolean
  isDirect:      boolean
  isOwner:       boolean
  headerSubtitle: string
  onBack?:       () => void

  effectivePeerLang: string | null
  onOpenTranslation: () => void

  searchOpen:     boolean
  onToggleSearch: () => void

  notifEnabled:  boolean
  onToggleNotif: () => void
  onLeave:       () => void
  onDelete:      () => void
}

export function ChatHeader({
  hasRoom, displayName, avatarInfo, isGroup, isDirect, isOwner, headerSubtitle,
  onBack,
  effectivePeerLang, onOpenTranslation,
  searchOpen, onToggleSearch,
  notifEnabled, onToggleNotif, onLeave, onDelete,
}: Props) {
  const { t } = useTranslation()

  return (
    <header
      className="flex items-center justify-between px-4 py-2.5 flex-shrink-0 chat-header"
      style={{
        background:   'var(--card)',
        borderBottom: '1px solid var(--line)',
        boxShadow:    'var(--shadow-header)',
      }}
    >
      {/* Left: back button + room info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {onBack && (
          <button
            onClick={onBack}
            className="md:hidden p-1.5 rounded-full flex-shrink-0 transition-colors
                       hover:bg-gray-100 dark:hover:bg-[#1E293B]
                       text-gray-500 dark:text-[#94A3B8]"
            aria-label={t('backBtn')}
          >
            <ArrowLeft size={20} />
          </button>
        )}

        {hasRoom && displayName && avatarInfo ? (
          <div className="flex items-center gap-3 min-w-0">
            {isGroup ? (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold"
                style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
              >
                {(displayName ?? '그룹').slice(0, 2)}
              </div>
            ) : (
              <div className="relative flex-shrink-0">
                <Avatar name={avatarInfo.name} avatarUrl={avatarInfo.avatarUrl} size="sm" />
                <span
                  className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                  style={{ background: 'var(--green)', borderColor: 'var(--card)' }}
                />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[13px] font-semibold truncate leading-tight" style={{ color: 'var(--ink)' }}>
                {displayName}
              </p>
              <p className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--ink-3)' }}>
                {headerSubtitle}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <img src="/mtl-logo.png" alt="MTL" className="h-8 w-auto object-contain" />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                MTL Shipping Agency
              </p>
              <p className="text-xs" style={{ color: 'var(--ink-3)' }}>{t('companySubtitle')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Right: translation chip (desktop) + search + menu */}
      <div className="flex items-center gap-1 flex-shrink-0 ml-2">

        {/* Translation chip — desktop only */}
        {hasRoom && (
          <button
            onClick={() => !isGroup && onOpenTranslation()}
            disabled={isGroup}
            className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-full font-medium
                       transition-colors border"
            style={{
              borderColor: 'rgba(51,144,236,0.3)',
              color:       'var(--brand)',
              background:  'rgba(51,144,236,0.05)',
              cursor:      isGroup ? 'default' : 'pointer',
            }}
            title={isGroup ? '' : '번역 언어 설정'}
          >
            {isGroup ? (
              <Globe size={14} />
            ) : effectivePeerLang ? (
              <>
                <span className="text-[11px] font-semibold" style={{ color: 'var(--ink-3)' }}>→</span>
                <span className="text-[11px] font-semibold">{getLangName(effectivePeerLang)}</span>
                <ChevronDown size={10} />
              </>
            ) : (
              <>
                <Globe size={13} />
                <ChevronDown size={10} />
              </>
            )}
          </button>
        )}

        {/* Search + menu — when a room is open */}
        {hasRoom && (
          <>
            <button
              onClick={onToggleSearch}
              className="p-2 rounded-lg transition-colors"
              style={{ color: searchOpen ? 'var(--brand)' : 'var(--ink-3)', background: 'transparent' }}
              onMouseEnter={e => { if (!searchOpen) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)' }}
              onMouseLeave={e => { if (!searchOpen) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              title="메시지 검색"
            >
              <Search size={17} />
            </button>

            <ChatHeaderMenu
              notifEnabled={notifEnabled}
              onToggleNotif={onToggleNotif}
              isOwner={isOwner}
              isDirect={isDirect}
              onLeave={onLeave}
              onDelete={onDelete}
            />
          </>
        )}
      </div>
    </header>
  )
}
