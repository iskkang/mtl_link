import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import mapboxgl from 'mapbox-gl'
import { RefreshCw, AlertCircle, X, Train, Package } from 'lucide-react'

/* ── Types ──────────────────────────────────────────────────────────── */
type TcrSignal = 'green' | 'red' | 'yellow' | 'blue'

interface TcrContainer {
  container_no:         string
  customer_list:        string | null
  origin:               string | null
  destination:          string | null
  current_location:     string | null
  latitude:             number | null
  longitude:            number | null
  signal:               TcrSignal
  eta_final:            string | null
  ata_final:            string | null
  current_segment_name: string | null
  open_alert_count:     number
  transport_mode:       string | null
  load_type:            string | null
}

interface TcrSegment {
  segment_no:        number
  segment_name:      string | null
  atd:               string | null
  ata:               string | null
  is_current_segment: boolean
}

interface TcrItem {
  item_no:      number
  description:  string | null
  quantity:     number | null
  weight_kg:    number | null
  hs_code:      string | null
}

interface TcrAlert {
  alert_id:   number
  severity:   string
  alert_type: string | null
  message:    string | null
  status:     string
  created_at: string | null
}

interface DetailData {
  container: TcrContainer
  segments:  TcrSegment[]
  items:     TcrItem[]
  alerts:    TcrAlert[]
}

/* ── Signal config ──────────────────────────────────────────────────── */
const SIG_COLOR: Record<TcrSignal, string> = {
  green:  '#22c55e',
  blue:   '#3b82f6',
  yellow: '#eab308',
  red:    '#ef4444',
}

const SIG_LABEL: Record<TcrSignal, string> = {
  green:  '도착완료',
  blue:   '운송중',
  yellow: '주의',
  red:    '경고',
}

