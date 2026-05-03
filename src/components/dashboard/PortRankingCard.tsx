import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Anchor, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { DashboardCard } from './DashboardCard'

interface PortEntry { port: string; current: number; previous: number; yoyPct: number }
interface PortsData  { ports: PortEntry[]; title: string; fetchedAt: string }

const CACHE_KEY = 'mtl_dashboard_ports_v1'
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 h

function loadCache(): PortsData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts }: { data: PortsData; ts: number } = JSON.parse(raw)
    return Date.now() - ts < CACHE_TTL ? data : null
  } catch { return null }
}

function saveCache(d: PortsData) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: d, ts: Date.now() })) }
  catch { /* quota */ }
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-2 py-1">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="h-5 rounded animate-pulse" style={{ background: 'var(--bg-primary)' }} />
      ))}
    </div>
  )
}

function PortBar({ entry, maxVal }: { entry: PortEntry; maxVal: number }) {
  const pct     = maxVal > 0 ? (entry.current / maxVal) * 100 : 0
  const up      = entry.yoyPct >= 0
  const yoyTxt  = `${up ? '+' : ''}${entry.yoyPct.toFixed(1)}%`

  return (
    <div className="flex flex-col gap-0.5 py-1.5" style={{ borderBottom: '1px solid var(--line)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium truncate flex-1" style={{ color: 'var(--ink)' }}>
          {entry.port}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--ink-3)' }}>
            {entry.current.toLocaleString()}
          </span>
          <span
            className="text-[9px] font-semibold px-1 py-0.5 rounded"
            style={{
              background: up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color:      up ? 'var(--green)'          : 'var(--red)',
            }}
          >
            {yoyTxt}
          </span>
        </div>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: 'var(--brand)' }}
        />
      </div>
    </div>
  )
}

export function PortRankingCard() {
  const { t } = useTranslation()
  const cached = loadCache()
  const [data,    setData]    = useState<PortsData | null>(cached)
  const [loading, setLoading] = useState<boolean>(!cached)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: res, error: fnErr } = await supabase.functions.invoke<PortsData>('dashboard-data', {
        body: { type: 'ports' },
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

  const ports  = data?.ports.slice(0, 10) ?? []
  const maxVal = ports[0]?.current ?? 1

  return (
    <DashboardCard title={t('dashPorts')} icon={Anchor}>
      <div className="flex items-center justify-end mb-1">
        <button
          onClick={load}
          disabled={loading}
          className="p-0.5 rounded transition-opacity hover:opacity-60 disabled:opacity-30"
          style={{ color: 'var(--ink-4)' }}
          title={t('dashPortsRetry')}
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !data ? (
        <Skeleton />
      ) : error && !data ? (
        <div className="flex flex-col items-center py-6 gap-2">
          <p className="text-[11px]" style={{ color: 'var(--ink-4)' }}>{t('dashPortsError')}</p>
          <button onClick={load} className="text-[11px] font-medium" style={{ color: 'var(--brand)' }}>
            {t('dashPortsRetry')}
          </button>
        </div>
      ) : (
        <div>
          {ports.map(entry => (
            <PortBar key={entry.port} entry={entry} maxVal={maxVal} />
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
