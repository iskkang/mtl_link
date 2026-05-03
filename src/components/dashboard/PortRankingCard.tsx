import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Anchor, RefreshCw } from 'lucide-react'
import { DashboardCard } from './DashboardCard'

interface PortEntry { port: string; current: number; previous: number; yoyPct: number }
interface PortsData  { ports: PortEntry[]; title: string; fetchedAt: string }

const CACHE_KEY = 'mtl_dashboard_ports_v2'
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
  const pct    = maxVal > 0 ? (entry.current / maxVal) * 100 : 0
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

// Fetch directly from EconDB (widget API is CORS-open, server-side IP may be blocked)
async function fetchPortsData(): Promise<PortsData> {
  const res = await fetch(
    'https://www.econdb.com/widgets/top-port-comparison/data/',
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) },
  )
  if (!res.ok) throw new Error(`upstream ${res.status}`)

  const raw = await res.json() as { plots?: Array<{ title?: string; data?: unknown[] }> }
  const plot = raw.plots?.[0]

  const ports: PortEntry[] = ((plot?.data ?? []) as Array<unknown>)
    .map(row => {
      // array format: [portName, current, previous]
      if (Array.isArray(row)) {
        const [port, current, previous] = row as [string, number, number]
        const yoyPct = previous ? +((current - previous) / previous * 100).toFixed(1) : 0
        return { port: String(port), current: Number(current), previous: Number(previous), yoyPct }
      }
      // object format: { port/name/Port, current/Current, previous/Previous }
      if (row && typeof row === 'object') {
        const r = row as Record<string, unknown>
        const port     = String(r.port ?? r.name ?? r.Port ?? r.Name ?? '')
        const current  = Number(r.current ?? r.Current ?? r.value ?? r.Value ?? 0)
        const previous = Number(r.previous ?? r.Previous ?? r.prev ?? r.Prev ?? 0)
        const yoyPct   = previous ? +((current - previous) / previous * 100).toFixed(1) : 0
        return { port, current, previous, yoyPct }
      }
      return null
    })
    .filter((e): e is PortEntry => e !== null && Boolean(e.port) && !isNaN(e.current) && e.current > 0)
    .sort((a, b) => b.current - a.current)

  return { ports, title: String(plot?.title ?? ''), fetchedAt: new Date().toISOString() }
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
