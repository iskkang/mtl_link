import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, AlertCircle, X, Train, Package, CheckCircle, Clock } from 'lucide-react'
import { ContainerMap } from '../components/tracking/ContainerMap'
import type { ContainerPoint, ContainerPopupData, WeatherAlert } from '../components/tracking/ContainerMap'

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
  from_location:      string | null
  to_location:        string | null
  transport_mode:     string | null
  etd:                string | null
  atd:                string | null
  eta:                string | null
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

function fmtMD(d: string | null): string {
  if (!d) return '—'
  const dt = new Date(d)
  return `${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`
}

type DelayBadge = { label: string; bg: string; text: string }

function calcDelay(seg: TcrSegment, today: string): DelayBadge | null {
  if (seg.ata && seg.eta) {
    const d = Math.round((new Date(seg.ata).getTime() - new Date(seg.eta).getTime()) / (24 * 60 * 60 * 1000))
    if (d <= 0) return { label: '정시',            bg: '#E1F5EE', text: '#0F6E56' }
    if (d < 3)  return { label: `+${d}일`,        bg: '#fef9c3', text: '#854d0e' }
    return           { label: `+${d}일`,          bg: '#fee2e2', text: '#991b1b' }
  }
  if (!seg.ata && seg.eta) {
    const r = Math.round((new Date(seg.eta).getTime() - new Date(today).getTime()) / (24 * 60 * 60 * 1000))
    if (r >= 0) return { label: `D-${r}`,         bg: '#E1F5EE', text: '#0F6E56' }
    return           { label: `+${Math.abs(r)}일`, bg: '#fee2e2', text: '#991b1b' }
  }
  return null
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
            {tab === 'segments' && (() => {
              const segs = detail!.segments
              if (segs.length === 0) return (
                <div className="px-4 py-6 text-center text-[11px]" style={{ color: 'var(--ink-400)' }}>구간 정보 없음</div>
              )
              const today    = new Date().toISOString().split('T')[0]
              const firstATD = segs.find(s => s.atd)?.atd ?? null
              const lastETA  = [...segs].reverse().find(s => s.eta)?.eta ?? null
              const lastATA  = [...segs].reverse().find(s => s.ata)?.ata ?? null
              const totalDays = (() => {
                const end   = lastATA ?? lastETA
                if (!end || !firstATD) return null
                return Math.round((new Date(end).getTime() - new Date(firstATD).getTime()) / (24 * 60 * 60 * 1000))
              })()
              return (
                <div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 480 }}>
                      <thead>
                        <tr style={{ background: 'var(--ink-50)' }}>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 500, color: 'var(--ink-400)', whiteSpace: 'nowrap' }}>구간</th>
                          <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 500, color: 'var(--ink-400)' }}>ETD</th>
                          <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 500, color: 'var(--ink-400)' }}>ATD</th>
                          <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 500, color: 'var(--ink-400)' }}>ETA</th>
                          <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 500, color: 'var(--ink-400)' }}>ATA</th>
                          <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 500, color: 'var(--ink-400)' }}>지연</th>
                          <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 500, color: 'var(--ink-400)' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {segs.map((s, idx) => {
                          const delay = calcDelay(s, today)
                          const isCurrent = s.is_current_segment
                          const isDone    = !!s.ata
                          const isDelayed = !!(delay && delay.label !== '정시')
                          const from = s.from_location ?? (s.segment_name?.split('→')[0]?.trim() ?? '—')
                          const to   = s.to_location   ?? (s.segment_name?.split('→')[1]?.trim() ?? '—')
                          const mode = s.transport_mode ?? ''
                          return (
                            <tr
                              key={s.segment_no ?? idx}
                              style={{
                                borderTop: '0.5px solid var(--ink-100)',
                                background: isCurrent ? 'rgba(20,184,166,0.06)' : 'transparent',
                              }}
                            >
                              <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                                <div>
                                  <span style={{ color: isCurrent ? 'var(--ink-900)' : 'var(--ink-600)', fontWeight: isCurrent ? 500 : 400 }}>{from}</span>
                                  <span style={{ color: 'var(--ink-300)', margin: '0 3px' }}>→</span>
                                  <span style={{ color: isCurrent ? 'var(--ink-900)' : 'var(--ink-600)', fontWeight: isCurrent ? 500 : 400 }}>{to}</span>
                                </div>
                                <div style={{ fontSize: 10, color: isCurrent ? '#14b8a6' : 'var(--ink-400)', marginTop: 1 }}>
                                  {mode || 'SEA'}{isCurrent ? ' · 현재' : ''}
                                </div>
                              </td>
                              <td style={{ padding: '10px 6px', textAlign: 'center', color: 'var(--ink-500)' }}>{fmtMD(s.etd)}</td>
                              <td style={{ padding: '10px 6px', textAlign: 'center', color: s.atd ? 'var(--ink-800)' : 'var(--ink-300)' }}>{fmtMD(s.atd)}</td>
                              <td style={{ padding: '10px 6px', textAlign: 'center', color: 'var(--ink-500)' }}>{fmtMD(s.eta)}</td>
                              <td style={{ padding: '10px 6px', textAlign: 'center', color: s.ata ? 'var(--ink-800)' : 'var(--ink-300)' }}>{fmtMD(s.ata)}</td>
                              <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                                {delay && (
                                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: delay.bg, color: delay.text, whiteSpace: 'nowrap' }}>
                                    {delay.label}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                                <span style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                  {isDone ? (
                                    <CheckCircle size={15} style={{ color: isDelayed ? '#f97316' : '#14b8a6' }} />
                                  ) : isCurrent ? (
                                    <Clock size={15} style={{ color: '#3b82f6' }} />
                                  ) : (
                                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--ink-200)' }} />
                                  )}
                                </span>
                              </td>
                            </tr>
                          )
                        })}

                        {/* Total T/T */}
                        <tr style={{ borderTop: '1.5px solid var(--ink-200)', background: 'var(--ink-50)' }}>
                          <td style={{ padding: '10px 10px', fontWeight: 500, color: 'var(--ink-800)' }}>Total T/T</td>
                          <td style={{ padding: '10px 6px', textAlign: 'center', fontSize: 10, color: 'var(--ink-400)' }}>출발</td>
                          <td style={{ padding: '10px 6px', textAlign: 'center', color: 'var(--ink-600)' }}>{fmtMD(firstATD)}</td>
                          <td style={{ padding: '10px 6px', textAlign: 'center', fontSize: 10, color: 'var(--ink-400)' }}>{lastATA ? '도착' : '도착예정'}</td>
                          <td style={{ padding: '10px 6px', textAlign: 'center', color: 'var(--ink-600)' }}>{fmtMD(lastATA ?? lastETA)}</td>
                          <td colSpan={2} style={{ padding: '10px 10px', textAlign: 'center' }}>
                            {totalDays != null ? (
                              <>
                                <span style={{ fontSize: 14, fontWeight: 500, color: '#14b8a6' }}>{totalDays}일</span>
                                {!lastATA && <span style={{ fontSize: 10, color: 'var(--ink-400)', marginLeft: 4 }}>(진행중)</span>}
                              </>
                            ) : <span style={{ color: 'var(--ink-300)' }}>—</span>}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Legend */}
                  <div style={{ padding: '8px 14px', borderTop: '0.5px solid var(--ink-100)', background: 'var(--ink-50)' }}>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--ink-400)', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <CheckCircle size={11} style={{ color: '#14b8a6' }} /> 완료·정시
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#eab308' }} /> +N일 지연
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={11} style={{ color: '#3b82f6' }} /> 진행중
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--ink-200)' }} /> 대기
                      </span>
                    </div>
                  </div>
                </div>
              )
            })()}
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

