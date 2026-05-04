import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Anchor, RefreshCw, ExternalLink } from 'lucide-react'
import { DashboardCard } from './DashboardCard'

const C_URL = import.meta.env.VITE_CONGESTION_SUPABASE_URL as string
const C_KEY = import.meta.env.VITE_CONGESTION_SUPABASE_ANON_KEY as string
const SITE_URL = 'https://iskkang.github.io/mtl-port-congestion-monitor/'

// ── Port code → display name ─────────────────────────────────────────
const PORT_NAMES: Record<string, string> = {
  KRPUS:'Busan', KRICN:'Incheon', JPNGO:'Nagoya', JPYOK:'Yokohama',
  JPTYO:'Tokyo', JPUKB:'Kobe',
  CNSHA:'Shanghai', CNQIN:'Qingdao', CNNGB:'Ningbo', CNTXG:'Tianjin',
  CNYTN:'Yantian', CNNSA:'Nansha', CNDLC:'Dalian',
  VNTOT:'Cai Mep', VNHPH:'Haiphong', THLCH:'Laem Chabang',
  SGSIN:'Singapore', MYLPK:'Port Klang', IDJKT:'Jakarta',
  IDSUB:'Surabaya', PHMNL:'Manila',
  LKCMB:'Colombo', AEJEA:'Jebel Ali', INBOM:'Mumbai',
  JOAQJ:'Aqaba', ILASH:'Ashdod',
  NLRTM:'Rotterdam', DEHAM:'Hamburg', BEANR:'Antwerp',
  GBFXT:'Felixstowe', FRLEH:'Le Havre', GRPIR:'Piraeus',
  ESVLC:'Valencia', ITGOA:'Genoa', SIKOP:'Koper', ESALG:'Algeciras',
  USLAX:'Los Angeles', USLGB:'Long Beach', USNYC:'New York',
  USSAV:'Savannah', CAVAN:'Vancouver', USMSY:'New Orleans',
  RUVVO:'Vladivostok', RUNVS:'Novorossiysk', KZAKT:'Aktau',
  MACAS:'Casablanca', KEMBA:'Mombasa', ZADUR:'Durban',
  TZDAR:'Dar es Salaam', EGPSD:'Port Said',
}

// ── Level config ──────────────────────────────────────────────────────
const LVL: Record<string, { color: string; bg: string; label: string }> = {
  CONGESTED: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  label: 'CONGESTED' },
  BUSY:      { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'BUSY'      },
  STABLE:    { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', label: 'STABLE'    },
  LOW:       { color: '#22c55e', bg: 'rgba(34,197,94,0.10)',  label: 'LOW'       },
}
const LEVELS = ['CONGESTED', 'BUSY', 'STABLE', 'LOW'] as const

// ── Types ─────────────────────────────────────────────────────────────
interface PortRow {
  port_code: string; tpfs: number; level: string
  vessels_anchored: number; vessels_berthed: number; updated_at: string
}
interface Stats {
  rows: PortRow[]
  total: number
  busyCongested: number
  totalVessels: number
  dist: Record<string, number>
  updatedAt: string
  fetchedAt: string
}

// ── Cache ─────────────────────────────────────────────────────────────
const CACHE_KEY = 'mtl_dashboard_congestion_v2'
const CACHE_TTL = 30 * 60 * 1000

function loadCache(): Stats | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts }: { data: Stats; ts: number } = JSON.parse(raw)
    return Date.now() - ts < CACHE_TTL ? data : null
  } catch { return null }
}
function saveCache(d: Stats) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: d, ts: Date.now() })) }
  catch { /* quota */ }
}

// ── Sub-components ────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="flex gap-4">
        <div className="h-12 flex-1 rounded-xl animate-pulse" style={{ background: 'var(--bg-primary)' }} />
        <div className="h-12 flex-1 rounded-xl animate-pulse" style={{ background: 'var(--bg-primary)' }} />
      </div>
      <div className="h-3 rounded-full animate-pulse" style={{ background: 'var(--bg-primary)' }} />
      <div className="flex flex-col gap-2 mt-1">
        {[0,1,2,3,4].map(i => (
          <div key={i} className="h-5 rounded animate-pulse" style={{ background: 'var(--bg-primary)', width: `${85-i*5}%` }} />
        ))}
      </div>
    </div>
  )
}

function KpiBox({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div
      className="flex-1 rounded-xl px-3 py-2.5 flex flex-col gap-0.5"
      style={{ background: 'var(--bg-primary)' }}
    >
      <span className="text-[22px] font-bold leading-none tabular-nums" style={{ color: color ?? 'var(--ink)' }}>
        {value}
      </span>
      <span className="text-[9px] font-medium uppercase tracking-wide" style={{ color: 'var(--ink-4)' }}>
        {label}
      </span>
    </div>
  )
}

