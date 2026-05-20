import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import mapboxgl from 'mapbox-gl'
import { RefreshCw, AlertCircle, X, Train, Package, ChevronRight } from 'lucide-react'

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
  segment_no:         number
  segment_name:       string | null
  atd:                string | null
  ata:                string | null
  is_current_segment: boolean
}

interface TcrItem {
  item_no:     number
  description: string | null
  quantity:    number | null
  weight_kg:   number | null
  hs_code:     string | null
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
  ok:        boolean
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
  green: '도착완료', blue: '운송중', yellow: '주의', red: '경고',
}
const SIG_RANK: Record<TcrSignal, number> = { red: 0, yellow: 1, blue: 2, green: 3 }

/* ── Destination → country ──────────────────────────────────────────── */
const DEST_COUNTRIES = [
  { code: 'UZ', label: '우즈베키스탄', kw: ['tashkent', 'andijan', 'namangan', 'samarkand', 'bukhara', 'termez', 'chukursay', 'fergana', 'urgench', 'nukus'] },
  { code: 'KZ', label: '카자흐스탄',   kw: ['almaty', 'astana', 'nur-sultan', 'shymkent', 'aktau', 'aktobe', 'taraz', 'karaganda', 'semey', 'pavlodar'] },
  { code: 'KG', label: '키르기스스탄', kw: ['bishkek', 'osh', 'jalal', 'karakol', 'tokmok'] },
  { code: 'PL', label: '폴란드',       kw: ['warsaw', 'lodz', 'krakow', 'gdansk', 'poznan', 'wroclaw', 'katowice', 'szczecin'] },
] as const

type CountryCode = 'UZ' | 'KZ' | 'KG' | 'PL'

function destToCountry(dest: string | null): CountryCode | null {
  if (!dest) return null
  const d = dest.toLowerCase()
  for (const { code, kw } of DEST_COUNTRIES) {
    if (kw.some(k => d.includes(k))) return code as CountryCode
  }
  return null
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
function daysSince(iso: string | null): number {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

/* ── Signal dot (FESCO-style) ───────────────────────────────────────── */
function SignalDot({ signal }: { signal: TcrSignal | string }) {
  const color = SIG_COLOR[signal as TcrSignal] ?? '#94a3b8'
  const glow  = signal !== 'blue' ? `0 0 0 2.5px ${color}30` : undefined
  return (
    <span
      className="flex-shrink-0"
      style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: glow }}
    />
  )
}

/* ── Status pill (FESCO StatPill style) ─────────────────────────────── */
function StatPill({ count, color, label }: { count: number; color: string; label: string }) {
  return (
    <span
      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: `${color}18`, color }}
    >
      <span className="font-mono">{count}</span> {label}
    </span>
  )
}

/* ── Country chip ────────────────────────────────────────────────────── */
function CountryChip({ label, count, active, onClick }: {
  label: string; count: number; active: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-0.5 rounded-full border text-[11px] font-medium transition-colors"
      style={active
        ? { background: 'var(--mint-bg)', borderColor: 'var(--mint-border)', color: 'var(--mint-deep)' }
        : { background: 'transparent', borderColor: 'var(--ink-300)', color: 'var(--ink-500)' }}
    >
      {label} <span className="font-mono opacity-70">{count}</span>
    </button>
  )
}

/* ── Signal filter chip ─────────────────────────────────────────────── */
function SignalChip({ signal, count, label, active, onClick }: {
  signal: TcrSignal; count: number; label: string; active: boolean; onClick: () => void
}) {
  const color = SIG_COLOR[signal]
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium transition-colors"
      style={active
        ? { background: `${color}15`, borderColor: `${color}50`, color }
        : { background: 'transparent', borderColor: 'var(--ink-300)', color: 'var(--ink-500)' }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="font-mono">{count}</span> {label}
    </button>
  )
}

/* ── Legend row ──────────────────────────────────────────────────────── */
function LegendRow({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-[11px] flex-1" style={{ color: 'var(--ink-700)' }}>{label}</span>
      <span className="text-[11px] font-mono font-medium" style={{ color: 'var(--ink-900)' }}>{count}</span>
    </div>
  )
}

