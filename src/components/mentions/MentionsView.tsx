import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AtSign } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { chatEvents } from '../../lib/aiEvents'
import { Avatar } from '../ui/Avatar'
import { formatMessageTime } from '../../lib/date'

interface MentionRow {
  id:                string
  message_id:        string
  room_id:           string
  created_at:        string
  read_at:           string | null
  mentioner: {
    id:          string
    name:        string
    avatar_url:  string | null
    avatar_color: string | null
  } | null
  message: {
    id:         string
    content:    string | null
    created_at: string
  } | null
  room: {
    id:        string
    name:      string | null
    room_type: string
  } | null
}

interface Props {
  onNavigated: () => void
}

export function MentionsView({ onNavigated }: Props) {
  const { t }        = useTranslation()
  const { user }     = useAuth()
  const [mentions,   setMentions]   = useState<MentionRow[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any)
      .from('mentions')
      .select(`
        id, message_id, room_id, created_at, read_at,
        mentioner:profiles!mentioner_id(id, name, avatar_url, avatar_color),
        message:messages!message_id(id, content, created_at),
        room:rooms!room_id(id, name, room_type)
      `)
      .eq('mentioned_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }: { data: unknown[] | null }) => {
        setMentions((data ?? []) as unknown as MentionRow[])
        setLoading(false)
      })
  }, [user?.id])

  const handleClick = async (mention: MentionRow) => {
    if (!mention.message?.id || !mention.room_id) return

    if (!mention.read_at) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(supabase as any)
        .from('mentions')
        .update({ read_at: new Date().toISOString() })
        .eq('id', mention.id)
        .then(() => {
          setMentions(prev =>
            prev.map(m => m.id === mention.id ? { ...m, read_at: new Date().toISOString() } : m)
          )
        })
    }

    chatEvents.emitNavigateToMessage(mention.room_id, mention.message.id)
    onNavigated()
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-1 p-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-xl animate-pulse" style={{ background: 'var(--side-row)' }}>
            <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ background: 'var(--line)' }} />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 rounded" style={{ background: 'var(--line)' }} />
              <div className="h-2.5 w-40 rounded" style={{ background: 'var(--bg)' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (mentions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 py-12 px-6 text-center">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: 'var(--side-row)' }}
        >
          <AtSign size={22} style={{ color: 'var(--side-mute)' }} />
        </div>
        <p className="text-[13px] font-medium" style={{ color: 'var(--side-text)' }}>
          {t('mentionEmpty')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
      {mentions.map(mention => {
        const isUnread = !mention.read_at
        const preview  = mention.message?.content?.slice(0, 80) ?? '—'

        return (
          <button
            key={mention.id}
            onClick={() => void handleClick(mention)}
            className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors"
            style={{ background: isUnread ? 'rgba(124,58,237,0.04)' : 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = isUnread ? 'rgba(124,58,237,0.08)' : 'var(--side-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = isUnread ? 'rgba(124,58,237,0.04)' : 'transparent')}
          >
            <div className="relative flex-shrink-0">
              {mention.mentioner && (
                <Avatar
                  name={mention.mentioner.name}
                  avatarUrl={mention.mentioner.avatar_url}
                  avatarColor={mention.mentioner.avatar_color}
                  size="sm"
                />
              )}
              {isUnread && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2"
                  style={{ background: '#7C3AED', borderColor: 'var(--side-bg)' }}
                />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--side-text)' }}>
                  {mention.mentioner?.name ?? '—'}
                  {mention.room?.name && (
                    <span className="font-normal ml-1" style={{ color: 'var(--side-mute)' }}>
                      #{mention.room.name}
                    </span>
                  )}
                </span>
                <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--side-mute)' }}>
                  {formatMessageTime(mention.created_at)}
                </span>
              </div>
              <p className="text-[12px] leading-snug line-clamp-2" style={{ color: 'var(--side-mute)' }}>
                {preview}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