function DistBar({ dist, total }: { dist: Record<string, number>; total: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* Segmented bar */}
      <div className="flex h-2 rounded-full overflow-hidden w-full gap-px">
        {LEVELS.map(lv => {
          const pct = total > 0 ? (dist[lv] ?? 0) / total * 100 : 0
          return pct > 0 ? (
            <div key={lv} style={{ width: `${pct}%`, background: LVL[lv].color, borderRadius: 2 }} />
          ) : null
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 flex-wrap">
        {LEVELS.map(lv => {
          const cnt = dist[lv] ?? 0
          if (cnt === 0) return null
          const pct = total > 0 ? Math.round(cnt / total * 100) : 0
          return (
            <div key={lv} className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: LVL[lv].color }} />
              <span className="text-[9px] tabular-nums" style={{ color: 'var(--ink-4)' }}>
                {lv} {pct}%·{cnt}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TopPortRow({ row, rank }: { row: PortRow; rank: number }) {
  const name  = PORT_NAMES[row.port_code] ?? row.port_code
  const lvl   = LVL[row.level] ?? LVL.LOW

  return (
    <div className="flex items-center gap-2 py-1" style={{ borderBottom: '1px solid var(--line)' }}>
      <span className="text-[9px] w-3 text-right flex-shrink-0 font-medium tabular-nums" style={{ color: 'var(--ink-4)' }}>
        {rank}
      </span>
      <span className="text-[11px] font-semibold flex-1 truncate" style={{ color: 'var(--ink)' }}>
        {name}
      </span>
      <span className="text-[9px] tabular-nums flex-shrink-0" style={{ color: 'var(--ink-3)' }}>
        {row.vessels_anchored}+{row.vessels_berthed}척
      </span>
      <span
        className="text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
        style={{ background: lvl.bg, color: lvl.color }}
      >
        {Math.round(row.tpfs)}
      </span>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────
export function PortRankingCard() {
  const { t } = useTranslation()
  const cached = loadCache()
  const [data,    setData]    = useState<Stats | null>(cached)
  const [loading, setLoading] = useState<boolean>(!cached)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `${C_URL}/rest/v1/port_current?select=port_code,tpfs,level,vessels_anchored,vessels_berthed,updated_at&order=tpfs.desc`,
        { headers: { apikey: C_KEY, Authorization: `Bearer ${C_KEY}` }, signal: AbortSignal.timeout(8000) },
      )
      if (!res.ok) throw new Error(`${res.status}`)
      const rows = await res.json() as PortRow[]
      if (!rows || rows.length === 0) throw new Error('no data')

      const dist = Object.fromEntries(LEVELS.map(lv => [lv, rows.filter(r => r.level === lv).length]))
      const stats: Stats = {
        rows,
        total:         rows.length,
        busyCongested: (dist.CONGESTED ?? 0) + (dist.BUSY ?? 0),
        totalVessels:  rows.reduce((s, r) => s + r.vessels_anchored + r.vessels_berthed, 0),
        dist,
        updatedAt:     rows[0]?.updated_at ?? '',
        fetchedAt:     new Date().toISOString(),
      }
      saveCache(stats)
      setData(stats)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!cached) load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const top5   = data?.rows.slice(0, 5) ?? []
  const fmtUpd = data?.updatedAt
    ? new Intl.DateTimeFormat('ko', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        .format(new Date(data.updatedAt))
    : null

  return (
    <DashboardCard title={t('dashPorts')} icon={Anchor}>
      {/* Header row: timestamp + link + refresh */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>
          {fmtUpd ? `갱신 ${fmtUpd}` : 'AIS 실시간'}
        </span>
        <div className="flex items-center gap-2">
          <a
            href={SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 transition-opacity hover:opacity-60"
            style={{ color: 'var(--ink-4)' }}
            title="전체 현황 보기"
          >
            <ExternalLink size={10} />
            <span className="text-[10px]">전체</span>
          </a>
          <button
            onClick={load}
            disabled={loading}
            className="p-0.5 rounded transition-opacity hover:opacity-60 disabled:opacity-30"
            style={{ color: 'var(--ink-4)' }}
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
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
      ) : data ? (
        <div className="flex flex-col gap-3">

          {/* KPI row */}
          <div className="flex gap-2">
            <KpiBox
              value={String(data.busyCongested)}
              label="BUSY+CONGESTED"
              color={data.busyCongested > 0 ? '#ef4444' : 'var(--ink)'}
            />
            <KpiBox
              value={data.totalVessels.toLocaleString()}
              label="총 대기·접안 선박"
            />
          </div>

          {/* Level distribution */}
          <DistBar dist={data.dist} total={data.total} />

          {/* Top 5 separator */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-3)' }}>
              최고 혼잡 항만
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--line)' }} />
          </div>

          {/* Top 5 port rows */}
          <div className="-mt-1">
            {top5.map((row, i) => (
              <TopPortRow key={row.port_code} row={row} rank={i + 1} />
            ))}
          </div>

        </div>
      ) : null}
    </DashboardCard>
  )
}