/* ── Main page ───────────────────────────────────────────────────────── */
const ALL_COUNTRIES = ['UZ', 'KZ', 'KG', 'PL'] as const

export function TcrTrackingPage() {
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

  /* ── Filter helpers ─────────────────────────────────────────────────── */
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
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-2.5">
              <Train size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
              <h1 style={{ fontSize: 20, margin: 0, flexShrink: 0 }}>
                중국경유 컨테이너 (TCR)
              </h1>
            </div>
            <span className="sub truncate" style={{ fontSize: 12, color: 'var(--ink-400)' }}>
              {loading ? 'Loading…' : `${containers.length}개 · 운송중 + 60일 이내 도착 · ${fmtRelTime(lastFetch)}`}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {stats.red    > 0 && <StatPill count={stats.red}    color="#ef4444" label="조치필요" />}
            {stats.yellow > 0 && <StatPill count={stats.yellow} color="#eab308" label="주의" />}
            {stats.green  > 0 && <StatPill count={stats.green}  color="#22c55e" label="도착완료" />}
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
      <div className="flex-1 overflow-hidden p-4 flex flex-col gap-4 min-h-0">

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
          const showDetailOverlay =
            searchResults !== null || selectedNo !== null || selectedContainerNumbers !== null

          return (
            <div className="flex-1 min-h-0 flex flex-col gap-4">

              {/* ── Top: full-width map + slide-in overlay detail ── */}
              <div
                className="flex-1 min-h-0 rounded-lg border overflow-hidden"
                style={{ position: 'relative', borderColor: 'var(--ink-200)' }}
              >
                <ContainerMap
                  containers={mapPoints}
                  allContainerNumbers={allContainerNumbers}
                  containerDetails={containerDetails}
                  onSelectContainers={handleSelectContainers}
                  onClearSelection={handleClearSelection}
                  showFescoLink={false}
                  onSearchSelect={cn => handleSelectContainers([cn])}
                  weatherAlerts={weatherAlerts}
                />

                {/* Slide-in detail overlay */}
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
              </div>

              {/* ── Bottom: Donut | 현황 | ETA ─────────────────────────── */}
              <div className="flex-shrink-0 flex gap-4" style={{ height: 180 }}>

                {/* Card 1 — Donut */}
                <div
                  className="flex-1 rounded-lg border flex items-center px-4 gap-3"
                  style={{ borderColor: 'var(--ink-200)', background: 'var(--card)', minWidth: 0 }}
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
                  style={{ borderColor: 'var(--ink-200)', background: 'var(--card)', minWidth: 0 }}
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
                  style={{ borderColor: 'var(--ink-200)', background: 'var(--card)', minWidth: 0 }}
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
    </div>
  )
}

export default TcrTrackingPage
