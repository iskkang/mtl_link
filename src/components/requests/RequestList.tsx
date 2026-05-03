import { useEffect, useState, useCallback } from 'react'
import { Search, Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { getReceivedRequests, getSentRequests, type RequestItem } from '../../services/requestService'
import { RequestListItem } from './RequestListItem'
import { EmptyState } from '../ui/EmptyState'

type Tab = 'received' | 'sent'

interface Props {
  onSelectRequest: (roomId: string, messageId: string) => void
}

export function RequestList({ onSelectRequest }: Props) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab]   = useState<Tab>('received')
  const [received,  setReceived]    = useState<RequestItem[]>([])
  const [sent,      setSent]        = useState<RequestItem[]>([])
  const [query,     setQuery]       = useState('')
  const [loading,   setLoading]     = useState(true)

  const load = useCallback(async () => {
    const [r, s] = await Promise.all([getReceivedRequests(), getSentRequests()])
    setReceived(r)
    setSent(s)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()

    const channel = supabase
      .channel('requests-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, load)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [load])

  const items = (activeTab === 'received' ? received : sent).filter(r =>
    !query || r.content.toLowerCase().includes(query.toLowerCase()) || r.sender.name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      {/* 서브 탭 */}
      <div className="flex flex-shrink-0 border-b text-xs" style={{ borderColor: 'var(--side-line)' }}>
        {([['received', t('reqReceived'), received.length], ['sent', t('reqSent'), sent.length]] as const).map(([id, label, count]) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className="flex-1 flex items-center justify-center gap-1 py-2 font-semibold border-b-2 transition-colors"
              style={{
                borderColor: isActive ? 'var(--brand)' : 'transparent',
                color: isActive ? 'var(--side-text)' : 'var(--side-mute)',
              }}
            >
              {label}
              {count > 0 && (
                <span
                  className="min-w-[14px] h-[14px] px-0.5 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                  style={{ background: id === 'received' ? '#EF3F1A' : 'var(--brand)' }}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 검색 */}
      <div className="px-3 py-2 flex-shrink-0">
        <div
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
          style={{ background: 'var(--side-row)' }}
        >
          <Search size={12} className="flex-shrink-0" style={{ color: 'var(--side-mute)' }} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('reqSearchPlaceholder')}
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: 'var(--side-text)' }}
          />
        </div>
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="spinner" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={query ? t('reqNoResult') : activeTab === 'received' ? t('reqNoReceived') : t('reqNoSent')}
            description={query ? undefined : t('emptyRequestsDesc')}
          />
        ) : (
          items.map(req => (
            <RequestListItem
              key={req.message_id}
              request={req}
              onClick={() => onSelectRequest(req.room_id, req.message_id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