/* ── Helpers ─────────────────────────────────────────────────────────── */
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function fmtRelTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2)  return '방금'
  if (mins < 60) return `${mins}분 전`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}시간 전`
  return `${Math.floor(hrs / 24)}일 전`
}

/* ── Signal dot ─────────────────────────────────────────────────────── */
function SignalDot({ signal, size = 8 }: { signal: TcrSignal; size?: number }) {
  const color = SIG_COLOR[signal]
  const glow  = signal !== 'blue' ? `0 0 0 2.5px ${color}30` : undefined
  return (
    <span
      style={{
        display:      'inline-block',
        width:        size,
        height:       size,
        borderRadius: '50%',
        background:   color,
        boxShadow:    glow,
        flexShrink:   0,
      }}
    />
  )
}

/* ── Filter chip ─────────────────────────────────────────────────────── */
function FilterChip({
  label, active, color, count, onClick,
}: {
  label:   string
  active:  boolean
  color?:  string
  count?:  number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium transition-colors"
      style={active
        ? { background: color ? `${color}15` : 'var(--mint-bg)', borderColor: color ?? 'var(--mint-border)', color: color ?? 'var(--mint-deep)' }
        : { background: 'transparent', borderColor: 'var(--ink-300)', color: 'var(--ink-500)' }}
    >
      {color && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />}
      {label}
      {count !== undefined && <span className="font-mono opacity-70">{count}</span>}
    </button>
  )
}

/* ── Container card ──────────────────────────────────────────────────── */
function ContainerCard({
  c, selected, onClick,
}: {
  c:        TcrContainer
  selected: boolean
  onClick:  () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-4 py-2.5 border-b flex items-start gap-2.5 transition-colors"
      style={{
        borderColor: 'var(--ink-200)',
        background:  selected ? 'var(--ink-50)' : 'transparent',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--ink-50)' }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
    >
      <div style={{ paddingTop: 3 }}>
        <SignalDot signal={c.signal} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1.5 mb-0.5">
          <span className="font-mono text-[12px] font-semibold truncate" style={{ color: 'var(--ink-900)' }}>
            {c.container_no}
          </span>
          {c.open_alert_count > 0 && (
            <span
              className="text-[9px] font-mono font-bold flex-shrink-0 px-1.5 py-0.5 rounded"
              style={{ background: '#ef444415', color: '#ef4444' }}
            >
              !{c.open_alert_count}
            </span>
          )}
        </div>
        <div className="text-[10px] truncate" style={{ color: 'var(--ink-600)' }}>
          {c.origin ?? '—'} → {c.destination ?? '—'}
        </div>
        <div className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: 'var(--ink-400)' }}>
          {c.current_location && (
            <span className="truncate">{c.current_location}</span>
          )}
          {c.eta_final && !c.ata_final && (
            <>
              <span style={{ color: 'var(--ink-300)' }}>·</span>
              <span className="flex-shrink-0">ETA {fmtDate(c.eta_final)}</span>
            </>
          )}
          {c.ata_final && (
            <>
              <span style={{ color: 'var(--ink-300)' }}>·</span>
              <span className="flex-shrink-0" style={{ color: '#22c55e' }}>도착 {fmtDate(c.ata_final)}</span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}

/* ── Detail panel ────────────────────────────────────────────────────── */
function DetailPanel({
  detail,
  onClose,
}: {
  detail:  DetailData
  onClose: () => void
}) {
  const { container: c, segments, items, alerts } = detail
  const [tab, setTab] = useState<'segments' | 'items' | 'alerts'>('segments')
  const openAlerts = alerts.filter(a => a.status === 'Open')

  return (
    <div
      className="flex-shrink-0 flex flex-col rounded-lg border overflow-hidden"
      style={{ width: 340, borderColor: 'var(--ink-200)', background: 'var(--card)' }}
    >
      {/* Header */}
      <div
        className="px-4 pt-3 pb-2 border-b flex items-start justify-between flex-shrink-0"
        style={{ borderColor: 'var(--ink-200)' }}
      >
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <SignalDot signal={c.signal} size={9} />
            <span className="font-mono text-[13px] font-bold" style={{ color: 'var(--ink-900)' }}>
              {c.container_no}
            </span>
            <span
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: `${SIG_COLOR[c.signal]}15`, color: SIG_COLOR[c.signal] }}
            >
              {SIG_LABEL[c.signal]}
            </span>
          </div>
          <div className="text-[10px]" style={{ color: 'var(--ink-500)' }}>
            {c.origin ?? '—'} → {c.destination ?? '—'}
          </div>
          {c.current_segment_name && (
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-400)' }}>
              현재 구간: {c.current_segment_name}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ color: 'var(--ink-400)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Info row */}
      <div
        className="px-4 py-2 flex gap-4 border-b flex-shrink-0"
        style={{ borderColor: 'var(--ink-200)', background: 'var(--ink-50)' }}
      >
        {c.eta_final && !c.ata_final && (
          <div>
            <div className="text-[9px] font-mono uppercase tracking-wide" style={{ color: 'var(--ink-400)' }}>ETA</div>
            <div className="text-[11px] font-semibold" style={{ color: 'var(--ink-800)' }}>{fmtDate(c.eta_final)}</div>
          </div>
        )}
        {c.ata_final && (
          <div>
            <div className="text-[9px] font-mono uppercase tracking-wide" style={{ color: 'var(--ink-400)' }}>ATA</div>
            <div className="text-[11px] font-semibold" style={{ color: '#22c55e' }}>{fmtDate(c.ata_final)}</div>
          </div>
        )}
        {c.transport_mode && (
          <div>
            <div className="text-[9px] font-mono uppercase tracking-wide" style={{ color: 'var(--ink-400)' }}>운송</div>
            <div className="text-[11px]" style={{ color: 'var(--ink-700)' }}>{c.transport_mode}</div>
          </div>
        )}
        {c.load_type && (
          <div>
            <div className="text-[9px] font-mono uppercase tracking-wide" style={{ color: 'var(--ink-400)' }}>적재</div>
            <div className="text-[11px]" style={{ color: 'var(--ink-700)' }}>{c.load_type}</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b flex-shrink-0" style={{ borderColor: 'var(--ink-200)' }}>
        {(['segments', 'items', 'alerts'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="flex-1 py-2 text-[11px] font-semibold border-b-2 transition-colors"
            style={{
              borderColor: tab === t ? 'var(--brand)' : 'transparent',
              color:       tab === t ? 'var(--ink-900)' : 'var(--ink-400)',
              background:  'transparent',
            }}
          >
            {t === 'segments' ? '구간' : t === 'items' ? `화물${items.length > 0 ? ` ${items.length}` : ''}` : `경고${openAlerts.length > 0 ? ` ${openAlerts.length}` : ''}`}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'segments' && (
          <div className="py-2">
            {segments.length === 0 ? (
              <div className="px-4 py-6 text-center text-[11px]" style={{ color: 'var(--ink-400)' }}>구간 정보 없음</div>
            ) : (
              segments.map((s, idx) => (
                <div
                  key={s.segment_no ?? idx}
                  className="flex items-start gap-3 px-4 py-2"
                  style={{ opacity: s.is_current_segment || !s.atd ? 1 : 0.55 }}
                >
                  {/* timeline dot + line */}
                  <div className="flex flex-col items-center flex-shrink-0 pt-1" style={{ width: 16 }}>
                    <span
                      style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: s.ata ? '#22c55e' : s.is_current_segment ? '#3b82f6' : 'var(--ink-300)',
                        border: s.is_current_segment ? '2px solid #3b82f680' : 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    {idx < segments.length - 1 && (
                      <div style={{ width: 1, flex: 1, minHeight: 16, background: 'var(--ink-200)', marginTop: 3 }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-2">
                    <div
                      className="text-[11px] font-semibold"
                      style={{ color: s.is_current_segment ? '#3b82f6' : 'var(--ink-800)' }}
                    >
                      {s.segment_name ?? `구간 ${s.segment_no}`}
                      {s.is_current_segment && (
                        <span
                          className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded font-semibold"
                          style={{ background: '#3b82f615', color: '#3b82f6' }}
                        >
                          현재
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-0.5">
                      {s.atd && (
                        <span className="text-[10px]" style={{ color: 'var(--ink-400)' }}>
                          출발 {fmtDate(s.atd)}
                        </span>
                      )}
                      {s.ata && (
                        <span className="text-[10px]" style={{ color: '#22c55e' }}>
                          도착 {fmtDate(s.ata)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'items' && (
          <div className="py-2">
            {items.length === 0 ? (
              <div className="px-4 py-6 text-center text-[11px]" style={{ color: 'var(--ink-400)' }}>
                <Package size={20} style={{ margin: '0 auto 8px', color: 'var(--ink-300)' }} />
                화물 정보 없음
              </div>
            ) : (
              items.map((item, idx) => (
                <div
                  key={item.item_no ?? idx}
                  className="px-4 py-2 border-b"
                  style={{ borderColor: 'var(--ink-100)' }}
                >
                  <div className="text-[11px] font-medium" style={{ color: 'var(--ink-800)' }}>
                    {item.description ?? `화물 ${idx + 1}`}
                  </div>
                  <div className="flex gap-3 mt-0.5">
                    {item.hs_code && (
                      <span className="text-[10px]" style={{ color: 'var(--ink-500)' }}>HS {item.hs_code}</span>
                    )}
                    {item.quantity != null && (
                      <span className="text-[10px]" style={{ color: 'var(--ink-500)' }}>{item.quantity}개</span>
                    )}
                    {item.weight_kg != null && (
                      <span className="text-[10px]" style={{ color: 'var(--ink-500)' }}>{item.weight_kg} kg</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'alerts' && (
          <div className="py-2">
            {alerts.length === 0 ? (
              <div className="px-4 py-6 text-center text-[11px]" style={{ color: 'var(--ink-400)' }}>경고 없음</div>
            ) : (
              alerts.map((a, idx) => {
                const color = a.severity === 'Critical' ? '#ef4444' : a.severity === 'Watch' ? '#eab308' : 'var(--ink-500)'
                return (
                  <div
                    key={a.alert_id ?? idx}
                    className="px-4 py-2 border-b flex items-start gap-2"
                    style={{ borderColor: 'var(--ink-100)', opacity: a.status !== 'Open' ? 0.55 : 1 }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 4 }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold" style={{ color }}>{a.severity}</span>
                        {a.status !== 'Open' && (
                          <span className="text-[9px]" style={{ color: 'var(--ink-400)' }}>종료됨</span>
                        )}
                      </div>
                      {a.message && (
                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-600)' }}>{a.message}</div>
                      )}
                      {a.alert_type && (
                        <div className="text-[9px] mt-0.5" style={{ color: 'var(--ink-400)' }}>{a.alert_type}</div>
                      )}
                      {a.created_at && (
                        <div className="text-[9px] mt-0.5" style={{ color: 'var(--ink-300)' }}>{fmtRelTime(a.created_at)}</div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Mapbox map ──────────────────────────────────────────────────────── */
const TOKEN = (import.meta as any).env?.MAPBOX_ACCESS_TOKEN as string | undefined

const MAP_SIG_COLOR: Record<TcrSignal, string> = {
  green:  '#22c55e',
  blue:   '#3b82f6',
  yellow: '#eab308',
  red:    '#ef4444',
}

function TcrMap({
  containers,
  selectedNo,
  onSelect,
}: {
  containers: TcrContainer[]
  selectedNo: string | null
  onSelect:   (no: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<mapboxgl.Map | null>(null)
  const markersRef   = useRef<mapboxgl.Marker[]>([])

  const points = useMemo(
    () => containers.filter(c => c.latitude != null && c.longitude != null),
    [containers],
  )

  useEffect(() => {
    if (!containerRef.current || !TOKEN) return
    if (mapRef.current) return

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:     'mapbox://styles/mapbox/light-v11',
      center:    [85, 50],
      zoom:      3,
      accessToken: TOKEN,
    })
    mapRef.current = map

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Update markers whenever points change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const redraw = () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      for (const c of points) {
        const color     = MAP_SIG_COLOR[c.signal]
        const isSelected = c.container_no === selectedNo
        const el = document.createElement('div')
        el.style.cssText = [
          `width:${isSelected ? 14 : 10}px`,
          `height:${isSelected ? 14 : 10}px`,
          'border-radius:50%',
          `background:${color}`,
          `border:${isSelected ? `2.5px solid ${color}` : '2px solid white'}`,
          `box-shadow:${isSelected ? `0 0 0 3px ${color}40` : '0 1px 3px rgba(0,0,0,0.25)'}`,
          'cursor:pointer',
          'transition:transform 0.15s',
        ].join(';')
        el.title = `${c.container_no} · ${c.current_location ?? ''}`
        el.addEventListener('click', () => onSelect(c.container_no))
        el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.3)' })
        el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([c.longitude!, c.latitude!])
          .addTo(map)
        markersRef.current.push(marker)
      }
    }

    if (map.isStyleLoaded()) {
      redraw()
    } else {
      map.once('load', redraw)
    }
  }, [points, selectedNo, onSelect])

  if (!TOKEN) {
    return (
      <div className="flex-1 flex items-center justify-center rounded-lg border" style={{ borderColor: 'var(--ink-200)', background: 'var(--card)' }}>
        <span className="text-[11px]" style={{ color: 'var(--ink-400)' }}>Mapbox 토큰 없음</span>
      </div>
    )
  }

  return (
    <div
      className="flex-1 rounded-lg border overflow-hidden"
      style={{ borderColor: 'var(--ink-200)', minHeight: 0 }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

/* ── Main page ───────────────────────────────────────────────────────── */
const ALL_SIGNALS: TcrSignal[] = ['red', 'yellow', 'blue', 'green']

export function TcrTrackingPage() {
  const [containers,   setContainers]   = useState<TcrContainer[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [lastFetch,    setLastFetch]    = useState<string | null>(null)
  const [refreshing,   setRefreshing]   = useState(false)

  // Filters
  const [sigFilter,    setSigFilter]    = useState<TcrSignal | null>(null)
  const [modeFilter,   setModeFilter]   = useState<string | null>(null)
  const [arrivedFilter, setArrivedFilter] = useState<boolean | null>(null)

  // Sort
  const [sort, setSort] = useState<'risk' | 'eta'>('risk')

  // Selection + detail
  const [selectedNo,   setSelectedNo]   = useState<string | null>(null)
  const [detail,       setDetail]       = useState<DetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  /* ── Fetch list ─────────────────────────────────────────────────────── */
  const fetchData = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true)
    else       setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/tcr?action=list')
      const json = await res.json()
      if (!json.containers) throw new Error(json.error ?? 'Failed to load')
      setContainers(json.containers)
      setLastFetch(new Date().toISOString())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  /* ── Fetch detail ───────────────────────────────────────────────────── */
  const fetchDetail = useCallback(async (containerNo: string) => {
    setDetailLoading(true)
    try {
      const res  = await fetch(`/api/tcr?action=detail&container_no=${encodeURIComponent(containerNo)}`)
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? 'Failed to load detail')
      setDetail(json as DetailData)
    } catch {
      // keep previous detail on error
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const handleSelect = useCallback((no: string) => {
    setSelectedNo(no)
    setDetail(null)
    fetchDetail(no)
  }, [fetchDetail])

  /* ── Derived data ───────────────────────────────────────────────────── */
  const transportModes = useMemo(() => {
    const s = new Set<string>()
    containers.forEach(c => { if (c.transport_mode) s.add(c.transport_mode) })
    return [...s].sort()
  }, [containers])

  const stats = useMemo(() => {
    const m: Record<TcrSignal, number> = { red: 0, yellow: 0, blue: 0, green: 0 }
    containers.forEach(c => { m[c.signal]++ })
    return m
  }, [containers])

  const filtered = useMemo(() => {
    let list = containers
    if (sigFilter !== null)    list = list.filter(c => c.signal === sigFilter)
    if (modeFilter !== null)   list = list.filter(c => c.transport_mode === modeFilter)
    if (arrivedFilter !== null) list = list.filter(c => arrivedFilter ? c.ata_final != null : c.ata_final == null)
    return list
  }, [containers, sigFilter, modeFilter, arrivedFilter])

  const SIG_RANK: Record<TcrSignal, number> = { red: 0, yellow: 1, blue: 2, green: 3 }

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sort === 'risk') return SIG_RANK[a.signal] - SIG_RANK[b.signal]
      const etaA = a.eta_final ?? '9999'
      const etaB = b.eta_final ?? '9999'
      return etaA.localeCompare(etaB)
    })
  }, [filtered, sort])

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ background: 'var(--chat-bg)' }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0"
        style={{ padding: '12px 28px 10px', borderBottom: '1px solid var(--line)' }}
      >
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <Train size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
            <h1 style={{ fontSize: 18, margin: 0, fontWeight: 700, color: 'var(--ink-900)' }}>
              중국경유 컨테이너 (TCR)
            </h1>
            <span className="text-[11px]" style={{ color: 'var(--ink-400)' }}>
              {loading ? 'Loading…' : `${containers.length}개 · ${fmtRelTime(lastFetch)}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {ALL_SIGNALS.filter(s => stats[s] > 0).map(s => (
              <span
                key={s}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${SIG_COLOR[s]}15`, color: SIG_COLOR[s] }}
              >
                {stats[s]} {SIG_LABEL[s]}
              </span>
            ))}
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={loading || refreshing}
              className="w-7 h-7 flex items-center justify-center rounded-lg border transition-colors disabled:opacity-40"
              style={{ borderColor: 'var(--ink-300)', color: 'var(--ink-500)', background: 'transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ink-100)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-wide" style={{ color: 'var(--ink-400)' }}>필터</span>

          {ALL_SIGNALS.filter(s => stats[s] > 0).map(s => (
            <FilterChip
              key={s}
              label={SIG_LABEL[s]}
              color={SIG_COLOR[s]}
              count={stats[s]}
              active={sigFilter === s}
              onClick={() => setSigFilter(prev => prev === s ? null : s)}
            />
          ))}

          {transportModes.length > 1 && (
            <>
              <span style={{ width: 1, height: 14, background: 'var(--ink-200)' }} />
              {transportModes.map(m => (
                <FilterChip
                  key={m}
                  label={m}
                  active={modeFilter === m}
                  onClick={() => setModeFilter(prev => prev === m ? null : m)}
                />
              ))}
            </>
          )}

          <span style={{ width: 1, height: 14, background: 'var(--ink-200)' }} />
          <FilterChip
            label="운송중"
            active={arrivedFilter === false}
            onClick={() => setArrivedFilter(prev => prev === false ? null : false)}
          />
          <FilterChip
            label="도착완료"
            active={arrivedFilter === true}
            onClick={() => setArrivedFilter(prev => prev === true ? null : true)}
          />

          {(sigFilter || modeFilter || arrivedFilter !== null) && (
            <button
              type="button"
              onClick={() => { setSigFilter(null); setModeFilter(null); setArrivedFilter(null) }}
              className="flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition-colors"
              style={{ borderColor: 'var(--ink-300)', color: 'var(--ink-500)', background: 'transparent' }}
            >
              <X size={10} /> 초기화
            </button>
          )}

          <div className="ml-auto flex-shrink-0">
            <button
              type="button"
              onClick={() => setSort(s => s === 'risk' ? 'eta' : 'risk')}
              className="text-[10px] px-2 py-0.5 rounded border transition-colors"
              style={{ borderColor: 'var(--ink-300)', color: 'var(--ink-500)', background: 'transparent' }}
            >
              {sort === 'risk' ? '▼ 위험도순' : '▼ ETA순'}
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden p-4 flex gap-4 min-h-0">

        {/* Error */}
        {error && (
          <div
            className="absolute left-4 right-4 rounded-lg border px-4 py-3 flex items-center gap-3 text-sm z-10"
            style={{ background: 'var(--signal-red-bg)', borderColor: 'rgba(220,38,38,0.25)', color: '#ef4444' }}
          >
            <AlertCircle size={15} />
            <span className="flex-1">{error}</span>
            <button type="button" className="text-xs underline" onClick={() => fetchData()}>재시도</button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="flex-1 flex gap-4">
            <div className="rounded-lg border animate-pulse flex-shrink-0" style={{ width: 280, background: 'var(--card)', borderColor: 'var(--line)' }} />
            <div className="flex-1 rounded-lg border animate-pulse" style={{ background: 'var(--card)', borderColor: 'var(--line)' }} />
          </div>
        )}

        {!loading && (
          <>
            {/* Left: container list */}
            <div
              className="flex flex-col rounded-lg border overflow-hidden flex-shrink-0"
              style={{ width: 280, borderColor: 'var(--ink-200)', background: 'var(--card)' }}
            >
              <div
                className="px-4 py-2 border-b flex items-center justify-between flex-shrink-0"
                style={{ borderColor: 'var(--ink-200)' }}
              >
                <span className="text-[10px] font-mono uppercase tracking-wide" style={{ color: 'var(--ink-500)' }}>
                  컨테이너 {sorted.length > 0 ? sorted.length : ''}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto">
                {sorted.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-[11px]" style={{ color: 'var(--ink-400)' }}>
                    {containers.length === 0 ? '컨테이너 없음' : '필터 결과 없음'}
                  </div>
                ) : (
                  sorted.map(c => (
                    <ContainerCard
                      key={c.container_no}
                      c={c}
                      selected={c.container_no === selectedNo}
                      onClick={() => handleSelect(c.container_no)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Center: map */}
            <TcrMap
              containers={filtered}
              selectedNo={selectedNo}
              onSelect={handleSelect}
            />

            {/* Right: detail panel */}
            {(selectedNo || detailLoading) && (
              <div
                className="flex flex-col rounded-lg border overflow-hidden flex-shrink-0"
                style={{ width: 340, borderColor: 'var(--ink-200)', background: 'var(--card)' }}
              >
                {detailLoading || !detail ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div
                      className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: '#3b82f6', borderTopColor: 'transparent' }}
                    />
                  </div>
                ) : (
                  <DetailPanel
                    detail={detail}
                    onClose={() => { setSelectedNo(null); setDetail(null) }}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default TcrTrackingPage
