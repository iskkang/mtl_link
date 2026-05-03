import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Anchor, RefreshCw } from 'lucide-react'
import { DashboardCard } from './DashboardCard'

interface PortEntry { port: string; current: number; previous: number; yoyPct: number }
interface PortsData  { ports: PortEntry[]; title: string; currentPeriod: string; prevPeriod: string; fetchedAt: string }

const CACHE_KEY = 'mtl_dashboard_ports_v3'
const CACHE_TTL = 24 * 60 * 60 * 1000

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
        <div key={i} className="h-6 rounded animate-pulse" style={{ background: 'var(--bg-primary)' }} />
      ))}
    </div>
  )
}

function PortBar({ entry }: { entry: PortEntry }) {
  const up     = entry.yoyPct >= 0
  const yoyTxt = `${up ? '+' : ''}${entry.yoyPct.toFixed(1)}%`

  return (
    <div className="flex flex-col gap-0.5 py-1.5" style={{ borderBottom: '1px solid var(--line)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium truncate flex-1" style={{ color: 'var(--ink)' }}>
          {entry.port}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--ink-3)' }}>
            {entry.current.toLocaleString()} K
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
      {/* YoY deviation bar — centered at 50%, positive right, negative left */}
      <div className="relative h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
        {up ? (
          <div
            className="absolute h-full rounded-full"
            style={{
              left:     '50%',
              width:    `${Math.min(Math.abs(entry.yoyPct) * 1.5, 50)}%`,
              background: 'var(--green)',
              opacity: 0.7,
            }}
          />
        ) : (
          <div
            className="absolute h-full rounded-full"
            style={{
              right:    '50%',
              width:    `${Math.min(Math.abs(entry.yoyPct) * 1.5, 50)}%`,
              background: 'var(--red)',
              opacity: 0.7,
            }}
          />
        )}
        {/* Center marker */}
        <div className="absolute top-0 bottom-0 w-px" style={{ left: '50%', background: 'var(--line)' }} />
      </div>
    </div>
  )
}

// API response: plots[0].data = Array<{ name: string; "March 26": number; "March 25": number }>
// series[0].code = current period key, series[1].code = previous period key
async function fetchPortsData(): Promise<PortsData> {
  const res = await fetch(
    'https://www.econdb.com/widgets/top-port-comparison/data/',
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) },
  )
  if (!res.ok) throw new Error(`upstream ${res.status}`)

  const raw = await res.json() as {
    plots?: Array<{
      title?: string
      series?: Array<{ code: string; name: string }>
      data?: Array<Record<string, unknown>>
    }>
  }
  const plot         = raw.plots?.[0]
  const series       = plot?.series ?? []
  const currentKey   = series[0]?.code ?? ''
  const prevKey      = series[1]?.code ?? ''
  const currentName  = series[0]?.name ?? currentKey
  const prevName     = series[1]?.name ?? prevKey

  const ports: PortEntry[] = ((plot?.data ?? []) as Array<Record<string, unknown>>)
    .map(row => {
      const port     = String(row.name ?? '')
      const current  = Number(row[currentKey]  ?? 0)
      const previous = Number(row[prevKey]     ?? 0)
      if (!port || current <= 0) return null
      const yoyPct = previous ? +((current - previous) / previous * 100).toFixed(1) : 0
      return { port, current, previous, yoyPct }
    })
    .filter((e): e is PortEntry => e !== null)
    .sort((a, b) => b.current - a.current)

  return {
    ports,
    title:         String(plot?.title ?? ''),
    currentPeriod: currentName,
    prevPeriod:    prevName,
    fetchedAt:     new Date().toISOString(),
  }
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
      const res = await fetchPortsData()
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

  const ports  = data?.ports ?? []

  return (
    <DashboardCard title={t('dashPorts')} icon={Anchor}>
      {/* Header: period label + refresh */}
      <div className="flex items-center justify-between mb-1">
        {data && (
          <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>
            {data.currentPeriod} vs {data.prevPeriod} · KTEU
          </span>
        )}
        <button
          onClick={load}
          disabled={loading}
          className="p-0.5 rounded transition-opacity hover:opacity-60 disabled:opacity-30 ml-auto"
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
            <PortBar key={entry.port} entry={entry} />
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
