import { useEffect, useState } from 'react'
import { Anchor } from 'lucide-react'

const C_URL = import.meta.env.VITE_CONGESTION_SUPABASE_URL as string
const C_KEY = import.meta.env.VITE_CONGESTION_SUPABASE_ANON_KEY as string

const REGIONS = [
  { name: '한국·일본',      codes: ['KRPUS','KRICN','JPNGO','JPYOK','JPTYO','JPUKB'] },
  { name: '중국',           codes: ['CNSHA','CNQIN','CNNGB','CNTXG','CNYTN','CNNSA','CNDLC'] },
  { name: '동남아시아',     codes: ['VNTOT','VNHPH','THLCH','SGSIN','MYLPK','IDJKT','IDSUB','PHMNL'] },
  { name: '남아시아·중동',  codes: ['LKCMB','AEJEA','INBOM','JOAQJ','ILASH'] },
  { name: '유럽',           codes: ['NLRTM','DEHAM','BEANR','GBFXT','FRLEH','GRPIR','ESVLC','ITGOA','SIKOP','ESALG'] },
  { name: '북미',           codes: ['USLAX','USLGB','USNYC','USSAV','CAVAN','USMSY'] },
  { name: '러시아·CIS',     codes: ['RUVVO','RUNVS','KZAKT'] },
  { name: '아프리카·지중해',codes: ['MACAS','KEMBA','ZADUR','TZDAR','EGPSD'] },
]

const LEVEL_ORDER = ['CONGESTED','BUSY','STABLE','LOW'] as const
const LEVEL_COLOR: Record<string, string> = {
  CONGESTED: '#ef4444',
  BUSY:      '#f59e0b',
  STABLE:    '#3b82f6',
  LOW:       '#22c55e',
}
const LEVEL_ICON: Record<string, string> = {
  CONGESTED: '●', BUSY: '◆', STABLE: '▲', LOW: '✓',
}

interface RegionStat {
  name: string; tpfs: number; level: string; portCount: number
}

const CACHE_KEY = 'mtl_ticker_regions_v1'
const CACHE_TTL = 30 * 60 * 1000

function loadCache(): RegionStat[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts }: { data: RegionStat[]; ts: number } = JSON.parse(raw)
    return Date.now() - ts < CACHE_TTL ? data : null
  } catch { return null }
}

export function RegionalTicker() {
  const [regions, setRegions] = useState<RegionStat[]>(loadCache() ?? [])

  useEffect(() => {
    if (regions.length > 0) return
    async function load() {
      try {
        const res = await fetch(
          `${C_URL}/rest/v1/port_current?select=port_code,tpfs,level`,
          { headers: { apikey: C_KEY, Authorization: `Bearer ${C_KEY}` }, signal: AbortSignal.timeout(8000) },
        )
        if (!res.ok) return
        const rows = await res.json() as { port_code: string; tpfs: number; level: string }[]
        const map = Object.fromEntries(rows.map(r => [r.port_code, r]))

        const stats: RegionStat[] = REGIONS.map(r => {
          const ports = r.codes.map(c => map[c]).filter(Boolean)
          if (ports.length === 0) return null
          const avgTpfs = ports.reduce((s, p) => s + p.tpfs, 0) / ports.length
          const dominantLevel = LEVEL_ORDER.find(lv => ports.some(p => p.level === lv)) ?? 'LOW'
          return { name: r.name, tpfs: avgTpfs, level: dominantLevel, portCount: ports.length }
        }).filter(Boolean) as RegionStat[]

        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: stats, ts: Date.now() }))
        setRegions(stats)
      } catch { /* silent */ }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (regions.length === 0) return null

  // Duplicate items for seamless infinite loop
  const items = [...regions, ...regions]
  const duration = `${regions.length * 5}s`

  return (
    <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
      {/* Label */}
      <div className="flex items-center gap-1.5 flex-shrink-0 pl-1">
        <Anchor size={11} style={{ color: 'var(--ink-4)' }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
          권역별 혼잡도
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 flex-shrink-0" style={{ background: 'var(--line)' }} />

      {/* Scrolling ticker */}
      <div className="flex-1 overflow-hidden">
        <div
          className="animate-ticker flex items-center whitespace-nowrap"
          style={{ animationDuration: duration }}
        >
          {items.map((r, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-5">
              <span className="text-[9px]" style={{ color: LEVEL_COLOR[r.level] ?? '#22c55e' }}>
                {LEVEL_ICON[r.level]}
              </span>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                {r.name}
              </span>
              <span className="text-[12px] font-bold tabular-nums" style={{ color: LEVEL_COLOR[r.level] ?? '#22c55e' }}>
                {r.tpfs.toFixed(1)}
              </span>
              <span className="text-[9px] font-bold" style={{ color: LEVEL_COLOR[r.level], opacity: 0.7 }}>
                TPFS
              </span>
              <span className="text-[10px] pl-3" style={{ color: 'var(--line)' }}>|</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
