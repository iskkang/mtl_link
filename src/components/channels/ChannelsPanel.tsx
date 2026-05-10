import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Hash, Search, Loader2, Users } from 'lucide-react'
import { fetchPublicChannels, joinChannel } from '../../services/roomService'
import { useRoomStore } from '../../stores/roomStore'
import { fetchRooms } from '../../services/roomService'
import type { PublicChannel } from '../../services/roomService'

interface Props {
  onSelectRoom?: (id: string) => void
}

export function ChannelsPanel({ onSelectRoom }: Props) {
  const { t } = useTranslation()
  const [channels, setChannels] = useState<PublicChannel[]>([])
  const [query,    setQuery]    = useState('')
  const [loading,  setLoading]  = useState(true)
  const [joining,  setJoining]  = useState<string | null>(null)
  const setRooms = useRoomStore(s => s.setRooms)

  const load = useCallback(() => {
    setLoading(true)
    fetchPublicChannels()
      .then(setChannels)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = channels.filter(ch =>
    ch.name.toLowerCase().includes(query.toLowerCase()) ||
    (ch.description ?? '').toLowerCase().includes(query.toLowerCase())
  )

  const handleJoin = async (ch: PublicChannel) => {
    if (ch.isJoined || joining) return
    setJoining(ch.id)
    try {
      await joinChannel(ch.id)
      setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, isJoined: true, memberCount: c.memberCount + 1 } : c))
      const rooms = await fetchRooms()
      setRooms(rooms)
      onSelectRoom?.(ch.id)
    } finally {
      setJoining(null)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 검색 */}
      <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--side-line)' }}>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'var(--side-row)' }}
        >
          <Search size={13} style={{ color: 'var(--side-mute)', flexShrink: 0 }} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('channelSearch')}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--side-text)' }}
          />
        </div>
      </div>

      {/* 채널 목록 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--side-mute)' }} />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <Hash size={28} style={{ color: 'var(--side-mute)' }} />
            <p className="text-sm" style={{ color: 'var(--side-mute)' }}>{t('channelEmpty')}</p>
          </div>
        )}

        {!loading && filtered.map(ch => (
          <div
            key={ch.id}
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: '1px solid var(--side-line)' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(99,102,241,0.12)', color: '#6366F1' }}
            >
              <Hash size={14} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--side-text)' }}>
                {ch.name}
              </p>
              {ch.description && (
                <p className="text-xs truncate" style={{ color: 'var(--side-mute)' }}>
                  {ch.description}
                </p>
              )}
              <div className="flex items-center gap-1 mt-0.5" style={{ color: 'var(--side-mute)' }}>
                <Users size={10} />
                <span className="text-[10px]">{t('channelBrowseMembers', { count: ch.memberCount })}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleJoin(ch)}
              disabled={ch.isJoined || joining === ch.id}
              className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors"
              style={{
                background: ch.isJoined ? 'transparent' : 'var(--brand)',
                color:      ch.isJoined ? 'var(--side-mute)' : '#fff',
                border:     `1px solid ${ch.isJoined ? 'var(--side-line)' : 'var(--brand)'}`,
                cursor:     ch.isJoined ? 'default' : 'pointer',
              }}
            >
              {joining === ch.id
                ? <Loader2 size={11} className="animate-spin" />
                : ch.isJoined ? t('channelJoined') : t('channelJoin')
              }
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
