import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Globe, ChevronDown, Search, Pin, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../ui/Avatar'
import { ChatHeaderMenu } from './ChatHeaderMenu'
import { StatusDot } from '../profile/StatusDot'
import { getLangName } from '../../lib/langFlags'
import { ChannelMembersPopover } from './ChannelMembersPopover'
import type { PresenceStatus } from '../profile/StatusDot'

interface Props {
  hasRoom:       boolean
  displayName:   string | null
  avatarInfo:    { name: string; avatarUrl: string | null; avatarColor?: string | null } | null
  isGroup:       boolean
  isDirect:      boolean
  isOwner:       boolean
  headerSubtitle: string
  onBack?:       () => void

  peerStatus?:        PresenceStatus | null
  peerStatusMessage?: string | null

  effectivePeerLang: string | null
  onOpenTranslation: () => void

  searchOpen:     boolean
  onToggleSearch: () => void

  notifEnabled:    boolean
  onToggleNotif:   () => void
  isAnnouncement?: boolean
  isChannel?:      boolean
  isMintDm?:       boolean
  onLeave:         () => void
  onDelete:        () => void
  pinnedCount?:    number
  onTogglePinPanel?:       () => void
  onToggleChannelSettings?: () => void
  roomId?: string
}

export function ChatHeader({
  hasRoom, displayName, avatarInfo, isGroup, isDirect, isOwner, headerSubtitle,
  onBack,
  peerStatus, peerStatusMessage,
  effectivePeerLang, onOpenTranslation,
  searchOpen, onToggleSearch,
  notifEnabled, onToggleNotif, isAnnouncement, isChannel, isMintDm, onLeave, onDelete,
  pinnedCount, onTogglePinPanel, onToggleChannelSettings, roomId,
}: Props) {
  const { t } = useTranslation()
  const [membersOpen, setMembersOpen] = useState(false)
  const membersContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!membersOpen) return
    const onMouseDown = (e: MouseEvent) => {
      if (membersContainerRef.current && !membersContainerRef.current.contains(e.target as Node)) {
        setMembersOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setMembersOpen(false) }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [membersOpen])

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
            className="md:hidden p-1.5 rounded-full flex-shrink-0 transition-colors"
            style={{ color: 'var(--ink-3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
                <Avatar name={avatarInfo.name} avatarUrl={avatarInfo.avatarUrl} avatarColor={avatarInfo.avatarColor} size="sm" />
                <span className="absolute bottom-0 right-0">
                  <StatusDot
                    status={peerStatus ?? 'online'}
                    size={10}
                    showOffline
                  />
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[13px] font-semibold truncate leading-tight" style={{ color: 'var(--ink)' }}>
                {displayName}
              </p>
              {isChannel && roomId ? (
                <div ref={membersContainerRef} className="relative">
                  <button
                    onClick={() => setMembersOpen(o => !o)}
                    className="text-[11px] leading-tight mt-0.5 truncate max-w-full text-left"
                    style={{ color: 'var(--ink-3)', textDecoration: membersOpen ? 'underline' : undefined }}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = membersOpen ? 'underline' : 'none')}
                  >
                    {headerSubtitle}
                  </button>
                  {membersOpen && <ChannelMembersPopover roomId={roomId} />}
                </div>
              ) : (
                <p className="text-[11px] leading-tight mt-0.5 truncate" style={{ color: 'var(--ink-3)' }}>
                  {peerStatusMessage || headerSubtitle}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <img src="/mtl-logo.png" alt="MTL" className="h-8 w-auto object-contain" />
            <div>
              <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                MTL Shipping Agency
              </p>
              <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>{t('companySubtitle')}</p>
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

            {onTogglePinPanel && (
              <button
                onClick={onTogglePinPanel}
                className="relative p-2 rounded-lg transition-colors"
                style={{ color: 'var(--ink-3)', background: 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                aria-label={t('pinnedMessages')}
                title={t('pinnedMessages')}
              >
                <Pin size={17} />
                {!!pinnedCount && pinnedCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full
                               text-[9px] font-bold flex items-center justify-center"
                    style={{ background: 'var(--brand)', color: '#fff' }}
                  >
                    {pinnedCount}
                  </span>
                )}
              </button>
            )}

            {isChannel && onToggleChannelSettings && (
              <button
                onClick={onToggleChannelSettings}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--ink-3)', background: 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                title={t('channelSettings')}
              >
                <Settings size={17} />
              </button>
            )}

            <ChatHeaderMenu
              notifEnabled={notifEnabled}
              onToggleNotif={onToggleNotif}
              isOwner={isOwner}
              isDirect={isDirect}
              isMintDm={isMintDm}
              isAnnouncement={isAnnouncement}
              onLeave={onLeave}
              onDelete={onDelete}
            />
          </>
        )}
      </div>
    </header>
  )
}