/* ── Donut chart ─────────────────────────────────────────────────────── */
function DonutChart({ green, blue, yellow, red }: { green: number; blue: number; yellow: number; red: number }) {
  const total = green + blue + yellow + red
  const CX = 52, R = 38, SW = 13
  const C  = 2 * Math.PI * R
  if (total === 0) return (
    <svg width={CX * 2} height={CX * 2}>
      <circle cx={CX} cy={CX} r={R} fill="none" strokeWidth={SW} stroke="var(--ink-100)" />
      <text x={CX} y={CX + 5} textAnchor="middle" fontSize="11" fill="var(--ink-400)" fontFamily="var(--font-body)">0</text>
    </svg>
  )
  const segs = [
    { val: red,    color: '#ef4444' },
    { val: yellow, color: '#eab308' },
    { val: blue,   color: '#3b82f6' },
    { val: green,  color: '#22c55e' },
  ]
  let offset = 0
  return (
    <svg width={CX * 2} height={CX * 2} style={{ flexShrink: 0 }}>
      {segs.map(({ val, color }, i) => {
        if (val === 0) return null
        const len = (val / total) * C
        const el = (
          <circle
            key={i}
            cx={CX} cy={CX} r={R}
            fill="none" strokeWidth={SW}
            stroke={color}
            strokeDasharray={`${len} ${C - len}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${CX} ${CX})`}
          />
        )
        offset += len
        return el
      })}
      <text x={CX} y={CX - 3} textAnchor="middle" fontSize="18" fontWeight="700"
        fill="var(--ink-900)" fontFamily="var(--font-body)">{total}</text>
      <text x={CX} y={CX + 10} textAnchor="middle" fontSize="7" fontWeight="600"
        fill="var(--ink-500)" letterSpacing="1.5" fontFamily="var(--font-mono)">ACTIVE</text>
    </svg>
  )
}

