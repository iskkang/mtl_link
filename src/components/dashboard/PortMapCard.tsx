import { useState, useEffect, useCallback } from 'react'
import { Map, RefreshCw, ExternalLink } from 'lucide-react'

const C_URL = import.meta.env.VITE_CONGESTION_SUPABASE_URL as string
const C_KEY = import.meta.env.VITE_CONGESTION_SUPABASE_ANON_KEY as string
const SITE_URL = 'https://iskkang.github.io/mtl-port-congestion-monitor/'

// Equirectangular projection: x = (lon+180)/360*W, y = (90-lat)/180*H
const PORT_COORDS: Record<string, [number, number]> = {
  KRPUS:[35.10,129.04], KRICN:[37.46,126.63], JPNGO:[35.06,136.88],
  JPYOK:[35.44,139.65], JPTYO:[35.63,139.77], JPUKB:[34.68,135.18],
  CNSHA:[31.22,121.47], CNQIN:[36.07,120.38], CNNGB:[29.86,121.55],
  CNTXG:[39.01,117.68], CNYTN:[22.52,114.05], CNNSA:[22.73,113.53],
  CNDLC:[38.91,121.64],
  VNTOT:[10.50,107.03], VNHPH:[20.86,106.68], THLCH:[13.08,100.88],
  SGSIN:[1.26,103.82],  MYLPK:[2.99,101.38],  IDJKT:[-6.08,106.76],
  IDSUB:[-7.20,112.73], PHMNL:[14.59,120.97],
  LKCMB:[6.93,79.85],   AEJEA:[25.01,55.06],  INBOM:[18.92,72.84],
  JOAQJ:[29.52,35.00],  ILASH:[31.82,34.65],
  NLRTM:[51.95,4.14],   DEHAM:[53.55,10.00],  BEANR:[51.22,4.40],
  GBFXT:[51.96,1.33],   FRLEH:[49.49,0.11],   GRPIR:[37.94,23.64],
  ESVLC:[39.45,-0.33],  ITGOA:[44.41,8.92],   SIKOP:[45.55,13.73],
  ESALG:[36.14,-5.46],
  USLAX:[33.74,-118.27],USLGB:[33.77,-118.19],USNYC:[40.70,-74.01],
  USSAV:[32.08,-81.09], CAVAN:[49.29,-123.12],USMSY:[29.95,-90.07],
  RUVVO:[43.10,131.87], RUNVS:[44.72,37.77],  KZAKT:[50.30,51.15],
  MACAS:[33.60,-7.59],  KEMBA:[-4.06,39.66],  ZADUR:[-29.86,31.02],
  TZDAR:[-6.81,39.29],  EGPSD:[31.26,32.30],
}

const LEVEL_COLOR: Record<string, string> = {
  CONGESTED: '#ef4444',
  BUSY:      '#f59e0b',
  STABLE:    '#3b82f6',
  LOW:       '#22c55e',
}

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

// SVG viewBox dimensions
const W = 720, H = 360

function toXY(lat: number, lon: number): [number, number] {
  return [(lon + 180) / 360 * W, (90 - lat) / 180 * H]
}

// Grid line positions
const LAT_LINES = [60, 30, 0, -30, -60]
const LON_LINES = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150]

interface TooltipState { x: number; y: number; code: string; tpfs: number; level: string; vessels: number }

