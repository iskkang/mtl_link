import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { DashboardCard } from './DashboardCard'

interface DisasterEvent {
  id: string; type: string; name: string; country: string
  alertLevel: string; fromDate: string; severity: string | null
}
interface DisasterData { events: DisasterEvent[]; fetchedAt: string }

const CACHE_KEY = 'mtl_dashboard_disasters_v1'
const CACHE_TTL = 60 * 60 * 1000 // 1 h

function loadCache(): DisasterData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts }: { data: DisasterData; ts: number } = JSON.parse(raw)
    return Date.now() - ts < CACHE_TTL ? data : null
  } catch { return null }
}

function saveCache(d: DisasterData) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: d, ts: Date.now() })) }
  catch { /* quota */ }
}

function alertColor(level: string): { bg: string; color: string } {
  switch (level.toLowerCase()) {
    case 'red':    return { bg: 'rgba(239,68,68,0.12)',    color: 'var(--red)' }
    case 'orange': return { bg: 'rgba(249,115,22,0.12)',   color: '#F97316' }
    case 'green':  return { bg: 'rgba(16,185,129,0.10)',   color: 'var(--green)' }
    default:       return { bg: 'rgba(100,116,139,0.10)',  color: 'var(--ink-4)' }
  }
}

function typeLabel(type: string): string {
  if (type === 'TC') return '태풍'
  if (type === 'EQ') return '지진'
  return type
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-2 py-1">
      {[0, 1, 2].map(i => (
        <div key={i} className="h-12 rounded animate-pulse" style={{ background: 'var(--bg-primary)' }} />
      ))}
    </div>
  )
}

function EventRow({ event, last }: { event: DisasterEvent; last: boolean }) {
  const ac = alertColor(event.alertLevel)
  return (
    <div
      className="flex items-start gap-2 py-2"
      style={{ borderBottom: last ? 'none' : '1px solid var(--line)' }}
    >
      {/* Alert badge */}
      <span
        className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
        style={{ background: ac.bg, color: ac.color }}
      >
        {event.alertLevel.toUpperCase()}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold" style={{ color: 'var(--ink-3)' }}>
            [{typeLabel(event.type)}]
          </span>
          <span className="text-[11px] font-medium truncate" style={{ color: 'var(--ink)' }}>
            {event.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>{event.country}</span>
          {event.severity && (
            <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>· {event.severity}</span>
          )}
          <span className="text-[10px] ml-auto tabular-nums" style={{ color: 'var(--ink-4)' }}>
            {event.fromDate}
          </span>
        </div>
      </div>
    </div>
  )
}

export function DisasterCard() {
  const { t } = useTranslation()
  const cached = loadCache()
  const [data,    setData]    = useState<DisasterData | null>(cached)
  const [loading, setLoading] = useState<boolean>(!cached)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: res, error: fnErr } = await supabase.functions.invoke<DisasterData>('dashboard-data', {
        body: { type: 'disasters' },
      })
      if (fnErr) throw new Error(fnErr.message)
      if (!res)  throw new Error('empty response')
      saveCache(res)
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!cached) load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const events = (data?.events ?? []).slice(0, 4)

  return (
    <DashboardCard title={t('dashDisaster')} icon={AlertTriangle}>
      <div className="flex items-center justify-between mb-1 pb-2" style={{ borderBottom: '1px solid var(--line)' }}>
        <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>GDACS · TC / EQ</span>
        <button
          onClick={load}
          disabled={loading}
          className="p-0.5 rounded transition-opacity hover:opacity-60 disabled:opacity-30"
          style={{ color: 'var(--ink-4)' }}
          title={t('dashDisasterRetry')}
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !data ? (
        <Skeleton />
      ) : error && !data ? (
        <div className="flex flex-col items-center py-6 gap-2">
          <p className="text-[11px]" style={{ color: 'var(--ink-4)' }}>{t('dashDisasterError')}</p>
          <button onClick={load} className="text-[11px] font-medium" style={{ color: 'var(--brand)' }}>
            {t('dashDisasterRetry')}
          </button>
        </div>
      ) : events.length === 0 ? (
        <p className="text-[11px] py-4 text-center" style={{ color: 'var(--ink-4)' }}>
          {t('dashDisasterEmpty')}
        </p>
      ) : (
        <div>
          {events.map((ev, i) => (
            <EventRow key={ev.id} event={ev} last={i === events.length - 1} />
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
