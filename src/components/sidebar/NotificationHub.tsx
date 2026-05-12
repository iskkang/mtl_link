import { useState } from 'react'
import { Inbox, MessageSquare, AtSign } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRoomStore } from '../../stores/roomStore'
import type { Section } from '../layout/MenuRail'

interface Props {
  onSectionChange: (s: Section) => void
}

export function NotificationHub({ onSectionChange }: Props) {
  const { t }    = useTranslation()
  const [tipKey, setTipKey] = useState<string | null>(null)

  const totalUnread  = useRoomStore(s => s.rooms.reduce((sum, r) => sum + (r.unread_count ?? 0), 0))
  const threadUnread = useRoomStore(s => Object.values(s.threadUnread).reduce((sum, v) => sum + v, 0))

  const showTip = (key: string) => {
    setTipKey(key)
    setTimeout(() => setTipKey(null), 2500)
  }

  return (
    <nav
      className="flex-shrink-0 border-b py-1"
      style={{ borderColor: 'var(--side-line)' }}
    >
      {tipKey && (
        <div
          className="mx-3 mb-1 px-3 py-1.5 rounded-lg text-[11px] text-center"
          style={{ background: 'var(--side-row)', color: 'var(--side-mute)' }}
        >
          {t('comingSoon')}
        </div>
      )}

      <HubItem
        icon={<Inbox size={15} />}
        label={t('navAllUnread')}
        badge={totalUnread > 0 ? fmtBadge(totalUnread) : null}
        badgeBg="#D85A30"
        onClick={() => onSectionChange('all-unread')}
      />
      <HubItem
        icon={<MessageSquare size={15} />}
        label={t('navThreads')}
        badge={threadUnread > 0 ? fmtBadge(threadUnread) : null}
        badgeBg="#D4537E"
        onClick={() => onSectionChange('threads')}
      />
      <HubItem
        icon={<AtSign size={15} />}
        label={t('navMentions')}
        onClick={() => showTip('mentions')}
      />
    </nav>
  )
}

function HubItem({
  icon, label, badge, badgeBg, muted, onClick,
}: {
  icon:      React.ReactNode
  label:     string
  badge?:    string | null
  badgeBg?:  string
  muted?:    boolean
  onClick:   () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-1.5 transition-colors text-left"
      style={{ color: muted ? 'var(--side-mute)' : 'var(--side-text)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div className="flex items-center gap-2.5">
        <span style={{ color: 'var(--side-mute)', display: 'flex' }}>{icon}</span>
        <span className="text-[13px]">{label}</span>
      </div>
      {badge && (
        <span
          className="text-[10px] font-semibold px-1.5 py-px rounded-full text-white"
          style={{ background: badgeBg ?? '#D85A30' }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

function fmtBadge(n: number): string {
  return n > 9 ? '9+' : String(n)
}
