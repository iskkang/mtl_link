import { useState, useEffect } from 'react'
import { Inbox, MessageSquare, AtSign } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRoomStore } from '../../stores/roomStore'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import type { Section } from '../layout/MenuRail'

interface Props {
  activeSection:   Section
  onSectionChange: (s: Section) => void
}

export function NotificationHub({ activeSection, onSectionChange }: Props) {
  const { t }        = useTranslation()
  const { user }     = useAuth()
  const [unreadMentions, setUnreadMentions] = useState(0)

  const totalUnread  = useRoomStore(s => s.rooms.reduce((sum, r) => sum + (r.unread_count ?? 0), 0))
  const threadUnread = useRoomStore(s => Object.values(s.threadUnread).reduce((sum, v) => sum + v, 0))

  useEffect(() => {
    if (!user?.id) return

    const fetch = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).rpc('get_unread_mentions_count', { p_user_id: user.id })
      setUnreadMentions(Number(data) || 0)
    }
    void fetch()

    const channel = supabase
      .channel(`mentions-hub-${user.id}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'mentions',
        filter: `mentioned_user_id=eq.${user.id}`,
      }, () => void fetch())
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'mentions',
        filter: `mentioned_user_id=eq.${user.id}`,
      }, () => void fetch())
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [user?.id])

  return (
    <nav
      className="flex-shrink-0 border-b py-1"
      style={{ borderColor: 'var(--side-line)' }}
    >
      <HubItem
        icon={<Inbox size={15} />}
        label={t('navAllUnread')}
        badge={totalUnread > 0 ? fmtBadge(totalUnread) : null}
        badgeBg="#D85A30"
        active={activeSection === 'all-unread'}
        onClick={() => onSectionChange('all-unread')}
      />
      <HubItem
        icon={<MessageSquare size={15} />}
        label={t('navThreads')}
        badge={threadUnread > 0 ? fmtBadge(threadUnread) : null}
        badgeBg="#D4537E"
        active={activeSection === 'threads'}
        onClick={() => onSectionChange('threads')}
      />
      <HubItem
        icon={<AtSign size={15} />}
        label={t('navMentions')}
        badge={unreadMentions > 0 ? fmtBadge(unreadMentions) : null}
        badgeBg="#7C3AED"
        active={activeSection === 'mentions'}
        onClick={() => onSectionChange('mentions')}
      />
    </nav>
  )
}

function HubItem({
  icon, label, badge, badgeBg, active, muted, onClick,
}: {
  icon:      React.ReactNode
  label:     string
  badge?:    string | null
  badgeBg?:  string
  active?:   boolean
  muted?:    boolean
  onClick:   () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-1.5 transition-colors text-left rounded-lg mx-auto"
      style={{
        color:      active ? '#0C447C' : muted ? 'var(--side-mute)' : 'var(--side-text)',
        background: active ? '#E6F1FB' : 'transparent',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--side-hover)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <div className="flex items-center gap-2.5">
        <span style={{ color: active ? '#0C447C' : 'var(--side-mute)', display: 'flex' }}>{icon}</span>
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