/* ── Detail panel (right side, matches FESCO DetailCard style) ───────── */
function DetailPanel({
  containers,
  sigFilter,
  onSigFilter,
  stats,
  onSelect,
  selectedNo,
  detail,
  detailLoading,
  onCloseDetail,
}: {
  containers:     TcrContainer[]
  sigFilter:      TcrSignal | null
  onSigFilter:    (s: TcrSignal) => void
  stats:          Record<TcrSignal, number>
  onSelect:       (no: string) => void
  selectedNo:     string | null
  detail:         DetailData | null
  detailLoading:  boolean
  onCloseDetail:  () => void
}) {
  const [tab, setTab] = useState<'segments' | 'items' | 'alerts'>('segments')

  const filtered = useMemo(() =>
    sigFilter ? containers.filter(c => c.signal === sigFilter) : containers,
    [containers, sigFilter],
  )
  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => SIG_RANK[a.signal] - SIG_RANK[b.signal]),
    [filtered],
  )

  // When detail panel opens, reset to segments tab
  useEffect(() => { if (detail) setTab('segments') }, [detail])

  return (
    <div
      className="rounded-lg border flex flex-col overflow-hidden flex-shrink-0"
      style={{ width: 320, borderColor: 'var(--ink-200)', background: 'var(--card)' }}
    >
      {/* Header */}
      <div
        className="px-4 pt-3 pb-2 border-b flex-shrink-0"
        style={{ borderColor: 'var(--ink-200)' }}
      >
        {selectedNo && detail ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SignalDot signal={detail.container.signal} />
              <span className="font-mono text-[12px] font-bold" style={{ color: 'var(--ink-900)' }}>
                {detail.container.container_no}
              </span>
              <span
                className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: `${SIG_COLOR[detail.container.signal]}15`, color: SIG_COLOR[detail.container.signal] }}
              >
                {SIG_LABEL[detail.container.signal]}
              </span>
            </div>
            <button
              type="button"
              onClick={onCloseDetail}
              style={{ color: 'var(--ink-400)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-1.5">
            <span className="label-mono" style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-500)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              컨테이너 현황
            </span>
            {sigFilter && (
              <button
                type="button"
                onClick={() => onSigFilter(sigFilter)}
                className="text-[10px] flex items-center gap-1"
                style={{ color: 'var(--ink-400)', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <X size={9} /> 필터 해제
              </button>
            )}
          </div>
        )}

        {/* Signal chips (only when not showing detail) */}
        {(!selectedNo || !detail) && (
          <div className="flex gap-1.5 flex-wrap mt-1">
            {(Object.keys(SIG_RANK) as TcrSignal[]).filter(s => stats[s] > 0).map(s => (
              <SignalChip
                key={s}
                signal={s}
                count={stats[s]}
                label={SIG_LABEL[s]}
                active={sigFilter === s}
                onClick={() => onSigFilter(s)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      {selectedNo && detailLoading && !detail ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{ borderColor: '#3b82f6', borderTopColor: 'transparent' }} />
        </div>
      ) : selectedNo && detail ? (
        /* ── Detail view ── */
        <>
          {/* Route info */}
          <div
            className="px-4 py-2 border-b flex-shrink-0 flex gap-4"
            style={{ borderColor: 'var(--ink-200)', background: 'var(--ink-50)' }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-[10px] truncate" style={{ color: 'var(--ink-500)' }}>
                {detail.container.origin ?? '—'} → {detail.container.destination ?? '—'}
              </div>
              {detail.container.current_segment_name && (
                <div className="text-[9px] mt-0.5 truncate" style={{ color: 'var(--ink-400)' }}>
                  구간: {detail.container.current_segment_name}
                </div>
              )}
            </div>
            {detail.container.eta_final && !detail.container.ata_final && (
              <div className="flex-shrink-0">
                <div className="text-[9px] font-mono uppercase" style={{ color: 'var(--ink-400)' }}>ETA</div>
                <div className="text-[10px] font-semibold" style={{ color: 'var(--ink-800)' }}>{fmtDate(detail.container.eta_final)}</div>
              </div>
            )}
            {detail.container.ata_final && (
              <div className="flex-shrink-0">
                <div className="text-[9px] font-mono uppercase" style={{ color: 'var(--ink-400)' }}>ATA</div>
                <div className="text-[10px] font-semibold" style={{ color: '#22c55e' }}>{fmtDate(detail.container.ata_final)}</div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b flex-shrink-0" style={{ borderColor: 'var(--ink-200)' }}>
            {(['segments', 'items', 'alerts'] as const).map(t => {
              const badge = t === 'items'
                ? detail.items.length
                : t === 'alerts'
                  ? detail.alerts.filter(a => a.status === 'Open').length
                  : 0
              return (
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
                  {t === 'segments' ? '구간' : t === 'items' ? `화물${badge > 0 ? ` ${badge}` : ''}` : `경고${badge > 0 ? ` ${badge}` : ''}`}
                </button>
              )
            })}
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === 'segments' && (
              <div className="py-2">
                {detail.segments.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[11px]" style={{ color: 'var(--ink-400)' }}>구간 정보 없음</div>
                ) : detail.segments.map((s, idx) => (
                  <div
                    key={s.segment_no ?? idx}
                    className="flex items-start gap-3 px-4 py-2"
                    style={{ opacity: s.is_current_segment || !s.atd ? 1 : 0.55 }}
                  >
                    <div className="flex flex-col items-center flex-shrink-0 pt-1" style={{ width: 16 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: s.ata ? '#22c55e' : s.is_current_segment ? '#3b82f6' : 'var(--ink-300)',
                        border: s.is_current_segment ? '2px solid #3b82f680' : 'none',
                        boxSizing: 'border-box',
                      }} />
                      {idx < detail.segments.length - 1 && (
                        <div style={{ width: 1, flex: 1, minHeight: 16, background: 'var(--ink-200)', marginTop: 3 }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pb-2">
                      <div className="text-[11px] font-semibold" style={{ color: s.is_current_segment ? '#3b82f6' : 'var(--ink-800)' }}>
                        {s.segment_name ?? `구간 ${s.segment_no}`}
                        {s.is_current_segment && (
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#3b82f615', color: '#3b82f6' }}>현재</span>
                        )}
                      </div>
                      <div className="flex gap-3 mt-0.5">
                        {s.atd && <span className="text-[10px]" style={{ color: 'var(--ink-400)' }}>출발 {fmtDate(s.atd)}</span>}
                        {s.ata && <span className="text-[10px]" style={{ color: '#22c55e' }}>도착 {fmtDate(s.ata)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {tab === 'items' && (
              <div className="py-2">
                {detail.items.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[11px]" style={{ color: 'var(--ink-400)' }}>
                    <Package size={20} style={{ margin: '0 auto 8px', color: 'var(--ink-300)' }} />
                    화물 정보 없음
                  </div>
                ) : detail.items.map((item, idx) => (
                  <div key={item.item_no ?? idx} className="px-4 py-2 border-b" style={{ borderColor: 'var(--ink-100)' }}>
                    <div className="text-[11px] font-medium" style={{ color: 'var(--ink-800)' }}>{item.description ?? `화물 ${idx + 1}`}</div>
                    <div className="flex gap-3 mt-0.5">
                      {item.hs_code     && <span className="text-[10px]" style={{ color: 'var(--ink-500)' }}>HS {item.hs_code}</span>}
                      {item.quantity  != null && <span className="text-[10px]" style={{ color: 'var(--ink-500)' }}>{item.quantity}개</span>}
                      {item.weight_kg != null && <span className="text-[10px]" style={{ color: 'var(--ink-500)' }}>{item.weight_kg} kg</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {tab === 'alerts' && (
              <div className="py-2">
                {detail.alerts.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[11px]" style={{ color: 'var(--ink-400)' }}>경고 없음</div>
                ) : detail.alerts.map((a, idx) => {
                  const color = a.severity === 'Critical' ? '#ef4444' : a.severity === 'Watch' ? '#eab308' : 'var(--ink-500)'
                  return (
                    <div
                      key={a.alert_id ?? idx}
                      className="px-4 py-2 border-b flex items-start gap-2"
                      style={{ borderColor: 'var(--ink-100)', opacity: a.status !== 'Open' ? 0.55 : 1 }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 4 }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold" style={{ color }}>{a.severity}</div>
                        {a.message    && <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-600)' }}>{a.message}</div>}
                        {a.alert_type && <div className="text-[9px] mt-0.5" style={{ color: 'var(--ink-400)' }}>{a.alert_type}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── Container list view ── */
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[11px]" style={{ color: 'var(--ink-400)' }}>
              컨테이너 없음
            </div>
          ) : sorted.map(c => (
            <button
              key={c.container_no}
              type="button"
              onClick={() => onSelect(c.container_no)}
              className="w-full text-left px-4 py-2 border-b flex items-start gap-2.5 transition-colors"
              style={{ borderColor: 'var(--ink-100)', background: 'transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ink-50)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <div style={{ paddingTop: 3 }}><SignalDot signal={c.signal} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[11px] font-semibold truncate" style={{ color: 'var(--ink-900)' }}>
                    {c.container_no}
                  </span>
                  {c.open_alert_count > 0 && (
                    <span className="text-[9px] font-mono font-bold flex-shrink-0 px-1 py-0.5 rounded" style={{ background: '#ef444415', color: '#ef4444' }}>
                      !{c.open_alert_count}
                    </span>
                  )}
                </div>
                <div className="text-[10px] truncate" style={{ color: 'var(--ink-500)' }}>
                  {c.origin ?? '—'} → {c.destination ?? '—'}
                </div>
                {c.current_location && (
                  <div className="text-[10px] truncate" style={{ color: 'var(--ink-400)' }}>{c.current_location}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Mapbox map ──────────────────────────────────────────────────────── */
const TOKEN = (import.meta as any).env?.MAPBOX_ACCESS_TOKEN as string | undefined

const MAP_COLOR: Record<TcrSignal, string> = {
  green: '#22c55e', blue: '#3b82f6', yellow: '#eab308', red: '#ef4444',
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
  const divRef     = useRef<HTMLDivElement>(null)
  const mapRef     = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const popupRef   = useRef<mapboxgl.Popup | null>(null)
  const inited     = useRef(false)

  const points = useMemo(
    () => containers.filter(c => c.latitude != null && c.longitude != null),
    [containers],
  )

  useEffect(() => {
    if (!divRef.current || !TOKEN || inited.current) return
    inited.current = true

    const map = new mapboxgl.Map({
      container: divRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [80, 48],
      zoom: 3,
      accessToken: TOKEN,
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    return () => {
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
      inited.current = false
    }
  }, [])

  // Fly to selected container
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedNo) return
    const c = containers.find(ct => ct.container_no === selectedNo)
    if (c?.latitude == null || c?.longitude == null) return
    const fly = () => map.flyTo({ center: [c.longitude!, c.latitude!], zoom: Math.max(map.getZoom(), 5), duration: 700 })
    if (map.isStyleLoaded()) fly(); else map.once('load', fly)
  }, [selectedNo, containers])

  // Redraw markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const draw = () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      popupRef.current?.remove()

      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })
      popupRef.current = popup

      for (const c of points) {
        const color = MAP_COLOR[c.signal]
        const isSel = c.container_no === selectedNo
        const el    = document.createElement('div')
        el.style.cssText = [
          `width:${isSel ? 15 : 10}px`,
          `height:${isSel ? 15 : 10}px`,
          'border-radius:50%',
          `background:${color}`,
          'border:2px solid white',
          `box-shadow:${isSel ? `0 0 0 3px ${color}60,0 2px 6px rgba(0,0,0,.3)` : '0 1px 4px rgba(0,0,0,.25)'}`,
          'cursor:pointer',
          'transition:transform .15s',
        ].join(';')
        el.addEventListener('click', () => onSelect(c.container_no))
        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.35)'
          popup.setLngLat([c.longitude!, c.latitude!])
            .setHTML(
              `<div style="font-size:11px;line-height:1.5">` +
              `<b style="font-family:monospace">${c.container_no}</b><br/>` +
              `<span style="color:${color};font-size:10px;font-weight:600">${SIG_LABEL[c.signal]}</span>` +
              (c.current_location ? `<br/><span style="color:#64748b;font-size:10px">${c.current_location}</span>` : '') +
              (c.destination ? `<br/><span style="color:#94a3b8;font-size:9px">→ ${c.destination}</span>` : '') +
              '</div>'
            ).addTo(map)
        })
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)'
          popup.remove()
        })
        markersRef.current.push(
          new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([c.longitude!, c.latitude!]).addTo(map)
        )
      }
    }

    if (map.isStyleLoaded()) draw(); else map.once('load', draw)
  }, [points, selectedNo, onSelect])

  if (!TOKEN) {
    return (
      <div className="flex-1 flex items-center justify-center rounded-lg border" style={{ borderColor: 'var(--ink-200)', background: 'var(--card)' }}>
        <span className="text-[11px]" style={{ color: 'var(--ink-400)' }}>Mapbox 토큰 없음</span>
      </div>
    )
  }
  return (
    <div className="flex-1 rounded-lg border overflow-hidden" style={{ borderColor: 'var(--ink-200)', minWidth: 0 }}>
      <div ref={divRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

/* ── Main page ───────────────────────────────────────────────────────── */
const ALL_COUNTRIES = ['UZ', 'KZ', 'KG', 'PL'] as const

export function TcrTrackingPage() {
  const [containers,    setContainers]    = useState<TcrContainer[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [lastFetch,     setLastFetch]     = useState<string | null>(null)
  const [refreshing,    setRefreshing]    = useState(false)

  // Country filter (all active by default)
  const [selCountries, setSelCountries] = useState<Set<CountryCode>>(new Set(['UZ', 'KZ', 'KG', 'PL']))

  // Signal filter (for detail panel)
  const [sigFilter, setSigFilter] = useState<TcrSignal | null>(null)

  // Selected container + detail
  const [selectedNo,    setSelectedNo]    = useState<string | null>(null)
  const [detail,        setDetail]        = useState<DetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  /* ── Fetch ─────────────────────────────────────────────────────────── */
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

  const fetchDetail = useCallback(async (no: string) => {
    setDetailLoading(true)
    try {
      const res  = await fetch(`/api/tcr?action=detail&container_no=${encodeURIComponent(no)}`)
      const json = await res.json() as DetailData
      if (!json.ok) throw new Error('Failed to load detail')
      setDetail(json)
    } catch {
      // keep previous
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const handleSelect = useCallback((no: string) => {
    if (no === selectedNo) { setSelectedNo(null); setDetail(null); return }
    setSelectedNo(no)
    setDetail(null)
    fetchDetail(no)
  }, [selectedNo, fetchDetail])

  /* ── Derived ────────────────────────────────────────────────────────── */
  // Country counts (all data, before filter)
  const countryCounts = useMemo(() => {
    const m: Partial<Record<CountryCode, number>> = {}
    containers.forEach(c => {
      const cc = destToCountry(c.destination)
      if (cc) m[cc] = (m[cc] ?? 0) + 1
    })
    return m
  }, [containers])

  // Filtered by selected countries (show unmatched when all selected)
  const filteredData = useMemo(() => {
    const allSel = ALL_COUNTRIES.every(cc => selCountries.has(cc))
    return containers.filter(c => {
      const cc = destToCountry(c.destination)
      return allSel ? true : (cc !== null && selCountries.has(cc))
    })
  }, [containers, selCountries])

  // Stats
  const stats = useMemo(() => {
    const m: Record<TcrSignal, number> = { green: 0, blue: 0, yellow: 0, red: 0 }
    filteredData.forEach(c => { m[c.signal]++ })
    return m
  }, [filteredData])

  const totalActive = stats.green + stats.blue + stats.yellow + stats.red

  // Action needed (open alerts, sorted by severity then days)
  const actionNeeded = useMemo(() =>
    filteredData
      .filter(c => c.open_alert_count > 0)
      .sort((a, b) => {
        const rankDiff = SIG_RANK[a.signal] - SIG_RANK[b.signal]
        if (rankDiff !== 0) return rankDiff
        return daysSince(a.eta_final) - daysSince(b.eta_final)
      })
      .slice(0, 8),
    [filteredData],
  )

  // Recent containers (by ETA ascending, not yet arrived)
  const recentContainers = useMemo(() =>
    [...filteredData]
      .filter(c => !c.ata_final)
      .sort((a, b) => (a.eta_final ?? '9999').localeCompare(b.eta_final ?? '9999'))
      .slice(0, 8),
    [filteredData],
  )

  // Map points
  const mapPoints = useMemo(() =>
    filteredData.filter(c => c.latitude != null && c.longitude != null),
    [filteredData],
  )

  /* ── Helpers ────────────────────────────────────────────────────────── */
  const toggleCountry = (cc: CountryCode) => {
    setSelCountries(prev => {
      const next = new Set(prev)
      if (next.has(cc)) next.delete(cc); else next.add(cc)
      return next
    })
  }
  const resetCountries = () => setSelCountries(new Set(['UZ', 'KZ', 'KG', 'PL']))

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div
      className="fesco-bookings-shell flex-1 flex flex-col overflow-hidden"
      style={{ background: 'var(--chat-bg)' }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="fesco-header flex-shrink-0"
        style={{ padding: '12px 28px 10px', marginBottom: 0 }}
      >
        {/* Row 1: title + stats + refresh */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-2.5">
              <Train size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
              <h1 style={{ fontSize: 20, margin: 0, flexShrink: 0 }}>
                중국경유 컨테이너 (TCR)
              </h1>
            </div>
            <span className="sub truncate" style={{ fontSize: 12, color: 'var(--ink-400)' }}>
              {loading ? 'Loading…' : `활성 ${containers.length}개 · ${fmtRelTime(lastFetch)}`}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {stats.red    > 0 && <StatPill count={stats.red}    color="#ef4444" label="조치필요" />}
            {stats.yellow > 0 && <StatPill count={stats.yellow} color="#eab308" label="주의" />}
            {stats.green  > 0 && <StatPill count={stats.green}  color="#22c55e" label="정상" />}
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={loading || refreshing}
              title="새로고침"
              className="w-7 h-7 flex items-center justify-center rounded-lg border transition-colors disabled:opacity-40"
              style={{ borderColor: 'var(--ink-300)', color: 'var(--ink-500)', background: 'transparent' }}
              onMouseEnter={e => { if (!loading && !refreshing) (e.currentTarget as HTMLButtonElement).style.background = 'var(--ink-100)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Row 2: destination filter chips */}
        <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-400)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            목적지
          </span>
          {DEST_COUNTRIES.map(({ code, label }) => (
            <CountryChip
              key={code}
              label={label}
              count={countryCounts[code as CountryCode] ?? 0}
              active={selCountries.has(code as CountryCode)}
              onClick={() => toggleCountry(code as CountryCode)}
            />
          ))}
          <button
            type="button"
            onClick={resetCountries}
            className="flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition-colors"
            style={{ borderColor: 'var(--ink-300)', color: 'var(--ink-500)', background: 'transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ink-100)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <X size={11} /> 초기화
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden p-4 flex flex-col gap-4 min-h-0">

        {/* Error */}
        {error && (
          <div
            className="rounded-lg border px-4 py-3 flex items-center gap-3 text-sm"
            style={{ background: 'var(--signal-red-bg)', borderColor: 'rgba(220,38,38,0.25)', color: 'var(--signal-red)' }}
          >
            <AlertCircle size={15} />
            <span className="flex-1">{error}</span>
            <button type="button" className="text-xs underline" onClick={() => fetchData()}>재시도</button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="flex-1 min-h-0 flex flex-col gap-4">
            <div className="flex-1 min-h-0 flex gap-4">
              <div className="flex-1 rounded-lg border animate-pulse" style={{ background: 'var(--card)', borderColor: 'var(--line)' }} />
              <div className="rounded-lg border animate-pulse flex-shrink-0" style={{ width: 320, background: 'var(--card)', borderColor: 'var(--line)' }} />
            </div>
            <div className="flex-shrink-0 flex gap-4" style={{ height: 260 }}>
              <div className="rounded-lg border animate-pulse flex-shrink-0" style={{ width: 240, background: 'var(--card)', borderColor: 'var(--line)' }} />
              <div className="flex-1 rounded-lg border animate-pulse" style={{ background: 'var(--card)', borderColor: 'var(--line)' }} />
              <div className="rounded-lg border animate-pulse flex-shrink-0" style={{ width: 320, background: 'var(--card)', borderColor: 'var(--line)' }} />
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="flex-1 min-h-0 flex flex-col gap-4">

            {/* ── Top: map + detail panel ──────────────────────────────── */}
            <div className="flex-1 min-h-0 flex gap-4">
              <TcrMap
                containers={mapPoints}
                selectedNo={selectedNo}
                onSelect={handleSelect}
              />
              <DetailPanel
                containers={filteredData}
                sigFilter={sigFilter}
                onSigFilter={s => setSigFilter(prev => prev === s ? null : s)}
                stats={stats}
                onSelect={handleSelect}
                selectedNo={selectedNo}
                detail={detail}
                detailLoading={detailLoading}
                onCloseDetail={() => { setSelectedNo(null); setDetail(null) }}
              />
            </div>

            {/* ── Bottom: donut + action needed + recent ────────────────── */}
            <div className="flex-shrink-0 flex gap-4" style={{ height: 260 }}>

              {/* Donut — 240px */}
              <div
                className="rounded-lg border flex items-center px-4 gap-3 flex-shrink-0"
                style={{ width: 240, borderColor: 'var(--ink-200)', background: 'var(--card)' }}
              >
                {totalActive > 0 ? (
                  <>
                    <DonutChart green={stats.green} blue={stats.blue} yellow={stats.yellow} red={stats.red} />
                    <div className="flex flex-col gap-2 min-w-0">
                      <LegendRow color="#22c55e" label="도착완료" count={stats.green} />
                      <LegendRow color="#3b82f6" label="운송중"   count={stats.blue} />
                      <LegendRow color="#eab308" label="주의"     count={stats.yellow} />
                      <LegendRow color="#ef4444" label="경고"     count={stats.red} />
                      <div className="mt-1 text-[10px] font-mono" style={{ color: 'var(--ink-400)' }}>
                        정상 {Math.round((stats.green / totalActive) * 100)}%
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-[11px]" style={{ color: 'var(--ink-400)' }}>
                    활성 컨테이너 없음
                  </div>
                )}
              </div>

              {/* Action needed — flex-2 */}
              <div
                className="rounded-lg border flex flex-col overflow-hidden"
                style={{ flex: '2 1 0', minWidth: 0, borderColor: 'var(--ink-200)', background: 'var(--card)' }}
              >
                <div
                  className="px-4 pt-3 pb-2 border-b flex items-center justify-between flex-shrink-0"
                  style={{ borderColor: 'var(--ink-200)' }}
                >
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-500)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                    조치 필요
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--ink-400)' }}>{actionNeeded.length}개</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {actionNeeded.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-[11px]" style={{ color: 'var(--ink-400)' }}>
                      조치 필요 없음
                    </div>
                  ) : actionNeeded.map(c => {
                    const color = SIG_COLOR[c.signal]
                    return (
                      <button
                        key={c.container_no}
                        type="button"
                        onClick={() => handleSelect(c.container_no)}
                        className="w-full text-left px-4 py-1.5 border-b flex items-center gap-2 transition-colors"
                        style={{ borderColor: 'var(--ink-100)', background: 'transparent' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ink-50)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-semibold" style={{ color: 'var(--ink-900)' }}>{c.container_no}</span>
                            {c.open_alert_count > 0 && (
                              <span className="text-[9px] font-mono px-1 py-0.5 rounded" style={{ background: `${color}15`, color }}>{c.open_alert_count}개 경고</span>
                            )}
                          </div>
                          <div className="text-[10px] truncate" style={{ color: 'var(--ink-500)' }}>
                            {c.origin ?? '—'} → {c.destination ?? '—'}
                          </div>
                        </div>
                        {c.eta_final && !c.ata_final && (
                          <span
                            className="flex-shrink-0 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: `${color}15`, color }}
                          >
                            +{daysSince(c.eta_final)}일
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Recent containers — 320px */}
              <div
                className="rounded-lg border flex flex-col overflow-hidden flex-shrink-0"
                style={{ width: 320, borderColor: 'var(--ink-200)', background: 'var(--card)' }}
              >
                <div
                  className="px-4 pt-3 pb-2 border-b flex items-center justify-between flex-shrink-0"
                  style={{ borderColor: 'var(--ink-200)' }}
                >
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-500)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                    ETA 임박
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] font-medium" style={{ color: 'var(--mint-deep)' }}>
                    <ChevronRight size={10} />
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {recentContainers.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-[11px]" style={{ color: 'var(--ink-400)' }}>
                      운송중 컨테이너 없음
                    </div>
                  ) : recentContainers.map(c => (
                    <button
                      key={c.container_no}
                      type="button"
                      onClick={() => handleSelect(c.container_no)}
                      className="w-full text-left px-4 py-1.5 border-b flex items-center gap-2 transition-colors"
                      style={{ borderColor: 'var(--ink-100)', background: 'transparent' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ink-50)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                    >
                      <SignalDot signal={c.signal} />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[11px] font-medium truncate" style={{ color: 'var(--ink-900)' }}>
                          {c.container_no}
                        </div>
                        <div className="text-[10px] truncate" style={{ color: 'var(--ink-500)' }}>
                          {c.origin ?? '—'} → {c.destination ?? '—'}
                        </div>
                      </div>
                      {c.eta_final && (
                        <span className="flex-shrink-0 text-[10px] font-mono" style={{ color: 'var(--ink-400)' }}>
                          {fmtDate(c.eta_final)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TcrTrackingPage
