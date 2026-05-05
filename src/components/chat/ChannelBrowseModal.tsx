import { useState, useEffect, useCallback } from 'react'
import { X, Hash, Users, Check, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fetchPublicChannels, joinChannel, type PublicChannel } from '../../services/roomService'
import { getUserFriendlyMessage } from '../../lib/errors'

interface Props {
  onJoined: (roomId: string) => void
  onClose:  () => void
}

export function ChannelBrowseModal({ onJoined, onClose }: Props) {
  const { t } = useTranslation()
  const [channels,  setChannels]  = useState<PublicChannel[]>([])
  const [loading,   setLoading]   = useState(true)
  const [query,     setQuery]     = useState('')
  const [joining,   setJoining]   = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    fetchPublicChannels()
      .then(setChannels)
      .catch(err => setError(getUserFriendlyMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleJoin = useCallback(async (ch: PublicChannel) => {
    if (ch.isJoined) { onJoined(ch.id); onClose(); return }
    setJoining(ch.id)
    setError(null)
    try {
      await joinChannel(ch.id)
      onJoined(ch.id)
      onClose()
    } catch (err) {
      setError(getUserFriendlyMessage(err))
      setJoining(null)
    }
  }, [onJoined, onClose])

  const filtered = channels.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    (c.description ?? '').toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="w-full max-w-md rounded-2xl flex flex-col pointer-events-auto"
          style={{
            background:  'var(--card)',
            boxShadow:   'var(--shadow-lg)',
            border:      '1px solid var(--line)',
            maxHeight:   '70vh',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
            style={{ borderColor: 'var(--line)' }}
          >
            <span className="font-semibold text-[15px]" style={{ color: 'var(--ink)' }}>
              {t('channelBrowseTitle')}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg transition-colors"
              style={{ color: 'var(--ink-3)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <X size={16} />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-3 flex-shrink-0">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('channelBrowseSearch')}
              autoFocus
              className="w-full rounded-lg px-3 py-2 text-sm outline-none border"
              style={{
                background:  'var(--bg)',
                color:       'var(--ink)',
                borderColor: 'var(--line)',
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mx-4 mb-2 px-3 py-2 rounded-lg text-xs text-white bg-red-500 flex-shrink-0">
              {error}
            </div>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-3">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--ink-3)' }} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-10 gap-2">
                <Hash size={28} style={{ color: 'var(--ink-4)' }} />
                <p className="text-sm" style={{ color: 'var(--ink-3)' }}>{t('channelBrowseEmpty')}</p>
              </div>
            ) : (
              filtered.map(ch => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => handleJoin(ch)}
                  disabled={joining === ch.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                  style={{ background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Icon */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(99,102,241,0.12)', color: '#6366F1' }}
                  >
                    <Hash size={16} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                        {ch.name}
                      </span>
                      {ch.is_default && (
                        <span
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: 'rgba(99,102,241,0.12)', color: '#6366F1' }}
                        >
                          기본
                        </span>
                      )}
                    </div>
                    {ch.description && (
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--ink-3)' }}>
                        {ch.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-0.5" style={{ color: 'var(--ink-4)' }}>
                      <Users size={10} />
                      <span className="text-[10px]">{t('channelBrowseMembers', { count: ch.memberCount })}</span>
                    </div>
                  </div>

                  {/* Join button */}
                  <div className="flex-shrink-0">
                    {joining === ch.id ? (
                      <Loader2 size={14} className="animate-spin" style={{ color: 'var(--ink-3)' }} />
                    ) : ch.isJoined ? (
                      <span
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A' }}
                      >
                        <Check size={11} />
                        {t('channelBrowseJoined')}
                      </span>
                    ) : (
                      <span
                        className="text-xs px-3 py-1 rounded-full font-medium"
                        style={{ background: 'var(--brand)', color: '#fff' }}
                      >
                        {t('channelBrowseJoin')}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
