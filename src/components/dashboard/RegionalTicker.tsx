import { useEffect, useState } from 'react'
import { TrendingUp, Anchor } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ── FBX types ─────────────────────────────────────────────────────
interface FbxItem { code: string; route: string; value: string; change: string }

// ── Regional congestion fallback ──────────────────────────────────
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
  CONGESTED: '#ef4444', BUSY: '#f59e0b', STABLE: '#3b82f6', LOW: '#22c55e',
}
const LEVEL_ICON: Record<string, string> = {
  CONGESTED: '●', BUSY: '◆', STABLE: '▲', LOW: '✓',
}
interface RegionStat { name: string; tpfs: number; level: string }

// ── Caches ────────────────────────────────────────────────────────
const FBX_CACHE    = 'mtl_ticker_fbx_v1'
const REGION_CACHE = 'mtl_ticker_regions_v1'
const FBX_TTL      = 6 * 60 * 60 * 1000  // 6h
const REGION_TTL   = 30 * 60 * 1000       // 30min

function loadFbxCache(): FbxItem[] | null {
  try {
    const raw = localStorage.getItem(FBX_CACHE)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw) as { data: FbxItem[]; ts: number }
    return Date.now() - ts < FBX_TTL ? data : null
  } catch { return null }
}
function loadRegionCache(): RegionStat[] | null {
  try {
    const raw = localStorage.getItem(REGION_CACHE)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw) as { data: RegionStat[]; ts: number }
    return Date.now() - ts < REGION_TTL ? data : null
  } catch { return null }
}

// ── Component ─────────────────────────────────────────────────────
type Mode = 'fbx' | 'region'

export function RegionalTicker() {
  const [fbxItems,    setFbxItems]    = useState<FbxItem[]>(loadFbxCache() ?? [])
  const [regionItems, setRegionItems] = useState<RegionStat[]>(loadRegionCache() ?? [])
  const [mode,        setMode]        = useState<Mode>(loadFbxCache() ? 'fbx' : 'region')

  useEffect(() => {
    // 1. Try FBX from Edge Function
    if (fbxItems.length === 0) {
      supabase.functions
        .invoke<{ data: FbxItem[] }>('dashboard-data', { body: { type: 'fbx' } })
        .then(({ data: res }) => {
          if (res?.data?.length) {
            localStorage.setItem(FBX_CACHE, JSON.stringify({ data: res.data, ts: Date.now() }))
            setFbxItems(res.data)
            setMode('fbx')
          } else {
            setMode('region')
          }
        })
        .catch(() => setMode('region'))
    }

    // 2. Always load regional congestion as fallback
    if (regionItems.length === 0) {
      fetch(
        `${C_URL}/rest/v1/port_current?select=port_code,tpfs,level`,
        { headers: { apikey: C_KEY, Authorization: `Bearer ${C_KEY}` }, signal: AbortSignal.timeout(8000) },
      )
        .then(r => r.ok ? r.json() : null)
        .then((rows: { port_code: string; tpfs: number; level: string }[] | null) => {
          if (!rows) return
          const map = Object.fromEntries(rows.map(r => [r.port_code, r]))
          const stats: RegionStat[] = REGIONS.flatMap(r => {
            const ports = r.codes.map(c => map[c]).filter(Boolean)
            if (!ports.length) return []
            const avgTpfs = ports.reduce((s, p) => s + p.tpfs, 0) / ports.length
            const level   = LEVEL_ORDER.find(lv => ports.some(p => p.level === lv)) ?? 'LOW'
            return [{ name: r.name, tpfs: avgTpfs, level }]
          })
          localStorage.setItem(REGION_CACHE, JSON.stringify({ data: stats, ts: Date.now() }))
          setRegionItems(stats)
        })
        .catch(() => { /* silent */ })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── FBX Ticker ──────────────────────────────────────────────────
  if (mode === 'fbx' && fbxItems.length > 0) {
    const tickerItems = [...fbxItems, ...fbxItems]
    const duration    = `${fbxItems.length * 6}s`
    return (
      <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-1.5 flex-shrink-0 pl-1">
          <TrendingUp size={11} style={{ color: 'var(--ink-4)' }} />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
            FBX 운임지수
          </span>
        </div>
        <div className="w-px h-4 flex-shrink-0" style={{ background: 'var(--line)' }} />
        <div className="flex-1 overflow-hidden">
          <div className="animate-ticker flex items-center whitespace-nowrap" style={{ animationDuration: duration }}>
            {tickerItems.map((item, i) => {
              const color = item.change.startsWith('+') ? '#22c55e'
                          : item.change.startsWith('-') ? '#ef4444'
                          : 'var(--ink-4)'
              return (
                <span key={i} className="inline-flex items-center gap-1.5 px-5">
                  <span className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--ink-3)' }}>{item.code}</span>
                  <span className="text-[10px]"           style={{ color: 'var(--ink-4)' }}>{item.route}</span>
                  <span className="text-[12px] font-bold tabular-nums" style={{ color: 'var(--ink-2)' }}>{item.value}</span>
                  <span className="text-[10px] font-semibold tabular-nums" style={{ color }}>{item.change}</span>
                  <span className="text-[10px] pl-3"      style={{ color: 'var(--line)' }}>|</span>
                </span>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Regional Congestion Fallback ─────────────────────────────────
  if (regionItems.length === 0) return null

  const tickerItems = [...regionItems, ...regionItems]
  const duration    = `${regionItems.length * 5}s`
  return (
    <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
      <div className="flex items-center gap-1.5 flex-shrink-0 pl-1">
        <Anchor size={11} style={{ color: 'var(--ink-4)' }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
          권역별 혼잡도
        </span>
      </div>
      <div className="w-px h-4 flex-shrink-0" style={{ background: 'var(--line)' }} />
      <div className="flex-1 overflow-hidden">
        <div className="animate-ticker flex items-center whitespace-nowrap" style={{ animationDuration: duration }}>
          {tickerItems.map((r, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-5">
              <span className="text-[9px]"  style={{ color: LEVEL_COLOR[r.level] ?? '#22c55e' }}>{LEVEL_ICON[r.level]}</span>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--ink-2)' }}>{r.name}</span>
              <span className="text-[12px] font-bold tabular-nums" style={{ color: LEVEL_COLOR[r.level] ?? '#22c55e' }}>{r.tpfs.toFixed(1)}</span>
              <span className="text-[9px] font-bold" style={{ color: LEVEL_COLOR[r.level], opacity: 0.7 }}>TPFS</span>
              <span className="text-[10px] pl-3" style={{ color: 'var(--line)' }}>|</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
