import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { TrendingUp, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { DashboardCard } from './DashboardCard'

// ── Types ───────────────────────────────────────────────────────
interface IndexPoint { current: number; weeklyGrowth: number; date: string }
interface GraphPoint { date: string; kcci: number | null; scfi: number | null; ccfi: number | null }
interface IndicesData {
  kcci:      IndexPoint | null
  scfi:      IndexPoint | null
  ccfi:      IndexPoint | null
  graphData: GraphPoint[]
  fetchedAt: string
}

// ── Cache ────────────────────────────────────────────────────────
const CACHE_KEY = 'mtl_dashboard_indices_v1'
const CACHE_TTL = 60 * 60 * 1000 // 1 h

function loadCache(): IndicesData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts }: { data: IndicesData; ts: number } = JSON.parse(raw)
    return Date.now() - ts < CACHE_TTL ? data : null
  } catch { return null }
}

function saveCache(d: IndicesData) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: d, ts: Date.now() })) }
  catch { /* storage quota — ignore */ }
}

// ── SVG Sparkline ────────────────────────────────────────────────
const SERIES: { key: 'kcci' | 'scfi'; color: string }[] = [
  { key: 'kcci', color: 'var(--brand)' },
  { key: 'scfi', color: '#F59E0B' },
]

function buildPath(
  pts: GraphPoint[],
  key: 'kcci' | 'scfi',
  W: number, H: number,
  min: number, range: number,
): string {
  const pad = 3, w = W - pad * 2, h = H - pad * 2
  const n = pts.length - 1 || 1
  let d = '', gap = true
  for (let i = 0; i < pts.length; i++) {
    const v = pts[i][key]
    if (v === null) { gap = true; continue }
    const x = (pad + (i / n) * w).toFixed(1)
    const y = (pad + (1 - (v - min) / range) * h).toFixed(1)
    d += gap ? `M${x},${y}` : `L${x},${y}`
    gap = false
  }
  return d
}

function Sparkline({ data }: { data: GraphPoint[] }) {
  const pts = [...data].sort((a, b) => a.date.localeCompare(b.date)).slice(-40)
  if (pts.length < 3) return null

  const all = pts.flatMap(p => [p.kcci, p.scfi]).filter((v): v is number => v !== null)
  if (all.length < 2) return null

  const min = Math.min(...all)
  const max = Math.max(...all)
  const range = max - min || 1
  const W = 240, H = 34

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="overflow-visible"
      style={{ display: 'block' }}
    >
      {SERIES.map(({ key, color }) => {
        const d = buildPath(pts, key, W, H, min, range)
        return d
          ? <path key={key} d={d} fill="none" stroke={color} strokeWidth={1.5}
              strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
          : null
      })}
    </svg>
  )
}

// ── IndexRow ─────────────────────────────────────────────────────
interface RowProps { label: string; point: IndexPoint | null; dot: string }

function IndexRow({ label, point, dot }: RowProps) {
  const up = point ? point.weeklyGrowth >= 0 : true
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />
      <span className="text-[11px] font-bold w-10 flex-shrink-0 tracking-wide" style={{ color: 'var(--ink-3)' }}>
        {label}
      </span>
      {point ? (
        <>
          <span className="text-[13px] font-semibold tabular-nums flex-1" style={{ color: 'var(--ink)' }}>
            {point.current.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{
              background: up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color:      up ? 'var(--green)' : 'var(--red)',
            }}
          >
            {up ? '+' : ''}{point.weeklyGrowth.toFixed(2)}%
          </span>
        </>
      ) : (
        <span className="text-[12px] flex-1" style={{ color: 'var(--ink-4)' }}>—</span>
      )}
    </div>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="flex flex-col gap-2 py-1">
      {[0, 1, 2].map(i => (
        <div key={i} className="h-6 rounded-md animate-pulse" style={{ background: 'var(--bg-primary)' }} />
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────
const DOTS: Record<'kcci' | 'scfi' | 'ccfi', string> = {
  kcci: 'var(--brand)',
  scfi: '#F59E0B',
  ccfi: '#8B5CF6',
}

export function ShippingIndexCard() {
  const { t } = useTranslation()
  const cached = loadCache()
  const [data,    setData]    = useState<IndicesData | null>(cached)
  const [loading, setLoading] = useState<boolean>(!cached)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: res, error: fnErr } = await supabase.functions.invoke<IndicesData>('dashboard-data', {
        body: { type: 'indices' },
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

  const latestDate = data?.kcci?.date ?? data?.scfi?.date ?? null
  const fmtDate = latestDate
    ? latestDate.slice(2).replace(/-/g, '.')   // "2026-04-30" → "26.04.30"
    : null

  return (
    <DashboardCard title={t('dashShipping')} icon={TrendingUp} className="h-full">
      {loading && !data ? (
        <Skeleton />
      ) : error && !data ? (
        <div className="flex flex-col items-center py-4 gap-2">
          <p className="text-[11px]" style={{ color: 'var(--ink-4)' }}>{t('dashShippingError')}</p>
          <button
            onClick={load}
            className="text-[11px] font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--brand)' }}
          >
            {t('dashShippingRetry')}
          </button>
        </div>
      ) : (
        <>
          {/* Index rows */}
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--line)' }}>
            <IndexRow label="KCCI" point={data?.kcci ?? null} dot={DOTS.kcci} />
            <IndexRow label="SCFI" point={data?.scfi ?? null} dot={DOTS.scfi} />
            <IndexRow label="CCFI" point={data?.ccfi ?? null} dot={DOTS.ccfi} />
          </div>

          {/* Sparkline */}
          {data?.graphData && data.graphData.length > 3 && (
            <div className="mt-3 mb-1">
              <Sparkline data={data.graphData} />
            </div>
          )}

          {/* Footer: date + refresh */}
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>
              {fmtDate ? t('dashShippingUpdated', { date: fmtDate }) : ''}
            </p>
            <button
              onClick={load}
              disabled={loading}
              className="p-0.5 rounded transition-opacity hover:opacity-60 disabled:opacity-30"
              style={{ color: 'var(--ink-4)' }}
              title={t('dashShippingRetry')}
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </>
      )}
    </DashboardCard>
  )
}
