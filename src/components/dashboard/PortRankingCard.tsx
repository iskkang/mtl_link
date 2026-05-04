import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Anchor, RefreshCw } from 'lucide-react'
import { DashboardCard } from './DashboardCard'

const C_URL = import.meta.env.VITE_CONGESTION_SUPABASE_URL as string
const C_KEY = import.meta.env.VITE_CONGESTION_SUPABASE_ANON_KEY as string

// ── Port code → name (mtl-port-congestion-monitor PORT_META) ────────
const PORT_NAMES: Record<string, string> = {
  KRPUS: 'Busan', KRICN: 'Incheon', JPNGO: 'Nagoya', JPYOK: 'Yokohama',
  JPTYO: 'Tokyo', JPUKB: 'Kobe',
  CNSHA: 'Shanghai', CNQIN: 'Qingdao', CNNGB: 'Ningbo', CNTXG: 'Tianjin',
  CNYTN: 'Yantian', CNNSA: 'Nansha', CNDLC: 'Dalian',
  VNTOT: 'Cai Mep', VNHPH: 'Haiphong', THLCH: 'Laem Chabang',
  SGSIN: 'Singapore', MYLPK: 'Port Klang', IDJKT: 'Jakarta',
  IDSUB: 'Surabaya', PHMNL: 'Manila',
  LKCMB: 'Colombo', AEJEA: 'Jebel Ali', INBOM: 'Mumbai',
  JOAQJ: 'Aqaba', ILASH: 'Ashdod',
  NLRTM: 'Rotterdam', DEHAM: 'Hamburg', BEANR: 'Antwerp',
  GBFXT: 'Felixstowe', FRLEH: 'Le Havre', GRPIR: 'Piraeus',
  ESVLC: 'Valencia', ITGOA: 'Genoa', SIKOP: 'Koper', ESALG: 'Algeciras',
  USLAX: 'Los Angeles', USLGB: 'Long Beach', USNYC: 'New York',
  USSAV: 'Savannah', CAVAN: 'Vancouver', USMSY: 'New Orleans',
  RUVVO: 'Vladivostok', RUNVS: 'Novorossiysk', KZAKT: 'Aktau',
  MACAS: 'Casablanca', KEMBA: 'Mombasa', ZADUR: 'Durban',
  TZDAR: 'Dar es Salaam', EGPSD: 'Port Said',
}

// ── Level styling ────────────────────────────────────────────────────
type Level = 'CONGESTED' | 'BUSY' | 'STABLE' | 'LOW'

const LEVEL_STYLE: Record<Level, { bg: string; color: string; bar: string; label: string }> = {
  CONGESTED: { bg: 'rgba(239,68,68,0.12)',    color: '#ef4444', bar: '#ef4444', label: '혼잡' },
  BUSY:      { bg: 'rgba(245,158,11,0.12)',   color: '#f59e0b', bar: '#f59e0b', label: '혼잡' },
  STABLE:    { bg: 'rgba(59,130,246,0.12)',   color: '#3b82f6', bar: '#3b82f6', label: '보통' },
  LOW:       { bg: 'rgba(34,197,94,0.10)',    color: '#22c55e', bar: '#22c55e', label: '원활' },
}

function lvlStyle(level: string) {
  return LEVEL_STYLE[level as Level] ?? LEVEL_STYLE.LOW
}

// ── Types ─────────────────────────────────────────────────────────────
interface PortRow {
  port_code:        string
  tpfs:             number
  level:            string
  vessels_anchored: number
  vessels_berthed:  number
  updated_at:       string
}
interface CongestionData { rows: PortRow[]; fetchedAt: string }

// ── Cache ─────────────────────────────────────────────────────────────
const CACHE_KEY = 'mtl_dashboard_congestion_v1'
const CACHE_TTL = 30 * 60 * 1000 // 30 min

function loadCache(): CongestionData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts }: { data: CongestionData; ts: number } = JSON.parse(raw)
    return Date.now() - ts < CACHE_TTL ? data : null
  } catch { return null }
}
function saveCache(d: CongestionData) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: d, ts: Date.now() })) }
  catch { /* quota */ }
}

// ── Sub-components ────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5 py-1">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="flex flex-col gap-1">
          <div className="h-4 rounded animate-pulse" style={{ background: 'var(--bg-primary)', width: `${70 + i * 5}%` }} />
          <div className="h-1.5 rounded-full animate-pulse" style={{ background: 'var(--bg-primary)' }} />
        </div>
      ))}
    </div>
  )
}

function PortRow({ row }: { row: PortRow }) {
  const name  = PORT_NAMES[row.port_code] ?? row.port_code
  const lvl   = lvlStyle(row.level)
  const pct   = Math.min(Math.round(row.tpfs), 100)
  const total = (row.vessels_anchored ?? 0) + (row.vessels_berthed ?? 0)

  return (
    <div className="py-1.5" style={{ borderBottom: '1px solid var(--line)' }}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[11px] font-semibold truncate flex-1" style={{ color: 'var(--ink)' }}>
          {name}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] tabular-nums font-medium" style={{ color: 'var(--ink-3)' }}>
            {total}척
          </span>
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: lvl.bg, color: lvl.color }}
          >
            {row.level}
          </span>
          <span className="text-[10px] font-bold tabular-nums w-6 text-right" style={{ color: lvl.color }}>
            {Math.round(row.tpfs)}
          </span>
        </div>
      </div>
      {/* TPFS bar */}
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: lvl.bar, opacity: 0.75 }}
        />
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────
export function PortRankingCard() {
  const { t } = useTranslation()
  const cached = loadCache()
  const [data,    setData]    = useState<CongestionData | null>(cached)
  const [loading, setLoading] = useState<boolean>(!cached)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `${C_URL}/rest/v1/port_current?select=port_code,tpfs,level,vessels_anchored,vessels_berthed,updated_at&order=tpfs.desc&limit=10`,
        {
          headers: { apikey: C_KEY, Authorization: `Bearer ${C_KEY}` },
          signal: AbortSignal.timeout(8000),
        },
      )
      if (!res.ok) throw new Error(`db ${res.status}`)
      const rows = await res.json() as PortRow[]
      if (!rows || rows.length === 0) throw new Error('no data')

      const result: CongestionData = { rows, fetchedAt: new Date().toISOString() }
      saveCache(result)
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!cached) load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Last updated timestamp
  const updatedAt = data?.rows[0]?.updated_at
  const fmtUpdated = updatedAt
    ? new Intl.DateTimeFormat('ko', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        .format(new Date(updatedAt))
    : null

  return (
    <DashboardCard title={t('dashPorts')} icon={Anchor}>
      {/* Header: source + refresh */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>
          {fmtUpdated ? `갱신 ${fmtUpdated}` : 'AIS 실시간'}
        </span>
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
        <>
          {/* Legend */}
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            {(['CONGESTED', 'BUSY', 'STABLE', 'LOW'] as Level[]).map(lv => (
              <div key={lv} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: LEVEL_STYLE[lv].bar }} />
                <span className="text-[9px]" style={{ color: 'var(--ink-4)' }}>{lv}</span>
              </div>
            ))}
          </div>
          {/* Rows */}
          <div>
            {(data?.rows ?? []).map(row => (
              <PortRow key={row.port_code} row={row} />
            ))}
          </div>
        </>
      )}
    </DashboardCard>
  )
}
