import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart2, RefreshCw } from 'lucide-react'
import { DashboardCard } from './DashboardCard'

interface TradePoint { date: string; total: number }
interface TradeData  { points: TradePoint[]; wowPct: number | null; fetchedAt: string }

const CACHE_KEY = 'mtl_dashboard_trade_v2'
const CACHE_TTL = 6 * 60 * 60 * 1000 // 6 h

function loadCache(): TradeData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts }: { data: TradeData; ts: number } = JSON.parse(raw)
    return Date.now() - ts < CACHE_TTL ? data : null
  } catch { return null }
}

function saveCache(d: TradeData) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: d, ts: Date.now() })) }
  catch { /* quota */ }
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="h-5 w-24 rounded animate-pulse" style={{ background: 'var(--bg-primary)' }} />
      <div className="h-12 rounded animate-pulse" style={{ background: 'var(--bg-primary)' }} />
    </div>
  )
}

function TradeSparkline({ points }: { points: TradePoint[] }) {
  if (points.length < 3) return null

  const vals  = points.map(p => p.total)
  const min   = Math.min(...vals)
  const max   = Math.max(...vals)
  const range = max - min || 1
  const W = 240, H = 56
  const pad = 4, w = W - pad * 2, h = H - pad * 2
  const n   = points.length - 1 || 1

  const d = points
    .map((p, i) => {
      const x = (pad + (i / n) * w).toFixed(1)
      const y = (pad + (1 - (p.total - min) / range) * h).toFixed(1)
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join('')

  const latest = points[points.length - 1]
  const lx = (pad + w).toFixed(1)
  const ly = (pad + (1 - (latest.total - min) / range) * h).toFixed(1)

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <path d={d} fill="none" stroke="var(--brand)" strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
      <circle cx={lx} cy={ly} r={2.5} fill="var(--brand)" />
    </svg>
  )
}

// Fetch directly from EconDB (widget API is CORS-open, server-side IP may be blocked)
async function fetchTradeData(): Promise<TradeData> {
  const res = await fetch(
    'https://www.econdb.com/widgets/global-trade/data/?type=export&net=0&transform=0',
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) },
  )
  if (!res.ok) throw new Error(`upstream ${res.status}`)

  // data format: plots[0].data = Array<{ Date: string; [region: string]: number }>
  const raw = await res.json() as { plots?: Array<{ data?: Array<Record<string, unknown>> }> }
  const plotData = (raw.plots?.[0]?.data ?? []) as Array<Record<string, unknown>>

  const points: TradePoint[] = plotData
    .map(row => {
      const date  = String(row.Date ?? row.date ?? '')
      const total = Object.entries(row)
        .filter(([k]) => k !== 'Date' && k !== 'date')
        .reduce((s, [, v]) => s + (typeof v === 'number' ? v : 0), 0)
      return { date, total }
    })
    .filter(p => p.date && p.total > 0)
    .slice(-52)

  const latest = points[points.length - 1]
  const prev   = points[points.length - 2]
  const wowPct = latest && prev && prev.total
    ? +((latest.total - prev.total) / prev.total * 100).toFixed(2)
    : null

  return { points, wowPct, fetchedAt: new Date().toISOString() }
}

export function GlobalTradeCard() {
  const { t } = useTranslation()
  const cached = loadCache()
  const [data,    setData]    = useState<TradeData | null>(cached)
  const [loading, setLoading] = useState<boolean>(!cached)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchTradeData()
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

  const latest = data?.points[data.points.length - 1]
  const wowPct = data?.wowPct ?? null
  const up     = wowPct !== null && wowPct >= 0

  return (
    <DashboardCard title={t('dashTrade')} icon={BarChart2}>
      <div className="flex items-center justify-end mb-1">
        <button
          onClick={load}
          disabled={loading}
          className="p-0.5 rounded transition-opacity hover:opacity-60 disabled:opacity-30"
          style={{ color: 'var(--ink-4)' }}
          title={t('dashTradeRetry')}
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !data ? (
        <Skeleton />
      ) : error && !data ? (
        <div className="flex flex-col items-center py-6 gap-2">
          <p className="text-[11px]" style={{ color: 'var(--ink-4)' }}>{t('dashTradeError')}</p>
          <button onClick={load} className="text-[11px] font-medium" style={{ color: 'var(--brand)' }}>
            {t('dashTradeRetry')}
          </button>
        </div>
      ) : (
        <>
          {latest && (
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-[18px] font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                {latest.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>TEU</span>
              {wowPct !== null && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded ml-auto"
                  style={{
                    background: up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color:      up ? 'var(--green)'          : 'var(--red)',
                  }}
                >
                  {up ? '+' : ''}{wowPct.toFixed(2)}% {t('dashTradeWoW')}
                </span>
              )}
            </div>
          )}

          {data && data.points.length > 3 && (
            <div className="mb-1">
              <TradeSparkline points={data.points} />
            </div>
          )}

          {latest && (
            <p className="text-[10px] mt-1" style={{ color: 'var(--ink-4)' }}>{latest.date}</p>
          )}
        </>
      )}
    </DashboardCard>
  )
}
