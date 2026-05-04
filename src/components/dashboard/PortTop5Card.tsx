import { useState, useEffect, useCallback } from 'react'
import { BarChart2, RefreshCw } from 'lucide-react'
import { DashboardCard } from './DashboardCard'

const C_URL = import.meta.env.VITE_CONGESTION_SUPABASE_URL as string
const C_KEY = import.meta.env.VITE_CONGESTION_SUPABASE_ANON_KEY as string

const PORT_NAMES: Record<string, string> = {
  KRPUS:'Busan', KRICN:'Incheon', JPNGO:'Nagoya', JPYOK:'Yokohama',
  JPTYO:'Tokyo', JPUKB:'Kobe', CNSHA:'Shanghai', CNQIN:'Qingdao',
  CNNGB:'Ningbo', CNTXG:'Tianjin', CNYTN:'Yantian', CNNSA:'Nansha',
  CNDLC:'Dalian', VNTOT:'Cai Mep', VNHPH:'Haiphong', THLCH:'Laem Chabang',
  SGSIN:'Singapore', MYLPK:'Port Klang', IDJKT:'Jakarta', IDSUB:'Surabaya',
  PHMNL:'Manila', LKCMB:'Colombo', AEJEA:'Jebel Ali', INBOM:'Mumbai',
  JOAQJ:'Aqaba', ILASH:'Ashdod', NLRTM:'Rotterdam', DEHAM:'Hamburg',
  BEANR:'Antwerp', GBFXT:'Felixstowe', FRLEH:'Le Havre', GRPIR:'Piraeus',
  ESVLC:'Valencia', ITGOA:'Genoa', SIKOP:'Koper', ESALG:'Algeciras',
  USLAX:'Los Angeles', USLGB:'Long Beach', USNYC:'New York', USSAV:'Savannah',
  CAVAN:'Vancouver', USMSY:'New Orleans', RUVVO:'Vladivostok',
  RUNVS:'Novorossiysk', KZAKT:'Aktau', MACAS:'Casablanca', KEMBA:'Mombasa',
  ZADUR:'Durban', TZDAR:'Dar es Salaam', EGPSD:'Port Said',
}

const LEVEL_COLOR: Record<string, string> = {
  CONGESTED: '#ef4444', BUSY: '#f59e0b', STABLE: '#3b82f6', LOW: '#22c55e',
}

interface PortRow {
  port_code: string; tpfs: number; level: string
  vessels_anchored: number; vessels_berthed: number
}

const CACHE_KEY = 'mtl_dashboard_congestion_v2'
const CACHE_TTL = 30 * 60 * 1000

function loadCache(): PortRow[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts }: { data: { rows: PortRow[] }; ts: number } = JSON.parse(raw)
    return Date.now() - ts < CACHE_TTL ? data.rows : null
  } catch { return null }
}

type TabKey = 'congested' | 'anchored' | 'berthed'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'congested', label: '최고 혼잡' },
  { key: 'anchored',  label: '대기 선박' },
  { key: 'berthed',   label: '접안 선박' },
]

function getSorted(rows: PortRow[], tab: TabKey): PortRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (tab === 'anchored') return b.vessels_anchored - a.vessels_anchored
    if (tab === 'berthed')  return b.vessels_berthed  - a.vessels_berthed
    return b.tpfs - a.tpfs
  })
  return sorted.slice(0, 5)
}

function getMetric(row: PortRow, tab: TabKey): string {
  if (tab === 'anchored') return `${row.vessels_anchored}척`
  if (tab === 'berthed')  return `${row.vessels_berthed}척`
  return row.tpfs.toFixed(1)
}

function getMetricLabel(tab: TabKey): string {
  if (tab === 'anchored') return '대기'
  if (tab === 'berthed')  return '접안'
  return 'TPFS'
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-2 pt-1">
      {[0,1,2,3,4].map(i => (
        <div key={i} className="h-5 rounded animate-pulse" style={{ background: 'var(--bg-primary)', width: `${88 - i * 6}%` }} />
      ))}
    </div>
  )
}

export function PortTop5Card() {
  const [rows,    setRows]    = useState<PortRow[]>(loadCache() ?? [])
  const [loading, setLoading] = useState(!loadCache())
  const [tab,     setTab]     = useState<TabKey>('congested')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `${C_URL}/rest/v1/port_current?select=port_code,tpfs,level,vessels_anchored,vessels_berthed&order=tpfs.desc`,
        { headers: { apikey: C_KEY, Authorization: `Bearer ${C_KEY}` }, signal: AbortSignal.timeout(8000) },
      )
      if (!res.ok) throw new Error(`${res.status}`)
      setRows(await res.json() as PortRow[])
    } catch { /* keep cached */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (!loadCache()) load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const top5 = getSorted(rows, tab)
  const metricLabel = getMetricLabel(tab)

  return (
    <DashboardCard
      title="항만 Top 5"
      icon={BarChart2}
      className="h-full"
      action={{ label: '', onClick: load }}
    >
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-3 -mt-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all"
            style={{
              background: tab === t.key ? 'var(--brand)' : 'var(--bg-primary)',
              color:      tab === t.key ? '#fff'         : 'var(--ink-3)',
            }}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={load}
          disabled={loading}
          className="p-0.5 rounded transition-opacity hover:opacity-60 disabled:opacity-30"
          style={{ color: 'var(--ink-4)' }}
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && rows.length === 0 ? (
        <Skeleton />
      ) : (
        <div className="flex flex-col overflow-hidden">
          {/* Column header */}
          <div className="flex items-center pb-1 flex-shrink-0" style={{ borderBottom: '1px solid var(--line)' }}>
            <span className="text-[9px] w-4 flex-shrink-0 font-medium" style={{ color: 'var(--ink-4)' }}>#</span>
            <span className="text-[9px] flex-1 font-medium" style={{ color: 'var(--ink-4)' }}>항만</span>
            <span className="text-[9px] w-14 text-right font-medium" style={{ color: 'var(--ink-4)' }}>레벨</span>
            <span className="text-[9px] w-12 text-right font-medium" style={{ color: 'var(--ink-4)' }}>{metricLabel}</span>
          </div>

          {top5.map((row, i) => {
            const name  = PORT_NAMES[row.port_code] ?? row.port_code
            const color = LEVEL_COLOR[row.level] ?? '#22c55e'
            const metric = getMetric(row, tab)

            return (
              <div
                key={row.port_code}
                className="flex items-center py-1"
                style={{ borderBottom: i < 4 ? '1px solid var(--line)' : undefined }}
              >
                <span className="text-[10px] w-4 flex-shrink-0 tabular-nums font-bold" style={{ color: 'var(--ink-4)' }}>
                  {i + 1}
                </span>
                <span className="text-[11px] font-semibold flex-1 truncate" style={{ color: 'var(--ink)' }}>
                  {name}
                </span>
                <span
                  className="text-[8px] font-bold px-1.5 py-0.5 rounded w-14 text-center flex-shrink-0 mr-1"
                  style={{ background: `${color}18`, color }}
                >
                  {row.level.slice(0, 4)}
                </span>
                <span className="text-[11px] font-bold tabular-nums w-12 text-right flex-shrink-0" style={{ color }}>
                  {metric}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </DashboardCard>
  )
}
