import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Avatar } from '../ui/Avatar'

const BOT_USER_ID = '00000000-0000-0000-0000-000000000001'

interface Member {
  id:           string
  name:         string
  avatar_url:   string | null
  avatar_color: string | null
  department:   string | null
  is_bot:       boolean
}

interface Props {
  roomId: string
}

export function ChannelMembersPopover({ roomId }: Props) {
  const { t }    = useTranslation()
  const { user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any)
      .from('room_members')
      .select('profiles!user_id(id, name, avatar_url, avatar_color, department, is_bot)')
      .eq('room_id', roomId)
      .then(({ data }: { data: Array<{ profiles: Member }> | null }) => {
        const list: Member[] = (data ?? []).map(r => r.profiles).filter(Boolean)
        list.sort((a, b) => {
          if (a.id === BOT_USER_ID) return -1
          if (b.id === BOT_USER_ID) return 1
          if (a.id === user?.id)    return -1
          if (b.id === user?.id)    return 1
          const deptCmp = (a.department ?? '').localeCompare(b.department ?? '')
          return deptCmp !== 0 ? deptCmp : a.name.localeCompare(b.name)
        })
        setMembers(list)
        setLoading(false)
      })
  }, [roomId, user?.id])

  return (
    <div
      className="absolute top-full left-0 mt-1 z-50 rounded-xl shadow-lg border overflow-hidden"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--line)',
        minWidth: '200px',
        maxWidth: '260px',
        maxHeight: '320px',
        overflowY: 'auto',
      }}
    >
      <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--line)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>
          {t('membersTitle')}
        </p>
      </div>

      {loading ? (
        <div className="px-3 py-2 space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-2 animate-pulse">
              <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: 'var(--line)' }} />
              <div className="h-2.5 w-24 rounded" style={{ background: 'var(--line)' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="py-1">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-2.5 px-3 py-1.5">
              <Avatar
                name={m.name}
                avatarUrl={m.avatar_url}
                avatarColor={m.avatar_color}
                is_bot={m.is_bot}
                size="xs"
              />
              <span className="text-[12px] truncate flex-1" style={{ color: 'var(--ink)' }}>
                {m.name}
              </span>
              {m.is_bot && (
                <span
                  className="text-[10px] px-1.5 py-px rounded-full font-medium flex-shrink-0"
                  style={{ background: 'rgba(14,165,233,0.1)', color: '#0ea5e9' }}
                >
                  {t('memberBotLabel')}
                </span>
              )}
              {!m.is_bot && m.id === user?.id && (
                <span
                  className="text-[10px] px-1.5 py-px rounded-full font-medium flex-shrink-0"
                  style={{ background: 'var(--bg)', color: 'var(--ink-3)' }}
                >
                  {t('memberSelfLabel')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
