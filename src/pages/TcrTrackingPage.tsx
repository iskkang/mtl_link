import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, AlertCircle, X, Train, Package, Upload } from 'lucide-react'
import { ContainerMap } from '../components/tracking/ContainerMap'
import type { ContainerPoint, ContainerPopupData, WeatherAlert } from '../components/tracking/ContainerMap'
import { useIsMobile } from '../hooks/useIsMobile'

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

/* ── TCR signal → ContainerMap signal ──────────────────────────────── */
function tcrToMapSignal(s: TcrSignal): ContainerPoint['signal'] {
  if (s === 'red')    return 'red'
  if (s === 'yellow') return 'yellow'
  if (s === 'blue')   return 'green'
  return 'gray'
}

/* ── Destination → country ──────────────────────────────────────────── */
const DEST_COUNTRIES = [
  { code: 'UZ', label: '우즈베키스탄', kw: ['tashkent', 'andijan', 'namangan', 'samarkand', 'bukhara', 'termez', 'chukursay', 'fergana', 'urgench', 'nukus'] },
  { code: 'KZ', label: '카자흐스탄',   kw: ['almaty', 'astana', 'nur-sultan', 'shymkent', 'aktau', 'aktobe', 'taraz', 'karaganda', 'semey', 'pavlodar'] },
  { code: 'KG', label: '키르기스스탄', kw: ['bishkek', 'osh', 'jalal', 'karakol', 'tokmok'] },
  { code: 'PL', label: '폴란드',       kw: ['warsaw', 'lodz', 'krakow', 'gdansk', 'poznan', 'wroclaw', 'katowice', 'szczecin', 'małaszewicze', 'malaszewicze', 'poland'] },
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

/* ── Signal dot ──────────────────────────────────────────────────────── */
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

/* ── Stat pill ───────────────────────────────────────────────────────── */
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
function DonutChart({ green, blue, yellow, red, size = 104 }: { green: number; blue: number; yellow: number; red: number; size?: number }) {
  const total = green + blue + yellow + red
  const CX = size / 2
  const R  = Math.round(size * 0.365)
  const SW = Math.round(size * 0.125)
  const C  = 2 * Math.PI * R
  const fs1 = Math.round(size * 0.173)
  const fs2 = Math.round(size * 0.067)
  if (total === 0) return (
    <svg width={CX * 2} height={CX * 2}>
      <circle cx={CX} cy={CX} r={R} fill="none" strokeWidth={SW} stroke="var(--ink-100)" />
      <text x={CX} y={CX + 5} textAnchor="middle" fontSize={Math.round(size * 0.105)} fill="var(--ink-400)" fontFamily="var(--font-body)">0</text>
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
      <text x={CX} y={CX - 3} textAnchor="middle" fontSize={fs1} fontWeight="700"
        fill="var(--ink-900)" fontFamily="var(--font-body)">{total}</text>
      <text x={CX} y={CX + fs2 + 3} textAnchor="middle" fontSize={fs2} fontWeight="600"
        fill="var(--ink-500)" letterSpacing="1.5" fontFamily="var(--font-mono)">ACTIVE</text>
    </svg>
  )
}

/* ── Detail panel ────────────────────────────────────────────────────── */
function DetailPanel({
  containers,
  mapSelectionCount,
  sigFilter,
  onSigFilter,
  stats,
  onSelect,
  selectedNo,
  detail,
  detailLoading,
  onCloseDetail,
  onClearMapSelection,
  searchActive,
  onClearSearch,
}: {
  containers:          TcrContainer[]
  mapSelectionCount:   number | null
  sigFilter:           TcrSignal | null
  onSigFilter:         (s: TcrSignal) => void
  stats:               Record<TcrSignal, number>
  onSelect:            (no: string) => void
  selectedNo:          string | null
  detail:              DetailData | null
  detailLoading:       boolean
  onCloseDetail:       () => void
  onClearMapSelection: () => void
  searchActive:        boolean
  onClearSearch:       () => void
}) {
  const [tab, setTab] = useState<'segments' | 'items' | 'alerts'>('segments')

  // When search is active, show results as-is (no sig filter, no sort override needed)
  const filtered = useMemo(() =>
    searchActive || !sigFilter ? containers : containers.filter(c => c.signal === sigFilter),
    [containers, sigFilter, searchActive],
  )
  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => SIG_RANK[a.signal] - SIG_RANK[b.signal]),
    [filtered],
  )

  useEffect(() => { if (detail) setTab('segments') }, [detail])

  const showDetail = !!(selectedNo && detail)

  return (
    <div
      className="rounded-lg border flex flex-col overflow-hidden"
      style={{ width: '100%', height: '100%', borderColor: 'var(--ink-200)', background: 'var(--card)' }}
    >
      {/* Header */}
      <div
        className="px-4 pt-3 pb-2 border-b flex-shrink-0"
        style={{ borderColor: 'var(--ink-200)' }}
      >
        {showDetail ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SignalDot signal={detail!.container.signal} />
              <span className="font-mono text-[12px] font-bold" style={{ color: 'var(--ink-900)' }}>
                {detail!.container.container_no}
              </span>
              <span
                className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: `${SIG_COLOR[detail!.container.signal]}15`, color: SIG_COLOR[detail!.container.signal] }}
              >
                {SIG_LABEL[detail!.container.signal]}
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
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-500)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              {searchActive ? '검색 결과' : '컨테이너 현황'}
            </span>
            {searchActive ? (
              <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--ink-500)' }}>
                <span className="font-mono">{containers.length}개</span>
                <button
                  type="button"
                  onClick={onClearSearch}
                  className="flex items-center gap-0.5 font-medium"
                  style={{ color: 'var(--ink-400)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <X size={10} /> 초기화
                </button>
              </div>
            ) : mapSelectionCount !== null ? (
              <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--ink-500)' }}>
                <span>{mapSelectionCount}개 선택됨</span>
                <button
                  type="button"
                  onClick={onClearMapSelection}
                  className="flex items-center gap-0.5 font-medium"
                  style={{ color: 'var(--ink-400)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <X size={10} /> 해제
                </button>
              </div>
            ) : sigFilter ? (
              <button
                type="button"
                onClick={() => onSigFilter(sigFilter)}
                className="text-[10px] flex items-center gap-1"
                style={{ color: 'var(--ink-400)', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <X size={9} /> 필터 해제
              </button>
            ) : null}
          </div>
        )}

        {!showDetail && !searchActive && (
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
      ) : showDetail ? (
        <>
          {/* Route info */}
          <div
            className="px-4 py-2 border-b flex-shrink-0 flex gap-4"
            style={{ borderColor: 'var(--ink-200)', background: 'var(--ink-50)' }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-[10px] truncate" style={{ color: 'var(--ink-500)' }}>
                {detail!.container.origin ?? '—'} → {detail!.container.destination ?? '—'}
              </div>
              {detail!.container.current_segment_name && (
                <div className="text-[9px] mt-0.5 truncate" style={{ color: 'var(--ink-400)' }}>
                  구간: {detail!.container.current_segment_name}
                </div>
              )}
            </div>
            {detail!.container.eta_final && !detail!.container.ata_final && (
              <div className="flex-shrink-0">
                <div className="text-[9px] font-mono uppercase" style={{ color: 'var(--ink-400)' }}>ETA</div>
                <div className="text-[10px] font-semibold" style={{ color: 'var(--ink-800)' }}>{fmtDate(detail!.container.eta_final)}</div>
              </div>
            )}
            {detail!.container.ata_final && (
              <div className="flex-shrink-0">
                <div className="text-[9px] font-mono uppercase" style={{ color: 'var(--ink-400)' }}>ATA</div>
                <div className="text-[10px] font-semibold" style={{ color: '#22c55e' }}>{fmtDate(detail!.container.ata_final)}</div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b flex-shrink-0" style={{ borderColor: 'var(--ink-200)' }}>
            {(['segments', 'items', 'alerts'] as const).map(t => {
              const badge = t === 'items'
                ? detail!.items.length
                : t === 'alerts'
                  ? detail!.alerts.filter(a => a.status === 'Open').length
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
                {detail!.segments.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[11px]" style={{ color: 'var(--ink-400)' }}>구간 정보 없음</div>
                ) : detail!.segments.map((s, idx) => (
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
                      {idx < detail!.segments.length - 1 && (
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
                {detail!.items.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[11px]" style={{ color: 'var(--ink-400)' }}>
                    <Package size={20} style={{ margin: '0 auto 8px', color: 'var(--ink-300)' }} />
                    화물 정보 없음
                  </div>
                ) : detail!.items.map((item, idx) => (
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
                {detail!.alerts.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[11px]" style={{ color: 'var(--ink-400)' }}>경고 없음</div>
                ) : detail!.alerts.map((a, idx) => {
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
        /* Container list */
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

/* ── Mobile icon button style ────────────────────────────────────────── */
const mobileIconBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 30, height: 30, borderRadius: 8,
  border: '1px solid var(--ink-300)',
  color: 'var(--ink-500)', background: 'transparent', cursor: 'pointer',
}

/* ── Mobile TCR view ─────────────────────────────────────────────────── */
interface MobileTcrViewProps {
  mapPoints:                ContainerPoint[]
  allContainerNumbers:      string[]
  containerDetails:         Record<string, ContainerPopupData>
  weatherAlerts:            WeatherAlert[]
  stats:                    Record<TcrSignal, number>
  panelStats:               Record<TcrSignal, number>
  detailPanelContainers:    TcrContainer[]
  sigFilter:                TcrSignal | null
  searchResults:            TcrContainer[] | null
  selCountries:             Set<CountryCode>
  countryCounts:            Partial<Record<CountryCode, number>>
  selectedContainerNumbers: string[] | null
  selectedNo:               string | null
  detail:                   DetailData | null
  detailLoading:            boolean
  searchInput:              string
  setSearchInput:           (v: string) => void
  searchQuery:              string
  setSearchQuery:           (v: string) => void
  loading:                  boolean
  refreshing:               boolean
  showDetailOverlay:        boolean
  onRefresh:                () => void
  onUpload:                 () => void
  onToggleCountry:          (cc: CountryCode) => void
  onResetCountries:         () => void
  onSigFilter:              (s: TcrSignal) => void
  onSelectContainers:       (nums: string[]) => void
  onClearSelection:         () => void
  onSelect:                 (no: string) => void
  onCloseDetail:            () => void
  onClearSearch:            () => void
}

function MobileTcrView({
  mapPoints, allContainerNumbers, containerDetails, weatherAlerts,
  stats, panelStats, detailPanelContainers, sigFilter, searchResults,
  selCountries, countryCounts, selectedContainerNumbers, selectedNo,
  detail, detailLoading, searchInput, setSearchInput, searchQuery, setSearchQuery,
  loading, refreshing, showDetailOverlay, onRefresh, onUpload,
  onToggleCountry, onResetCountries, onSigFilter, onSelectContainers, onClearSelection,
  onSelect, onCloseDetail, onClearSearch,
}: MobileTcrViewProps) {
  const [mobileTab, setMobileTab] = useState<'all' | 'alerts'>('all')
  const alertCount  = stats.red + stats.yellow

  const listContainers = useMemo(() => {
    const base = searchResults ?? detailPanelContainers
    const src  = mobileTab === 'alerts'
      ? base.filter(c => c.signal === 'red' || c.signal === 'yellow')
      : base
    return [...src].sort((a, b) => SIG_RANK[a.signal] - SIG_RANK[b.signal])
  }, [mobileTab, searchResults, detailPanelContainers])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--chat-bg)', overflow: 'hidden' }}>

      {/* [1] Header */}
      <div style={{ flexShrink: 0, padding: '12px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Train size={16} style={{ color: '#3b82f6', flexShrink: 0 }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>TCR 트래킹</span>
          {alertCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, background: `${stats.red > 0 ? '#ef4444' : '#eab308'}18`, color: stats.red > 0 ? '#ef4444' : '#eab308', borderRadius: 10, padding: '1px 7px' }}>
              {alertCount}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" onClick={onUpload} style={mobileIconBtn} title="파일 업로드">
            <Upload size={14} />
          </button>
          <button type="button" onClick={onRefresh} disabled={loading || refreshing} style={{ ...mobileIconBtn, opacity: loading || refreshing ? 0.4 : 1 }} title="새로고침">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* [2] Country filter chips */}
      <div style={{ flexShrink: 0, display: 'flex', overflowX: 'auto', gap: 6, padding: '0 14px 8px', scrollbarWidth: 'none' }}>
        {DEST_COUNTRIES.map(({ code, label }) => (
          <CountryChip
            key={code}
            label={label}
            count={countryCounts[code as CountryCode] ?? 0}
            active={selCountries.has(code as CountryCode)}
            onClick={() => onToggleCountry(code as CountryCode)}
          />
        ))}
        <button
          type="button"
          onClick={onResetCountries}
          style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 20, border: '1px solid var(--ink-300)', color: 'var(--ink-500)', background: 'transparent', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          초기화
        </button>
      </div>

      {/* [3] Search bar */}
      <div style={{ flexShrink: 0, padding: '0 14px 8px' }}>
        <div style={{ display: 'flex', height: 34, background: 'var(--card)', borderRadius: 8, border: `1px solid ${searchQuery ? 'var(--brand)' : 'var(--ink-300)'}`, overflow: 'hidden' }}>
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setSearchQuery(searchInput) }}
            placeholder="컨테이너 / 고객명 검색…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '0 10px', fontSize: 13, color: 'var(--ink-800)' }}
          />
          {searchInput && (
            <button type="button" onClick={() => { setSearchInput(''); setSearchQuery('') }}
              style={{ padding: '0 6px', color: 'var(--ink-400)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <X size={12} />
            </button>
          )}
          <button type="button" onClick={() => setSearchQuery(searchInput)}
            style={{ padding: '0 14px', background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
            검색
          </button>
        </div>
      </div>

      {/* [4] Map */}
      <div style={{ flexShrink: 0, height: '42vh', margin: '0 14px 8px', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--ink-200)' }}>
        {loading ? (
          <div style={{ width: '100%', height: '100%', background: 'var(--card)', borderRadius: 10 }} className="animate-pulse" />
        ) : (
          <ContainerMap
            containers={mapPoints}
            allContainerNumbers={allContainerNumbers}
            containerDetails={containerDetails}
            onSelectContainers={onSelectContainers}
            onClearSelection={onClearSelection}
            showFescoLink={false}
            detailApiUrl={() => null}
            onSearchSelect={cn => onSelectContainers([cn])}
            weatherAlerts={weatherAlerts}
            hideSearch
          />
        )}
      </div>

      {/* [5] Summary card */}
      <div style={{ flexShrink: 0, margin: '0 14px 8px', background: 'var(--card)', borderRadius: 10, border: '1px solid var(--ink-200)', display: 'flex', alignItems: 'center', padding: '8px 14px', gap: 12 }}>
        <DonutChart green={stats.green} blue={stats.blue} yellow={stats.yellow} red={stats.red} size={74} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
          <LegendRow color="#22c55e" label="도착완료" count={stats.green} />
          <LegendRow color="#3b82f6" label="운송중"   count={stats.blue} />
          <LegendRow color="#eab308" label="주의"     count={stats.yellow} />
          <LegendRow color="#ef4444" label="경고"     count={stats.red} />
        </div>
      </div>

      {/* [6] Container list with tabs */}
      <div style={{ flex: 1, minHeight: 0, margin: '0 14px', background: 'var(--card)', borderRadius: '10px 10px 0 0', border: '1px solid var(--ink-200)', borderBottom: 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flexShrink: 0, display: 'flex', borderBottom: '1px solid var(--ink-200)' }}>
          {([
            { key: 'all'    as const, label: '현황',  badge: null },
            { key: 'alerts' as const, label: '경고',  badge: alertCount > 0 ? alertCount : null },
          ]).map(({ key, label, badge }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMobileTab(key)}
              style={{
                flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 600,
                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                borderBottom: `2px solid ${mobileTab === key ? 'var(--brand)' : 'transparent'}`,
                color: mobileTab === key ? 'var(--ink-900)' : 'var(--ink-400)',
                background: 'transparent', cursor: 'pointer',
              }}
            >
              {label}
              {badge != null && (
                <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 700, color: '#ef4444' }}>{badge}</span>
              )}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="animate-pulse" style={{ height: 56, background: 'var(--ink-100)', borderRadius: 8 }} />
              ))}
            </div>
          ) : listContainers.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--ink-400)' }}>
              {mobileTab === 'alerts' ? '경고 없음' : '컨테이너 없음'}
            </div>
          ) : listContainers.map(c => (
            <button
              key={c.container_no}
              type="button"
              onClick={() => onSelect(c.container_no)}
              style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: '1px solid var(--ink-100)', background: 'transparent', display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, cursor: 'pointer' }}
            >
              <SignalDot signal={c.signal} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--ink-900)' }}>
                    {c.container_no}
                  </span>
                  {c.open_alert_count > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#ef444415', color: '#ef4444', borderRadius: 4, padding: '1px 4px' }}>
                      !{c.open_alert_count}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.origin ?? '—'} → {c.destination ?? '—'}
                </div>
              </div>
              {c.eta_final && !c.ata_final && (
                <span style={{ flexShrink: 0, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-400)' }}>
                  {fmtDate(c.eta_final)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* [7] Detail fullscreen overlay */}
      <div
        style={{
          position: 'fixed', inset: 0,
          transform: showDetailOverlay ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.25s cubic-bezier(.4,0,.2,1)',
          zIndex: 100, pointerEvents: showDetailOverlay ? 'auto' : 'none',
          background: 'var(--card)', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ height: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 8 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--ink-300)' }} />
        </div>
        <button
          type="button"
          onClick={onClearSelection}
          style={{ position: 'absolute', top: 4, right: 12, color: 'var(--ink-400)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 6 }}
        >
          <X size={18} />
        </button>
        <div style={{ flex: 1, minHeight: 0 }}>
          <DetailPanel
            containers={detailPanelContainers}
            mapSelectionCount={searchResults !== null ? null : selectedContainerNumbers !== null ? selectedContainerNumbers.length : null}
            sigFilter={sigFilter}
            onSigFilter={onSigFilter}
            stats={panelStats}
            onSelect={onSelect}
            selectedNo={selectedNo}
            detail={detail}
            detailLoading={detailLoading}
            onCloseDetail={onCloseDetail}
            onClearMapSelection={onClearSelection}
            searchActive={searchResults !== null}
            onClearSearch={onClearSearch}
          />
        </div>
      </div>
    </div>
  )
}

/* ── Main page ───────────────────────────────────────────────────────── */
const ALL_COUNTRIES = ['UZ', 'KZ', 'KG', 'PL'] as const

export function TcrTrackingPage() {
  const navigate = useNavigate()
  const [containers,    setContainers]    = useState<TcrContainer[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [lastFetch,     setLastFetch]     = useState<string | null>(null)
  const [refreshing,    setRefreshing]    = useState(false)
  const [weatherAlerts, setWeatherAlerts] = useState<WeatherAlert[]>([])

  const [selCountries,  setSelCountries]  = useState<Set<CountryCode>>(new Set(['UZ', 'KZ', 'KG', 'PL']))
  const [sigFilter,     setSigFilter]     = useState<TcrSignal | null>(null)
  const [searchInput,   setSearchInput]   = useState('')
  const [searchQuery,   setSearchQuery]   = useState('')

  // Map cluster/marker selection
  const [selectedContainerNumbers, setSelectedContainerNumbers] = useState<string[] | null>(null)

  // Single container detail
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

  useEffect(() => {
    fetch('/api/tcr?action=weather')
      .then(r => r.json())
      .then(j => { if (Array.isArray(j.alerts)) setWeatherAlerts(j.alerts) })
      .catch(() => {})
  }, [])

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

  /* ── Selection handlers ─────────────────────────────────────────────── */
  const handleSelectContainers = useCallback((nums: string[]) => {
    setSelectedContainerNumbers(nums)
    setSigFilter(null)
    if (nums.length === 1) {
      const no = nums[0]
      setSelectedNo(no)
      setDetail(null)
      fetchDetail(no)
    } else {
      setSelectedNo(null)
      setDetail(null)
    }
  }, [fetchDetail])

  const handleClearSelection = useCallback(() => {
    setSelectedContainerNumbers(null)
    setSigFilter(null)
    setSelectedNo(null)
    setDetail(null)
  }, [])

  const clearSearch = useCallback(() => {
    setSearchInput('')
    setSearchQuery('')
  }, [])

  const handleSelect = useCallback((no: string) => {
    if (no === selectedNo) { setSelectedNo(null); setDetail(null); return }
    setSelectedNo(no)
    setDetail(null)
    fetchDetail(no)
  }, [selectedNo, fetchDetail])

  /* ── Derived ────────────────────────────────────────────────────────── */
  const countryCounts = useMemo(() => {
    const m: Partial<Record<CountryCode, number>> = {}
    containers.forEach(c => {
      const cc = destToCountry(c.destination)
      if (cc) m[cc] = (m[cc] ?? 0) + 1
    })
    return m
  }, [containers])

  const filteredData = useMemo(() => {
    const allSel = ALL_COUNTRIES.every(cc => selCountries.has(cc))
    return containers.filter(c => {
      const cc = destToCountry(c.destination)
      return allSel ? true : (cc !== null && selCountries.has(cc))
    })
  }, [containers, selCountries])

  // Global stats (header pills)
  const stats = useMemo(() => {
    const m: Record<TcrSignal, number> = { green: 0, blue: 0, yellow: 0, red: 0 }
    filteredData.forEach(c => { m[c.signal]++ })
    return m
  }, [filteredData])

  const totalActive = stats.green + stats.blue + stats.yellow + stats.red

  // Full-list search: covers all fetched containers (incl. arrived)
  const searchResults = useMemo<TcrContainer[] | null>(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return null
    return containers.filter(c =>
      c.container_no.toLowerCase().includes(q) ||
      (c.customer_list?.toLowerCase().includes(q) ?? false),
    )
  }, [containers, searchQuery])

  // Detail panel containers: search > cluster > full list
  const detailPanelContainers = useMemo(() => {
    if (searchResults !== null) return searchResults
    if (selectedContainerNumbers !== null) {
      const selSet = new Set(selectedContainerNumbers)
      return filteredData.filter(c => selSet.has(c.container_no))
    }
    return filteredData
  }, [searchResults, selectedContainerNumbers, filteredData])

  // Stats for the detail panel signal chips
  const panelStats = useMemo(() => {
    const m: Record<TcrSignal, number> = { green: 0, blue: 0, yellow: 0, red: 0 }
    detailPanelContainers.forEach(c => { m[c.signal]++ })
    return m
  }, [detailPanelContainers])

  // Destination breakdown for status card
  const destStats = useMemo(() => {
    const init = (): { active: number; arrived: number } => ({ active: 0, arrived: 0 })
    const m: Record<CountryCode, { active: number; arrived: number }> = {
      UZ: init(), KZ: init(), KG: init(), PL: init(),
    }
    for (const c of filteredData) {
      const cc = destToCountry(c.destination)
      if (!cc) continue
      if (c.signal === 'green') m[cc].arrived++
      else m[cc].active++
    }
    return m
  }, [filteredData])

  // ETA-ascending list
  const recentContainers = useMemo(() =>
    [...filteredData]
      .filter(c => !c.ata_final)
      .sort((a, b) => (a.eta_final ?? '9999').localeCompare(b.eta_final ?? '9999'))
      .slice(0, 8),
    [filteredData],
  )

  // ContainerMap data — in-transit only (arrived_yn=true → signal='green' → excluded)
  const mapPoints = useMemo<ContainerPoint[]>(() =>
    filteredData
      .filter(c => c.signal !== 'green' && c.latitude != null && c.longitude != null)
      .map(c => ({
        containerNumber: c.container_no,
        latitude:        c.latitude!,
        longitude:       c.longitude!,
        signal:          tcrToMapSignal(c.signal),
      })),
    [filteredData],
  )

  const containerDetails = useMemo<Record<string, ContainerPopupData>>(() => {
    const m: Record<string, ContainerPopupData> = {}
    for (const c of filteredData) {
      m[c.container_no] = {
        signal:                   tcrToMapSignal(c.signal),
        current_from:             c.origin,
        current_to:               c.destination,
        last_event_location:      c.current_location,
        last_success_at:          null,
        planned_destination_date: c.eta_final,
        alert_reason:             c.open_alert_count > 0 ? `${c.open_alert_count}개 경고` : null,
      }
    }
    return m
  }, [filteredData])

  const allContainerNumbers = useMemo(
    () => containers.map(c => c.container_no),
    [containers],
  )

  const isMobile = useIsMobile()
  const showDetailOverlay =
    searchResults !== null || selectedNo !== null || selectedContainerNumbers !== null

  /* ── Filter helpers ─────────────────────────────────────────────────── */
  const toggleCountry = (cc: CountryCode) => {
    setSelCountries(prev => {
      const next = new Set(prev)
      if (next.has(cc)) next.delete(cc); else next.add(cc)
      return next
    })
  }
  const resetCountries = () => setSelCountries(new Set(['UZ', 'KZ', 'KG', 'PL']))

  /* ── Mobile branch ─────────────────────────────────────────────────── */
  if (isMobile) {
    return (
      <MobileTcrView
        mapPoints={mapPoints}
        allContainerNumbers={allContainerNumbers}
        containerDetails={containerDetails}
        weatherAlerts={weatherAlerts}
        stats={stats}
        panelStats={panelStats}
        detailPanelContainers={detailPanelContainers}
        sigFilter={sigFilter}
        searchResults={searchResults}
        selCountries={selCountries}
        countryCounts={countryCounts}
        selectedContainerNumbers={selectedContainerNumbers}
        selectedNo={selectedNo}
        detail={detail}
        detailLoading={detailLoading}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        loading={loading}
        refreshing={refreshing}
        showDetailOverlay={showDetailOverlay}
        onRefresh={() => fetchData(true)}
        onUpload={() => navigate('/tcr-upload')}
        onToggleCountry={toggleCountry}
        onResetCountries={resetCountries}
        onSigFilter={s => setSigFilter(prev => prev === s ? null : s)}
        onSelectContainers={handleSelectContainers}
        onClearSelection={handleClearSelection}
        onSelect={handleSelect}
        onCloseDetail={() => { setSelectedNo(null); setDetail(null) }}
        onClearSearch={clearSearch}
      />
    )
  }

  /* ── Desktop render ─────────────────────────────────────────────────── */
  return (
    <div
      className="fesco-bookings-shell flex-1 flex flex-col overflow-hidden"
      style={{ background: 'var(--chat-bg)' }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="fesco-header flex-shrink-0"
        style={{ padding: isMobile ? '8px 12px' : '12px 28px 10px', marginBottom: 0 }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-2.5">
              <Train size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
              <h1 style={{ fontSize: isMobile ? 16 : 20, margin: 0, flexShrink: 0 }}>
                중국경유 컨테이너 (TCR)
              </h1>
            </div>
            {!isMobile && (
              <span className="sub truncate" style={{ fontSize: 12, color: 'var(--ink-400)' }}>
                {loading ? 'Loading…' : `${containers.length}개 · 운송중 + 60일 이내 도착 · ${fmtRelTime(lastFetch)}`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!isMobile && stats.red    > 0 && <StatPill count={stats.red}    color="#ef4444" label="조치필요" />}
            {!isMobile && stats.yellow > 0 && <StatPill count={stats.yellow} color="#eab308" label="주의" />}
            {!isMobile && stats.green  > 0 && <StatPill count={stats.green}  color="#22c55e" label="도착완료" />}
            <button
              type="button"
              onClick={() => navigate('/tcr-upload')}
              title="파일 업로드"
              className="flex items-center gap-1.5 rounded-lg border transition-colors"
              style={{
                borderColor: 'var(--ink-300)', color: 'var(--ink-500)', background: 'transparent',
                padding: isMobile ? '5px 6px' : '4px 10px',
                fontSize: 12,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ink-100)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <Upload size={13} />{!isMobile && <span style={{ marginLeft: 4 }}>파일 업로드</span>}
            </button>
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

        {/* Destination filter chips + search */}
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

          {/* Search input */}
          <div className="flex items-center gap-1 ml-auto">
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') setSearchQuery(searchInput) }}
                placeholder="컨테이너 번호 / 고객명 검색…"
                className="pl-2.5 pr-7 py-0.5 rounded border text-[11px] outline-none"
                style={{
                  width: 220,
                  borderColor: searchQuery ? 'var(--brand)' : 'var(--ink-300)',
                  background: 'var(--card)',
                  color: 'var(--ink-800)',
                }}
              />
              {searchInput ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-1.5 flex items-center"
                  style={{ color: 'var(--ink-400)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <X size={10} />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setSearchQuery(searchInput)}
              className="px-2 py-0.5 rounded border text-[11px] font-medium transition-colors"
              style={{ borderColor: 'var(--brand)', color: 'var(--brand)', background: 'transparent' }}
            >
              검색
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-hidden flex flex-col min-h-0"
        style={{ padding: isMobile ? 8 : 16, gap: isMobile ? 8 : 16 }}
      >

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

        {loading && (
          <div className="flex-1 min-h-0 flex flex-col gap-4">
            <div className="flex-1 rounded-lg border animate-pulse" style={{ background: 'var(--card)', borderColor: 'var(--line)' }} />
            <div className="flex-shrink-0 flex gap-4" style={{ height: 180 }}>
              <div className="flex-1 rounded-lg border animate-pulse" style={{ background: 'var(--card)', borderColor: 'var(--line)' }} />
              <div className="flex-1 rounded-lg border animate-pulse" style={{ background: 'var(--card)', borderColor: 'var(--line)' }} />
              <div className="flex-1 rounded-lg border animate-pulse" style={{ background: 'var(--card)', borderColor: 'var(--line)' }} />
            </div>
          </div>
        )}

        {!loading && !error && (() => {
          return (
            <div className="flex-1 min-h-0 flex flex-col" style={{ gap: isMobile ? 8 : 16 }}>

              {/* ── Top: full-width map ── */}
              <div
                className={`${isMobile ? 'flex-shrink-0' : 'flex-1 min-h-0'} rounded-lg border overflow-hidden`}
                style={{ position: 'relative', borderColor: 'var(--ink-200)', ...(isMobile ? { height: '45vh' } : {}) }}
              >
                <ContainerMap
                  containers={mapPoints}
                  allContainerNumbers={allContainerNumbers}
                  containerDetails={containerDetails}
                  onSelectContainers={handleSelectContainers}
                  onClearSelection={handleClearSelection}
                  showFescoLink={false}
                  detailApiUrl={() => null}
                  onSearchSelect={cn => handleSelectContainers([cn])}
                  weatherAlerts={weatherAlerts}
                />

                {/* Desktop: slide-in overlay from right */}
                {!isMobile && (
                  <div
                    style={{
                      position:       'absolute',
                      top:            0,
                      right:          0,
                      width:          320,
                      height:         '100%',
                      transform:      showDetailOverlay ? 'translateX(0)' : 'translateX(100%)',
                      transition:     'transform 0.22s cubic-bezier(.4,0,.2,1)',
                      zIndex:         10,
                      pointerEvents:  showDetailOverlay ? 'auto' : 'none',
                      boxShadow:      showDetailOverlay ? '-4px 0 16px rgba(0,0,0,0.12)' : 'none',
                    }}
                  >
                    <DetailPanel
                      containers={detailPanelContainers}
                      mapSelectionCount={searchResults !== null ? null : selectedContainerNumbers !== null ? selectedContainerNumbers.length : null}
                      sigFilter={sigFilter}
                      onSigFilter={s => setSigFilter(prev => prev === s ? null : s)}
                      stats={panelStats}
                      onSelect={handleSelect}
                      selectedNo={selectedNo}
                      detail={detail}
                      detailLoading={detailLoading}
                      onCloseDetail={() => { setSelectedNo(null); setDetail(null) }}
                      onClearMapSelection={handleClearSelection}
                      searchActive={searchResults !== null}
                      onClearSearch={clearSearch}
                    />
                  </div>
                )}
              </div>

              {/* ── Bottom: Donut | 현황 | ETA ─────────────────────────── */}
              <div
                className="flex-shrink-0 flex gap-4"
                style={{
                  height: isMobile ? undefined : 180,
                  ...(isMobile ? {
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    scrollSnapType: 'x mandatory',
                    paddingBottom: 4,
                  } : {}),
                }}
              >

                {/* Card 1 — Donut */}
                <div
                  className="flex-1 rounded-lg border flex items-center px-4 gap-3"
                  style={{ borderColor: 'var(--ink-200)', background: 'var(--card)', minWidth: 0, ...(isMobile ? { minWidth: '75vw', scrollSnapAlign: 'start', height: 160, flexShrink: 0 } : {}) }}
                >
                  {totalActive > 0 ? (
                    <>
                      <DonutChart green={stats.green} blue={stats.blue} yellow={stats.yellow} red={stats.red} />
                      <div className="flex flex-col gap-1.5 min-w-0">
                        <LegendRow color="#22c55e" label="도착완료" count={stats.green} />
                        <LegendRow color="#3b82f6" label="운송중"   count={stats.blue} />
                        <LegendRow color="#eab308" label="주의"     count={stats.yellow} />
                        <LegendRow color="#ef4444" label="경고"     count={stats.red} />
                        <div className="mt-0.5 text-[10px] font-mono" style={{ color: 'var(--ink-400)' }}>
                          운송중 {Math.round((stats.blue / totalActive) * 100)}%
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-[11px]" style={{ color: 'var(--ink-400)' }}>
                      활성 컨테이너 없음
                    </div>
                  )}
                </div>

                {/* Card 2 — 컨테이너 현황 (목적지별) */}
                <div
                  className="flex-1 rounded-lg border flex flex-col overflow-hidden"
                  style={{ borderColor: 'var(--ink-200)', background: 'var(--card)', minWidth: 0, ...(isMobile ? { minWidth: '75vw', scrollSnapAlign: 'start', height: 160, flexShrink: 0 } : {}) }}
                >
                  <div
                    className="px-4 pt-3 pb-2 border-b flex-shrink-0"
                    style={{ borderColor: 'var(--ink-200)' }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-500)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                      컨테이너 현황
                    </span>
                  </div>
                  <div className="flex-1 overflow-auto px-4 py-1.5">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left pb-1.5 font-semibold" style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-400)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>목적지</th>
                          <th className="text-right pb-1.5 font-semibold" style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#3b82f6' }}>운송중</th>
                          <th className="text-right pb-1.5 font-semibold" style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#22c55e' }}>도착완료</th>
                          <th className="text-right pb-1.5 font-semibold" style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-500)' }}>합계</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DEST_COUNTRIES.map(({ code, label }) => {
                          const s = destStats[code as CountryCode]
                          const total = s.active + s.arrived
                          return (
                            <tr key={code} className="border-t" style={{ borderColor: 'var(--ink-100)' }}>
                              <td className="py-1.5 text-[11px]" style={{ color: 'var(--ink-700)' }}>{label}</td>
                              <td className="py-1.5 text-right font-mono text-[11px]" style={{ color: s.active > 0 ? '#3b82f6' : 'var(--ink-300)' }}>{s.active > 0 ? s.active : '—'}</td>
                              <td className="py-1.5 text-right font-mono text-[11px]" style={{ color: s.arrived > 0 ? '#22c55e' : 'var(--ink-300)' }}>{s.arrived > 0 ? s.arrived : '—'}</td>
                              <td className="py-1.5 text-right font-mono font-semibold text-[11px]" style={{ color: total > 0 ? 'var(--ink-900)' : 'var(--ink-300)' }}>{total > 0 ? total : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Card 3 — ETA 임박 */}
                <div
                  className="flex-1 rounded-lg border flex flex-col overflow-hidden"
                  style={{ borderColor: 'var(--ink-200)', background: 'var(--card)', minWidth: 0, ...(isMobile ? { minWidth: '75vw', scrollSnapAlign: 'start', height: 160, flexShrink: 0 } : {}) }}
                >
                  <div
                    className="px-4 pt-3 pb-2 border-b flex items-center justify-between flex-shrink-0"
                    style={{ borderColor: 'var(--ink-200)' }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-500)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                      ETA 임박
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--ink-400)' }}>{recentContainers.length}개</span>
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
          )
        })()}
      </div>

      {/* Mobile: fixed slide-up detail panel */}
      {isMobile && (
        <div
          style={{
            position:      'fixed',
            bottom:        56,
            left:          0,
            right:         0,
            height:        '85vh',
            borderRadius:  '16px 16px 0 0',
            transform:     showDetailOverlay ? 'translateY(0)' : 'translateY(100%)',
            transition:    'transform 0.3s cubic-bezier(.4,0,.2,1)',
            zIndex:        100,
            pointerEvents: showDetailOverlay ? 'auto' : 'none',
            boxShadow:     showDetailOverlay ? '0 -4px 24px rgba(0,0,0,0.16)' : 'none',
            background:    'var(--card)',
            display:       'flex',
            flexDirection: 'column',
            overflow:      'hidden',
          }}
        >
          <div style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, paddingTop: 8 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--ink-300)' }} />
          </div>
          <button
            type="button"
            onClick={handleClearSelection}
            style={{ position: 'absolute', top: 4, right: 12, color: 'var(--ink-400)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 6 }}
          >
            <X size={16} />
          </button>
          <div style={{ flex: 1, minHeight: 0 }}>
            <DetailPanel
              containers={detailPanelContainers}
              mapSelectionCount={searchResults !== null ? null : selectedContainerNumbers !== null ? selectedContainerNumbers.length : null}
              sigFilter={sigFilter}
              onSigFilter={s => setSigFilter(prev => prev === s ? null : s)}
              stats={panelStats}
              onSelect={handleSelect}
              selectedNo={selectedNo}
              detail={detail}
              detailLoading={detailLoading}
              onCloseDetail={() => { setSelectedNo(null); setDetail(null) }}
              onClearMapSelection={handleClearSelection}
              searchActive={searchResults !== null}
              onClearSearch={clearSearch}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default TcrTrackingPage