export function PortMapCard() {
  const [rows,    setRows]    = useState<PortRow[]>(loadCache() ?? [])
  const [loading, setLoading] = useState(!loadCache())
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `${C_URL}/rest/v1/port_current?select=port_code,tpfs,level,vessels_anchored,vessels_berthed&order=tpfs.desc`,
        { headers: { apikey: C_KEY, Authorization: `Bearer ${C_KEY}` }, signal: AbortSignal.timeout(8000) },
      )
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json() as PortRow[]
      setRows(data)
    } catch { /* silent — keep cached data */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (!loadCache()) load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const portMap = Object.fromEntries(rows.map(r => [r.port_code, r]))

  return (
    <div
      className="rounded-2xl flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--card)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-panel)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Map size={14} style={{ color: 'var(--ink-3)' }} />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
            글로벌 혼잡 현황 지도
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="flex items-center gap-3 mr-2">
            {(['CONGESTED','BUSY','STABLE','LOW'] as const).map(lv => (
              <div key={lv} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: LEVEL_COLOR[lv] }} />
                <span className="text-[9px]" style={{ color: 'var(--ink-4)' }}>{lv}</span>
              </div>
            ))}
          </div>
          <a
            href={SITE_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-0.5 transition-opacity hover:opacity-60"
            style={{ color: 'var(--ink-4)' }}
          >
            <ExternalLink size={10} />
            <span className="text-[10px]">전체</span>
          </a>
          <button
            onClick={load} disabled={loading}
            className="p-0.5 rounded transition-opacity hover:opacity-60 disabled:opacity-30"
            style={{ color: 'var(--ink-4)' }}
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Map SVG */}
      <div className="flex-1 relative px-3 pb-3" style={{ minHeight: 0 }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid slice"
          className="w-full h-full"
          style={{ display: 'block', borderRadius: 12 }}
        >
          <defs>
            <radialGradient id="mapBg" cx="50%" cy="40%" r="70%">
              <stop offset="0%"   stopColor="#1a2744" />
              <stop offset="100%" stopColor="#0b1220" />
            </radialGradient>
          </defs>

          {/* Background */}
          <rect width={W} height={H} rx={12} fill="url(#mapBg)" />

          {/* Longitude grid lines */}
          {LON_LINES.map(lon => {
            const x = (lon + 180) / 360 * W
            return (
              <line key={lon}
                x1={x} y1={0} x2={x} y2={H}
                stroke="#ffffff" strokeOpacity={0.05} strokeWidth={0.6}
              />
            )
          })}

          {/* Latitude grid lines */}
          {LAT_LINES.map(lat => {
            const y = (90 - lat) / 180 * H
            return (
              <line key={lat}
                x1={0} y1={y} x2={W} y2={y}
                stroke="#ffffff"
                strokeOpacity={lat === 0 ? 0.12 : 0.05}
                strokeWidth={lat === 0 ? 1 : 0.6}
              />
            )
          })}

          {/* Equator label */}
          <text x={6} y={(90 - 0) / 180 * H - 3}
            fontSize={8} fill="#ffffff" fillOpacity={0.2} fontFamily="monospace">
            EQ
          </text>

          {/* Port bubbles */}
          {Object.entries(PORT_COORDS).map(([code, [lat, lon]]) => {
            const port = portMap[code]
            if (!port) return null
            const [cx, cy] = toXY(lat, lon)
            const color = LEVEL_COLOR[port.level] ?? '#22c55e'
            const vessels = port.vessels_anchored + port.vessels_berthed
            const r = Math.max(3.5, Math.min(10, 3.5 + vessels * 0.06))

            return (
              <g key={code}
                className="cursor-pointer"
                onMouseEnter={e => {
                  const svg = (e.currentTarget as SVGGElement).closest('svg')!
                  const rect = svg.getBoundingClientRect()
                  const svgX = cx / W * rect.width
                  const svgY = cy / H * rect.height
                  setTooltip({ x: svgX, y: svgY, code, tpfs: port.tpfs, level: port.level, vessels })
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {/* Glow ring for congested */}
                {port.level === 'CONGESTED' && (
                  <circle cx={cx} cy={cy} r={r + 4} fill={color} fillOpacity={0.12} />
                )}
                <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.85} />
                <circle cx={cx} cy={cy} r={r * 0.38} fill="#ffffff" fillOpacity={0.35} />
              </g>
            )
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none z-10 rounded-xl px-3 py-2 text-white shadow-lg"
            style={{
              left: tooltip.x + 12,
              top:  tooltip.y - 20,
              background: 'rgba(10,18,36,0.95)',
              border: `1px solid ${LEVEL_COLOR[tooltip.level]}44`,
              transform: tooltip.x > W * 0.7 ? 'translateX(-110%)' : undefined,
            }}
          >
            <p className="text-[12px] font-bold">{PORT_NAMES[tooltip.code] ?? tooltip.code}</p>
            <p className="text-[10px] font-semibold" style={{ color: LEVEL_COLOR[tooltip.level] }}>
              {tooltip.level} · TPFS {tooltip.tpfs.toFixed(1)}
            </p>
            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
              선박 {tooltip.vessels}척
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
