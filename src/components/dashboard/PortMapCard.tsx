import { useState, useEffect, useCallback, useRef } from 'react'
import { Map, RefreshCw, ExternalLink } from 'lucide-react'
import { ComposableMap, Geographies, Geography, Marker, Graticule } from 'react-simple-maps'

const C_URL   = import.meta.env.VITE_CONGESTION_SUPABASE_URL  as string
const C_KEY   = import.meta.env.VITE_CONGESTION_SUPABASE_ANON_KEY as string
const SITE_URL = 'https://iskkang.github.io/mtl-port-congestion-monitor/'
const GEO_URL  = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// [longitude, latitude] — react-simple-maps coordinate order
const PORT_COORDS: Record<string, [number, number]> = {
  KRPUS:[129.04,35.10], KRICN:[126.63,37.46], JPNGO:[136.88,35.06],
  JPYOK:[139.65,35.44], JPTYO:[139.77,35.63], JPUKB:[135.18,34.68],
  CNSHA:[121.47,31.22], CNQIN:[120.38,36.07], CNNGB:[121.55,29.86],
  CNTXG:[117.68,39.01], CNYTN:[114.05,22.52], CNNSA:[113.53,22.73],
  CNDLC:[121.64,38.91],
  VNTOT:[107.03,10.50], VNHPH:[106.68,20.86], THLCH:[100.88,13.08],
  SGSIN:[103.82,1.26],  MYLPK:[101.38,2.99],  IDJKT:[106.76,-6.08],
  IDSUB:[112.73,-7.20], PHMNL:[120.97,14.59],
  LKCMB:[79.85,6.93],   AEJEA:[55.06,25.01],  INBOM:[72.84,18.92],
  JOAQJ:[35.00,29.52],  ILASH:[34.65,31.82],
  NLRTM:[4.14,51.95],   DEHAM:[10.00,53.55],  BEANR:[4.40,51.22],
  GBFXT:[1.33,51.96],   FRLEH:[0.11,49.49],   GRPIR:[23.64,37.94],
  ESVLC:[-0.33,39.45],  ITGOA:[8.92,44.41],   SIKOP:[13.73,45.55],
  ESALG:[-5.46,36.14],
  USLAX:[-118.27,33.74],USLGB:[-118.19,33.77],USNYC:[-74.01,40.70],
  USSAV:[-81.09,32.08], CAVAN:[-123.12,49.29],USMSY:[-90.07,29.95],
  RUVVO:[131.87,43.10], RUNVS:[37.77,44.72],  KZAKT:[51.15,50.30],
  MACAS:[-7.59,33.60],  KEMBA:[39.66,-4.06],  ZADUR:[31.02,-29.86],
  TZDAR:[39.29,-6.81],  EGPSD:[32.30,31.26],
}

const LEVEL_COLOR: Record<string, string> = {
  CONGESTED: '#ef4444', BUSY: '#f59e0b', STABLE: '#3b82f6', LOW: '#22c55e',
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

interface TooltipState { code: string; tpfs: number; level: string; vessels: number; x: number; y: number }

export function PortMapCard() {
  const [rows,    setRows]    = useState<PortRow[]>(loadCache() ?? [])
  const [loading, setLoading] = useState(!loadCache())
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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

  const portMap = Object.fromEntries(rows.map(r => [r.port_code, r]))

  return (
    <div
      className="rounded-2xl flex flex-col h-full overflow-hidden"
      style={{ background: '#08111e', border: '1px solid #1a3050', boxShadow: 'var(--shadow-panel)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Map size={14} style={{ color: '#4a7fa0' }} />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#4a7fa0' }}>
            글로벌 혼잡 현황 지도
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 mr-2">
            {(['CONGESTED','BUSY','STABLE','LOW'] as const).map(lv => (
              <div key={lv} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: LEVEL_COLOR[lv] }} />
                <span className="text-[9px]" style={{ color: '#4a7fa0' }}>{lv}</span>
              </div>
            ))}
          </div>
          <a
            href={SITE_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-0.5 transition-opacity hover:opacity-60"
            style={{ color: '#4a7fa0' }}
          >
            <ExternalLink size={10} />
            <span className="text-[10px]">전체</span>
          </a>
          <button
            onClick={load} disabled={loading}
            className="p-0.5 rounded transition-opacity hover:opacity-60 disabled:opacity-30"
            style={{ color: '#4a7fa0' }}
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Map */}
      <div ref={containerRef} className="flex-1 relative px-2 pb-2 min-h-0">
        <div className="w-full h-full rounded-xl overflow-hidden" style={{ background: '#08111e' }}>
          <ComposableMap
            projection="geoNaturalEarth1"
            projectionConfig={{ scale: 155, center: [10, 10] }}
            style={{ width: '100%', height: '100%' }}
          >
            {/* Grid lines */}
            <Graticule stroke="#ffffff" strokeOpacity={0.06} strokeWidth={0.5} />

            {/* Country fills */}
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map(geo => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="#132240"
                    stroke="#2a4870"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: 'none' },
                      hover:   { outline: 'none', fill: '#1a3060' },
                      pressed: { outline: 'none' },
                    }}
                  />
                ))
              }
            </Geographies>

            {/* Port markers */}
            {Object.entries(PORT_COORDS).map(([code, coordinates]) => {
              const port = portMap[code]
              if (!port) return null
              const color = LEVEL_COLOR[port.level] ?? '#22c55e'
              const vessels = port.vessels_anchored + port.vessels_berthed
              const r = Math.max(3.5, Math.min(9, 3.5 + vessels * 0.05))

              return (
                <Marker key={code} coordinates={coordinates}>
                  {port.level === 'CONGESTED' && (
                    <circle r={r + 4} fill={color} fillOpacity={0.15} />
                  )}
                  <circle
                    r={r}
                    fill={color}
                    fillOpacity={0.9}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e: React.MouseEvent<SVGCircleElement>) => {
                      const rect = containerRef.current?.getBoundingClientRect()
                      if (!rect) return
                      setTooltip({ code, tpfs: port.tpfs, level: port.level, vessels,
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                      })
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                  <circle r={r * 0.38} fill="#ffffff" fillOpacity={0.4} style={{ pointerEvents: 'none' }} />
                </Marker>
              )
            })}
          </ComposableMap>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none z-10 rounded-xl px-3 py-2 text-white shadow-lg"
            style={{
              left:       tooltip.x + 12,
              top:        tooltip.y - 50,
              background: 'rgba(10,18,36,0.95)',
              border:     `1px solid ${LEVEL_COLOR[tooltip.level]}44`,
              transform:  tooltip.x > (containerRef.current?.clientWidth ?? 0) * 0.72
                ? 'translateX(-110%)' : undefined,
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
