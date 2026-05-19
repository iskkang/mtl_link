import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, AlertCircle, X, ChevronRight, CheckCircle2, MapPin, Ship, Train } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ContainerMap, ContainerPopupData } from './ContainerMap'

/* ── Types ──────────────────────────────────────────────────────────── */
interface ContainerItem {
  container_number:         string
  order_number:             string | null
  operational_status:       string | null
  origin_city:              string | null
  destination_city:         string | null
  destination_country_code: string | null
  destination_country_name: string | null
  current_location_text:    string | null
  // Smart marker placement (v1.9.0b)
  display_location_text:    string | null
  display_latitude:         number | null
  display_longitude:        number | null
  // Deprecated, kept for backward compat
  current_latitude:         number | null
  current_longitude:        number | null
  eta:                      string | null
  signal:                   'red' | 'yellow' | 'green' | 'gray' | 'unknown'
  unknown_since:            string | null
  last_success_at:          string | null
  last_error_at:            string | null
  last_error_message:       string | null
  consecutive_errors:       number
  open_alert_count:         number
  open_alert_types:         string[]
  // Segment context (v1.9.0b)
  current_from:             string | null
  current_to:               string | null
  current_segment_type:     'SEA' | 'RR' | null
  departure_date:           string | null
  planned_destination_date: string | null
  alert_reason:             string | null
  // extras
  origin_key:               string | null
  current_from_country:     string | null
  current_to_country:       string | null
  transport_name:           string | null
  voyage_number:            string | null
  last_event_location:      string | null
  last_event_date:          string | null
}

interface RecentOrderItem {
  order_number:    string | null
  route:           string | null
  created_at:      string | null
  container_count: number
  signal:          string
}

interface StaleCandidateItem {
  container_number: string
  route:            string | null
  days_overdue:     number
  reason:           'no_events' | 'at_destination'
}

interface DashboardResponse {
  ok:               boolean
  total:            number
  limit:            number
  offset:           number
  data:             ContainerItem[]
  recent_orders?:   RecentOrderItem[]
  stale_candidates?: StaleCandidateItem[]
  error?:           string
}

/* ── Helpers ─────────────────────────────────────────────────────────── */
const DETAIL_RANK: Record<string, number> = { red: 0, unknown: 0, yellow: 1, green: 2, gray: 3 }

const ALERT_KO: Record<string, string> = {
  awaiting_next_leg_overdue:      '다음 구간 출발 10일 이상 대기',
  awaiting_next_leg_watch:        '다음 구간 출발 5일 이상 대기',
  planned_arrival_overdue:        '도착 예정일 초과',
  planned_departure_overdue:      '출발 예정일 초과',
  vessel_arrival_overdue:         '선박 도착 지연 (3일+)',
  vessel_arrival_watch:           '선박 도착 지연 (1일+)',
  container_tracking_unknown:     '추적 데이터 없음',
  container_tracking_unavailable: '트래킹 불가',
  stale_tracking_risk:            '장기 미업데이트 (위험)',
  stale_tracking_watch:           '장기 미업데이트 (주의)',
}

function fmtRelTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function daysSince(iso: string | null): number {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function hasRealLocation(c: ContainerItem): boolean {
  return c.current_from !== null || c.current_to !== null || c.last_event_location !== null
}

/* ── Segment icon ────────────────────────────────────────────────────── */
function SegmentIcon({ type, seaLabel, railLabel }: {
  type:      string | null
  seaLabel:  string
  railLabel: string
}) {
  if (type === 'SEA') return <Ship  size={9} aria-label={seaLabel}  style={{ flexShrink: 0, color: 'var(--ink-400)' }} />
  if (type === 'RR')  return <Train size={9} aria-label={railLabel} style={{ flexShrink: 0, color: 'var(--ink-400)' }} />
  return null
}

/* ── Segment context row (second line) ───────────────────────────────── */
function SegmentLine({ c, seaLabel, railLabel }: {
  c:         ContainerItem
  seaLabel:  string
  railLabel: string
}) {
  const hasSegment = c.current_segment_type != null
  const alertLabel = ALERT_KO[c.open_alert_types?.[0] ?? ''] ?? c.alert_reason
  const hasReason  = !!alertLabel
  return (
    <div
      className="text-[10px] flex items-center gap-1 overflow-hidden"
      style={{ color: 'var(--ink-500)' }}
    >
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1 }}>
        {c.current_from ?? '—'} → {c.current_to ?? '—'}
      </span>
      {hasSegment && (
        <>
          <span className="flex-shrink-0" style={{ color: 'var(--ink-300)' }}>·</span>
          <SegmentIcon type={c.current_segment_type} seaLabel={seaLabel} railLabel={railLabel} />
        </>
      )}
      {hasReason && (
        <>
          <span className="flex-shrink-0" style={{ color: 'var(--ink-300)' }}>·</span>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 2 }}>
            {alertLabel}
          </span>
        </>
      )}
    </div>
  )
}

/* ── Signal dot ─────────────────────────────────────────────────────── */
function SignalDot({ signal }: { signal: string }) {
  const color =
    signal === 'red'     ? '#dc2626' :
    signal === 'yellow'  ? '#d97706' :
    signal === 'green'   ? '#0d9488' :
    signal === 'unknown' ? '#475569' : '#94a3b8'
  const glow = (signal !== 'gray' && signal !== 'unknown') ? `0 0 0 2.5px ${color}30` : undefined
  return (
    <span
      className={`fesco-signal flex-shrink-0${signal === 'red' ? ' fesco-signal-pulse-red' : ''}`}
      style={{ background: color, boxShadow: glow }}
    />
  )
}

/* ── Detail card ─────────────────────────────────────────────────────── */
function DetailCard({
  items,
  mapSelectionCount,
  stats,
  signalFilter,
  onSignalFilterToggle,
  onSignalFilterClear,
  excludedCount,
  onClear,
}: {
  items:                ContainerItem[] | null
  mapSelectionCount:    number | null
  stats:                { red: number; yellow: number; green: number; unknown: number }
  signalFilter:         'red' | 'yellow' | 'green' | 'unknown' | null
  onSignalFilterToggle: (sig: 'red' | 'yellow' | 'green' | 'unknown') => void
  onSignalFilterClear:  () => void
  excludedCount:        number
  onClear:              () => void
}) {
  const { t } = useTranslation()
  const [detailSort, setDetailSort] = useState<'waiting' | 'name'>('waiting')
  useEffect(() => { setDetailSort('waiting') }, [items])
  const seaLabel    = t('tracking.dashboard.segment.sea')
  const railLabel   = t('tracking.dashboard.segment.rail')
  const openInFesco = t('tracking.openInFesco')

  const sortedItems = useMemo(() => {
    if (!items) return []
    return [...items].sort((a, b) => {
      if (detailSort === 'name')
        return a.container_number.localeCompare(b.container_number)
      const isAwA = (a.open_alert_types ?? []).some(t => t.startsWith('awaiting_next_leg'))
      const isAwB = (b.open_alert_types ?? []).some(t => t.startsWith('awaiting_next_leg'))
      const dA = isAwA ? daysSince(a.last_event_date) : daysSince(a.planned_destination_date ?? a.last_error_at)
      const dB = isAwB ? daysSince(b.last_event_date) : daysSince(b.planned_destination_date ?? b.last_error_at)
      return dB - dA
    })
  }, [items, detailSort])

  /* Chips: only when cluster selected AND 2+ distinct signal colors present */
  const presentColors = (['red', 'yellow', 'green', 'unknown'] as const).filter(s => stats[s] > 0)
  const showChips = mapSelectionCount !== null && presentColors.length >= 2

  return (
    <div
      className="rounded-lg border flex flex-col overflow-hidden flex-shrink-0"
      style={{ width: 320, borderColor: 'var(--ink-200)', background: 'var(--card)' }}
    >
      {/* Header */}
      <div
        className="px-4 pt-3 pb-2 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: 'var(--ink-200)' }}
      >
        <div className="flex items-center gap-1">
          <span className="label-mono">{t('tracking.dashboard.detail.title')}</span>
          <button
            type="button"
            onClick={() => setDetailSort(s => s === 'waiting' ? 'name' : 'waiting')}
            style={{ fontSize:'9px', color:'var(--ink-400)', cursor:'pointer',
                     background:'transparent', border:'none', padding:'0 0 0 4px' }}>
            {detailSort === 'waiting' ? '▼ 대기순' : '▼ 이름순'}
          </button>
        </div>
        {mapSelectionCount !== null && (
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--ink-500)' }}>
            <span>{t('tracking.dashboard.detail.containersSelected', { count: mapSelectionCount })}</span>
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-0.5 font-medium"
              style={{ color: 'var(--ink-400)' }}
            >
              <X size={10} />
              {t('tracking.dashboard.detail.clear')}
            </button>
          </div>
        )}
      </div>

      {/* Signal filter chips */}
      {showChips && (
        <div
          className="px-3 py-1.5 border-b flex items-center gap-1.5 flex-wrap flex-shrink-0"
          style={{ borderColor: 'var(--ink-200)' }}
        >
          {presentColors.map(sig => (
            <SignalChip
              key={sig}
              signal={sig}
              count={stats[sig]}
              label={sig === 'unknown' ? '추적불가' : t(`tracking.signal${sig.charAt(0).toUpperCase()}${sig.slice(1)}`)}
              active={signalFilter === sig}
              onClick={() => onSignalFilterToggle(sig)}
            />
          ))}
          {signalFilter !== null && (
            <button
              type="button"
              onClick={onSignalFilterClear}
              className="flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition-colors"
              style={{ borderColor: 'var(--ink-300)', color: 'var(--ink-500)', background: 'transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ink-100)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <X size={11} /> {t('tracking.filterAll')}
            </button>
          )}
        </div>
      )}

      {/* Body */}
      {items === null ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center">
          <MapPin size={20} style={{ color: 'var(--ink-300)' }} />
          <p className="text-[11px]" style={{ color: 'var(--ink-400)' }}>
            {t('tracking.dashboard.detail.empty')}
          </p>
          {excludedCount > 0 && (
            <p className="text-[10px]" style={{ color: 'var(--ink-300)' }}>
              {t('tracking.awaitingLocation', { count: excludedCount })}
            </p>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-1 text-[11px]" style={{ color: 'var(--ink-400)' }}>
              <span>{t('tracking.dashboard.empty.noActive')}</span>
              {signalFilter !== null && (
                <button
                  type="button"
                  onClick={onSignalFilterClear}
                  className="text-[10px] underline underline-offset-2"
                  style={{ color: 'var(--mint-deep)' }}
                >
                  {t('tracking.filterAll')}
                </button>
              )}
            </div>
          ) : (
            sortedItems.map(c => {
              const isUnknown  = c.signal === 'unknown'
              const isAwaiting = !isUnknown && (c.open_alert_types ?? []).some(t => t.startsWith('awaiting_next_leg'))
              const days = isUnknown
                ? daysSince(c.unknown_since ?? c.last_event_date)
                : isAwaiting
                  ? daysSince(c.last_event_date)
                  : daysSince(c.planned_destination_date ?? c.last_error_at)
              const daysColor = isUnknown ? '#475569' : isAwaiting ? 'var(--signal-yellow)' : 'var(--red)'
              return (
                <div
                  key={c.container_number}
                  className="px-4 py-1.5 border-b flex items-start gap-2.5 transition-colors"
                  style={{ borderColor: 'var(--ink-200)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--ink-50)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                >
                  <SignalDot signal={c.signal} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <a
                        href={`https://my.fesco.com/tracking?tab=${c.container_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        title={openInFesco}
                        className="font-mono text-[11px] font-medium truncate transition-colors"
                        style={{ color: 'var(--ink-900)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--mint-deep)'; (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ink-900)'; (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none' }}
                      >
                        {c.container_number}
                      </a>
                      {days > 0 && (
                        <span className="text-[9px] font-mono font-medium flex-shrink-0" style={{ color: daysColor }}>
                          {t('tracking.dashboard.actionNeeded.daysOverdue', { days })}
                        </span>
                      )}
                    </div>
                    <SegmentLine c={c} seaLabel={seaLabel} railLabel={railLabel} />
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

/* ── Donut chart ─────────────────────────────────────────────────────── */
function DonutChart({ green, yellow, red, centerLabel }: {
  green: number; yellow: number; red: number; centerLabel: string
}) {
  const total = green + yellow + red
  if (total === 0) return null

  const R  = 38
  const SW = 10
  const CX = R + SW / 2 + 2
  const C  = 2 * Math.PI * R

  const redLen    = C * (red    / total)
  const yellowLen = C * (yellow / total)
  const greenLen  = C * (green  / total)

  const redOff    = 0
  const yellowOff = -redLen
  const greenOff  = -(redLen + yellowLen)

  const size = CX * 2

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={CX} cy={CX} r={R} fill="none" strokeWidth={SW} stroke="var(--ink-200)" />
      {redLen > 0 && (
        <circle cx={CX} cy={CX} r={R} fill="none" strokeWidth={SW}
          stroke="var(--signal-red)"
          strokeDasharray={`${redLen} ${C - redLen}`}
          strokeDashoffset={redOff}
          strokeLinecap="butt"
          transform={`rotate(-90 ${CX} ${CX})`}
        />
      )}
      {yellowLen > 0 && (
        <circle cx={CX} cy={CX} r={R} fill="none" strokeWidth={SW}
          stroke="var(--signal-yellow)"
          strokeDasharray={`${yellowLen} ${C - yellowLen}`}
          strokeDashoffset={yellowOff}
          strokeLinecap="butt"
          transform={`rotate(-90 ${CX} ${CX})`}
        />
      )}
      {greenLen > 0 && (
        <circle cx={CX} cy={CX} r={R} fill="none" strokeWidth={SW}
          stroke="var(--signal-green)"
          strokeDasharray={`${greenLen} ${C - greenLen}`}
          strokeDashoffset={greenOff}
          strokeLinecap="butt"
          transform={`rotate(-90 ${CX} ${CX})`}
        />
      )}
      <text x={CX} y={CX - 3} textAnchor="middle" fontSize="18" fontWeight="700"
        fill="var(--ink-900)" fontFamily="var(--font-body)">
        {total}
      </text>
      <text x={CX} y={CX + 10} textAnchor="middle" fontSize="7" fontWeight="600"
        fill="var(--ink-500)" letterSpacing="1.5" fontFamily="var(--font-mono)">
        {centerLabel}
      </text>
    </svg>
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

/* ── Country chip ────────────────────────────────────────────────────── */
function CountryChip({
  label, count, active, onClick,
}: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-0.5 rounded-full border text-[11px] font-medium transition-colors"
      style={active ? {
        background:  'var(--mint-bg)',
        borderColor: 'var(--mint-border)',
        color:       'var(--mint-deep)',
      } : {
        background:  'transparent',
        borderColor: 'var(--ink-300)',
        color:       'var(--ink-500)',
      }}
    >
      {label} <span className="font-mono opacity-70">{count}</span>
    </button>
  )
}

/* ── Stat pill ───────────────────────────────────────────────────────── */
function StatPill({ count, signal, label }: { count: number; signal: 'red' | 'yellow' | 'green'; label: string }) {
  return (
    <span
      className="fesco-status-pill flex items-center gap-1"
      style={{ background: `var(--signal-${signal}-bg)`, color: `var(--signal-${signal})` }}
    >
      <span className="font-mono">{count}</span> {label}
    </span>
  )
}

/* ── Signal filter chip ─────────────────────────────────────────────── */
function SignalChip({
  signal, count, label, active, onClick,
}: {
  signal:  'red' | 'yellow' | 'green' | 'unknown'
  count:   number
  label:   string
  active:  boolean
  onClick: () => void
}) {
  const dotColor    = signal === 'unknown' ? '#475569' : `var(--signal-${signal})`
  const activeBg    = signal === 'unknown' ? 'rgba(71,85,105,0.08)' : `var(--signal-${signal}-bg)`
  const activeBorder =
    signal === 'red'     ? 'rgba(220,38,38,0.35)'  :
    signal === 'yellow'  ? 'rgba(217,119,6,0.35)'  :
    signal === 'unknown' ? 'rgba(71,85,105,0.35)'  :
    'rgba(13,148,136,0.35)'
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium transition-colors"
      style={active
        ? { background: activeBg, borderColor: activeBorder, color: dotColor }
        : { background: 'transparent', borderColor: 'var(--ink-300)', color: 'var(--ink-500)' }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor }} />
      <span className="font-mono">{count}</span>
      {' '}{label}
    </button>
  )
}

/* ── Main component ──────────────────────────────────────────────────── */
const ALL_COUNTRIES = ['RU', 'UZ', 'BY', 'KZ'] as const

export function ContainerDashboard({ onViewBookings }: { onViewBookings: () => void }) {
  const { t } = useTranslation()
  const seaLabel     = t('tracking.dashboard.segment.sea')
  const railLabel    = t('tracking.dashboard.segment.rail')
  const openInFesco  = t('tracking.openInFesco')

  const [data,             setData]             = useState<ContainerItem[]>([])
  const [recentOrders,     setRecentOrders]     = useState<RecentOrderItem[]>([])
  const [staleCandidates,  setStaleCandidates]  = useState<StaleCandidateItem[]>([])
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState<string | null>(null)
  const [lastFetch,        setLastFetch]        = useState<string | null>(null)
  const [refreshing,       setRefreshing]       = useState(false)
  const [showAllAction,    setShowAllAction]    = useState(false)

  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(
    () => new Set(['RU', 'UZ', 'BY', 'KZ']),
  )

  const [selectedContainerNumbers, setSelectedContainerNumbers] = useState<string[] | null>(null)
  const [signalFilter,             setSignalFilter]             = useState<'red' | 'yellow' | 'green' | 'unknown' | null>(null)
  const [actionSort,               setActionSort]               = useState<'waiting' | 'number'>('waiting')

  /* ── Fetch ─────────────────────────────────────────────────────────── */
  const fetchData = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true)
    else       setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/fesco/containers-dashboard?limit=500')
      const json = await res.json() as DashboardResponse
      if (!json.ok) throw new Error(json.error ?? 'Failed to load dashboard')
      setData(json.data)
      setRecentOrders(json.recent_orders ?? [])
      setStaleCandidates(json.stale_candidates ?? [])
      setLastFetch(new Date().toISOString())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  /* ── Cleanup handlers ───────────────────────────────────────────────── */
  const handleCleanupDelete = async (cn: string) => {
    await fetch('/api/fesco/container-cleanup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', container_number: cn }),
    })
    setStaleCandidates(prev => prev.filter(c => c.container_number !== cn))
  }

  const handleCleanupDismiss = async (cn: string) => {
    await fetch('/api/fesco/container-cleanup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss', container_number: cn }),
    })
    setStaleCandidates(prev => prev.filter(c => c.container_number !== cn))
  }

  /* ── Exclude containers with no location info (e.g. junk geocode coords) */
  const visibleContainers = useMemo(
    () => data.filter(hasRealLocation),
    [data],
  )
  const excludedCount = data.length - visibleContainers.length

  /* ── Filter: null country always shown ─────────────────────────────── */
  const filteredData = useMemo(() => {
    const isShowAll = ['RU', 'UZ', 'BY', 'KZ'].every(c => selectedCountries.has(c))
    return visibleContainers.filter(c =>
      isShowAll
        ? (c.destination_country_code === null || selectedCountries.has(c.destination_country_code))
        : (c.destination_country_code !== null && selectedCountries.has(c.destination_country_code))
    )
  }, [visibleContainers, selectedCountries])

  /* ── Stats (global fleet, used for header pills) ────────────────────── */
  const stats = useMemo(() => ({
    red:     filteredData.filter(c => c.signal === 'red').length,
    yellow:  filteredData.filter(c => c.signal === 'yellow').length,
    green:   filteredData.filter(c => c.signal === 'green').length,
    unknown: filteredData.filter(c => c.signal === 'unknown').length,
  }), [filteredData])

  /* ── Cluster-local stats (counts within selected cluster, for chips) ── */
  const clusterStats = useMemo(() => {
    if (selectedContainerNumbers === null) return { red: 0, yellow: 0, green: 0, unknown: 0 }
    const sel = filteredData.filter(c => selectedContainerNumbers.includes(c.container_number))
    return {
      red:     sel.filter(c => c.signal === 'red').length,
      yellow:  sel.filter(c => c.signal === 'yellow').length,
      green:   sel.filter(c => c.signal === 'green').length,
      unknown: sel.filter(c => c.signal === 'unknown').length,
    }
  }, [selectedContainerNumbers, filteredData])

  /* ── Country counts ─────────────────────────────────────────────────── */
  const countryCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of data) {
      const cc = c.destination_country_code
      if (cc) m[cc] = (m[cc] ?? 0) + 1
    }
    return m
  }, [data])

  /* ── Action needed (global red) ─────────────────────────────────────── */
  const actionNeeded = useMemo(
    () => filteredData
      .filter(c => c.signal === 'red' || c.signal === 'unknown')
      .sort((a, b) => {
        if (actionSort === 'number')
          return a.container_number.localeCompare(b.container_number)
        const isAwA = (a.open_alert_types ?? []).some(t => t.startsWith('awaiting_next_leg'))
        const isAwB = (b.open_alert_types ?? []).some(t => t.startsWith('awaiting_next_leg'))
        const dA = isAwA ? daysSince(a.last_event_date) : daysSince(a.planned_destination_date ?? a.last_error_at)
        const dB = isAwB ? daysSince(b.last_event_date) : daysSince(b.planned_destination_date ?? b.last_error_at)
        return dB - dA
      })
      .slice(0, 8),
    [filteredData, actionSort],
  )

  /* ── Detail items: cluster selection only, sorted R→Y→G then +Nd desc ── */
  const detailItems = useMemo(() => {
    if (selectedContainerNumbers === null) return null
    const sortFn = (a: ContainerItem, b: ContainerItem) => {
      const rankDiff = DETAIL_RANK[a.signal] - DETAIL_RANK[b.signal]
      if (rankDiff !== 0) return rankDiff
      const daysA = daysSince(a.planned_destination_date ?? a.last_error_at)
      const daysB = daysSince(b.planned_destination_date ?? b.last_error_at)
      return daysB - daysA
    }
    const base = filteredData.filter(c => selectedContainerNumbers.includes(c.container_number))
    return [...(signalFilter ? base.filter(c => c.signal === signalFilter) : base)].sort(sortFn)
  }, [selectedContainerNumbers, filteredData, signalFilter])

  /* ── Map points: all country-filtered containers with coords ────────── */
  const mapPoints = useMemo(
    () => filteredData
      .filter(c => c.display_latitude != null && c.display_longitude != null)
      .map(c => ({
        containerNumber: c.container_number,
        latitude:        c.display_latitude!,
        longitude:       c.display_longitude!,
        signal:          c.signal,
      })),
    [filteredData],
  )

  /* ── Container details for popup ─────────────────────────────────────── */
  const containerDetails = useMemo(() => {
    const m: Record<string, ContainerPopupData> = {}
    for (const c of filteredData) {
      m[c.container_number] = {
        signal:                   c.signal,
        current_from:             c.current_from,
        current_to:               c.current_to,
        last_event_location:      c.last_event_location,
        last_success_at:          c.last_success_at,
        planned_destination_date: c.planned_destination_date,
        alert_reason:             c.alert_reason,
      }
    }
    return m
  }, [filteredData])

  /* ── All container numbers (search: "exists but no coords" detection) ── */
  const allContainerNumbers = useMemo(
    () => data.map(c => c.container_number),
    [data],
  )

  /* ── Filter helpers ─────────────────────────────────────────────────── */
  const toggleCountry = (cc: string) => {
    setSelectedCountries(prev => {
      const next = new Set(prev)
      if (next.has(cc)) next.delete(cc)
      else next.add(cc)
      return next
    })
  }

  const resetFilter = () => setSelectedCountries(new Set(['RU', 'UZ', 'BY', 'KZ']))

  const totalActive = stats.red + stats.yellow + stats.green

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
        {/* Row 1: title + subtitle + stats + refresh */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <h1 style={{ fontSize: 20, margin: 0, flexShrink: 0 }}>
              {t('tracking.dashboard.title')}
            </h1>
            <span className="sub truncate">
              {loading
                ? 'Loading…'
                : t('tracking.dashboard.activeContainersSynced', {
                    count: data.length,
                    time:  fmtRelTime(lastFetch),
                  })
              }
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {stats.red    > 0 && <StatPill count={stats.red}    signal="red"    label={t('tracking.dashboard.pill.action')} />}
            {stats.yellow > 0 && <StatPill count={stats.yellow} signal="yellow" label={t('tracking.dashboard.pill.watch')} />}
            {stats.green  > 0 && <StatPill count={stats.green}  signal="green"  label={t('tracking.dashboard.pill.onTrack')} />}

            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={loading || refreshing}
              title="Refresh"
              className="w-7 h-7 flex items-center justify-center rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: 'var(--ink-300)', color: 'var(--ink-500)', background: 'transparent' }}
              onMouseEnter={e => { if (!loading && !refreshing) (e.currentTarget as HTMLButtonElement).style.background = 'var(--ink-100)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Cleanup banner */}
        {staleCandidates.length > 0 && (
          <CleanupBanner
            candidates={staleCandidates}
            onDelete={handleCleanupDelete}
            onDismiss={handleCleanupDismiss}
          />
        )}

        {/* Row 2: destination filter chips */}
        <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 8 }}>
          <span className="label-mono">{t('tracking.dashboard.filter.destination')}</span>
          {ALL_COUNTRIES.map(cc => (
            <CountryChip
              key={cc}
              label={t(`tracking.dashboard.country.${cc}`)}
              count={countryCounts[cc] ?? 0}
              active={selectedCountries.has(cc)}
              onClick={() => toggleCountry(cc)}
            />
          ))}
          <button
            type="button"
            onClick={resetFilter}
            className="flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition-colors"
            style={{ borderColor: 'var(--ink-300)', color: 'var(--ink-500)', background: 'transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ink-100)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <X size={11} /> {t('tracking.dashboard.filter.clear')}
          </button>
        </div>

      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden p-4 flex flex-col gap-4 min-h-0">

        {/* Error banner */}
        {error && (
          <div
            className="rounded-lg border px-4 py-3 flex items-center gap-3 text-sm"
            style={{ background: 'var(--signal-red-bg)', borderColor: 'rgba(220,38,38,0.25)', color: 'var(--signal-red)' }}
          >
            <AlertCircle size={15} />
            <span className="flex-1">{error}</span>
            <button type="button" className="text-xs underline underline-offset-2" onClick={() => fetchData()}>
              Retry
            </button>
          </div>
        )}

        {/* Loading skeletons */}
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
            {/* ── Top row: Map + Detail ────────────────────────────────── */}
            <div className="flex-1 min-h-0 flex gap-4">

              {/* Live map — flex-1 */}
              <div
                className="flex-1 rounded-lg border overflow-hidden"
                style={{ borderColor: 'var(--ink-200)' }}
              >
                <ContainerMap
                  containers={mapPoints}
                  allContainerNumbers={allContainerNumbers}
                  containerDetails={containerDetails}
                  onSelectContainers={nums => {
                    setSelectedContainerNumbers(nums)
                    setSignalFilter(null)
                  }}
                  onClearSelection={() => {
                    setSelectedContainerNumbers(null)
                    setSignalFilter(null)
                  }}
                />
              </div>

              {/* Detail — 320px */}
              <DetailCard
                items={detailItems}
                mapSelectionCount={selectedContainerNumbers !== null ? selectedContainerNumbers.length : null}
                stats={clusterStats}
                signalFilter={signalFilter}
                onSignalFilterToggle={sig => setSignalFilter(prev => prev === sig ? null : sig)}
                onSignalFilterClear={() => setSignalFilter(null)}
                excludedCount={excludedCount}
                onClear={() => {
                  setSelectedContainerNumbers(null)
                  setSignalFilter(null)
                }}
              />
            </div>

            {/* ── Bottom row: Donut + Recent Orders + Action Needed ────── */}
            <div className="flex-shrink-0 flex gap-4" style={{ height: 260 }}>

              {/* Status donut — 240px */}
              <div
                className="rounded-lg border flex items-center px-4 gap-3 flex-shrink-0"
                style={{ width: 240, borderColor: 'var(--ink-200)', background: 'var(--card)' }}
              >
                {totalActive > 0 ? (
                  <>
                    <DonutChart
                      green={stats.green}
                      yellow={stats.yellow}
                      red={stats.red}
                      centerLabel={t('tracking.dashboard.center.active')}
                    />
                    <div className="flex flex-col gap-2 min-w-0">
                      <LegendRow color="var(--signal-green)"  label={t('tracking.dashboard.legend.onTrack')} count={stats.green} />
                      <LegendRow color="var(--signal-yellow)" label={t('tracking.dashboard.legend.watch')}   count={stats.yellow} />
                      <LegendRow color="var(--signal-red)"    label={t('tracking.dashboard.legend.action')}  count={stats.red} />
                      <div className="mt-1 text-[10px] font-mono" style={{ color: 'var(--ink-400)' }}>
                        {t('tracking.dashboard.legend.onTrackPercent', {
                          percent: Math.round((stats.green / totalActive) * 100),
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-[11px]" style={{ color: 'var(--ink-400)' }}>
                    {t('tracking.dashboard.empty.noActive')}
                  </div>
                )}
              </div>

              {/* Recent orders — flex-1 */}
              <div
                className="flex-1 rounded-lg border flex flex-col overflow-hidden"
                style={{ borderColor: 'var(--ink-200)', background: 'var(--card)' }}
              >
                <div
                  className="px-4 pt-3 pb-2 border-b flex items-center justify-between flex-shrink-0"
                  style={{ borderColor: 'var(--ink-200)' }}
                >
                  <span className="label-mono">{t('tracking.dashboard.panel.recentOrders')}</span>
                  <button
                    type="button"
                    onClick={onViewBookings}
                    className="flex items-center gap-0.5 text-[10px] font-medium"
                    style={{ color: 'var(--mint-deep)' }}
                  >
                    {t('tracking.dashboard.panel.viewAll')}
                    <ChevronRight size={10} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {recentOrders.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-[11px]" style={{ color: 'var(--ink-400)' }}>
                      {t('tracking.dashboard.empty.noActive')}
                    </div>
                  ) : (
                    recentOrders.map(ord => (
                      <div
                        key={ord.order_number ?? ord.route ?? ord.created_at ?? ''}
                        className="px-4 py-1.5 border-b flex items-center gap-2 transition-colors cursor-default"
                        style={{ borderColor: 'var(--ink-200)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--ink-50)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                      >
                        <SignalDot signal={ord.signal} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-mono font-medium truncate" style={{ color: 'var(--ink-900)' }}>
                            {ord.order_number ?? '—'}
                          </div>
                          <div className="text-[10px] truncate" style={{ color: 'var(--ink-500)' }}>
                            {ord.route ?? '—'}
                          </div>
                        </div>
                        <span className="text-[9px] font-mono flex-shrink-0" style={{ color: 'var(--ink-400)' }}>
                          {ord.container_count}×
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Action needed — 320px */}
              <div
                className="rounded-lg border flex flex-col overflow-hidden flex-shrink-0"
                style={{ width: 320, borderColor: 'var(--ink-200)', background: 'var(--card)' }}
              >
                <div
                  className="px-4 pt-3 pb-2 border-b flex-shrink-0 flex items-center justify-between"
                  style={{ borderColor: 'var(--ink-200)' }}
                >
                  <span className="label-mono">{t('tracking.dashboard.panel.actionNeeded')}</span>
                  {actionNeeded.length > 0 && (
                    <span className="text-[10px] font-mono flex items-center gap-1" style={{ color: 'var(--ink-400)' }}>
                      {actionNeeded.length}
                      <button
                        type="button"
                        onClick={() => setActionSort(s => s === 'waiting' ? 'number' : 'waiting')}
                        style={{ fontSize: '9px', color: 'var(--ink-400)', cursor: 'pointer', background: 'transparent', border: 'none', padding: '0 0 0 4px' }}
                      >
                        {actionSort === 'waiting' ? '▼ 대기순' : '▼ 번호순'}
                      </button>
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto">
                  {actionNeeded.length === 0 ? (
                    <div
                      className="flex flex-col items-center justify-center h-full gap-2"
                      style={{ color: 'var(--signal-green)' }}
                    >
                      <CheckCircle2 size={20} />
                      <span className="text-[11px]">{t('tracking.dashboard.empty.noAction')}</span>
                    </div>
                  ) : (
                    <>
                      {(showAllAction ? actionNeeded : actionNeeded.slice(0, 5)).map(c => {
                        const isAwaiting = (c.open_alert_types ?? []).some(t => t.startsWith('awaiting_next_leg'))
                        const days = isAwaiting
                          ? daysSince(c.last_event_date)
                          : daysSince(c.last_error_at ?? c.last_success_at)
                        return (
                          <div
                            key={c.container_number}
                            className="px-4 py-1 border-b flex items-start gap-2.5 transition-colors"
                            style={{ borderColor: 'var(--ink-200)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--ink-50)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                          >
                            <SignalDot signal="red" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1.5">
                                <a
                                  href={`https://my.fesco.com/tracking?tab=${c.container_number}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  title={openInFesco}
                                  className="font-mono text-[11px] font-medium transition-colors"
                                  style={{ color: 'var(--ink-900)' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--mint-deep)'; (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline' }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ink-900)'; (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none' }}
                                >
                                  {c.container_number}
                                </a>
                                {days > 0 && (
                                  <span
                                    className="text-[9px] font-mono font-medium flex-shrink-0"
                                    style={{ color: 'var(--red)' }}
                                  >
                                    {t('tracking.dashboard.actionNeeded.daysOverdue', { days })}
                                  </span>
                                )}
                              </div>
                              <SegmentLine c={c} seaLabel={seaLabel} railLabel={railLabel} />
                            </div>
                          </div>
                        )
                      })}
                      {actionNeeded.length > 5 && (
                        <button
                          type="button"
                          onClick={() => setShowAllAction(v => !v)}
                          className="w-full px-4 py-1.5 text-[10px] font-medium transition-colors text-left"
                          style={{ color: 'var(--mint-deep)', background: 'transparent' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ink-50)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                        >
                          {showAllAction
                            ? t('tracking.dashboard.actionNeeded.showLess')
                            : t('tracking.dashboard.actionNeeded.showAll', { count: actionNeeded.length })
                          }
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── CleanupBanner ───────────────────────────────────────────────────── */
function CleanupBanner({
  candidates,
  onDelete,
  onDismiss,
}: {
  candidates: StaleCandidateItem[]
  onDelete:   (cn: string) => void
  onDismiss:  (cn: string) => void
}) {
  const [open, setOpen] = useState(false)
  const firstRoute = candidates[0]?.route ?? null
  const label = firstRoute
    ? `${firstRoute}${candidates.length > 1 ? ` 외 ${candidates.length - 1}개` : ''}`
    : `${candidates.length}개`

  return (
    <div style={{
      marginTop: 8,
      borderRadius: 6,
      border: '1px solid #fde68a',
      background: '#fffbeb',
      overflow: 'hidden',
      fontSize: 11,
    }}>
      <div
        className="flex items-center justify-between gap-2"
        style={{ padding: '6px 10px', cursor: 'pointer', color: '#d97706' }}
        onClick={() => setOpen(v => !v)}
      >
        <span>⚠️ 정리 대기 {candidates.length}개 · {label}</span>
        <span style={{ flexShrink: 0 }}>확인하기 {open ? '▴' : '▾'}</span>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid #fde68a' }}>
          {candidates.map(c => (
            <div
              key={c.container_number}
              className="flex items-center gap-2 flex-wrap"
              style={{ padding: '5px 10px', borderBottom: '1px solid #fef3c7', color: '#92400e' }}
            >
              <span className="font-mono" style={{ flexShrink: 0, fontWeight: 600 }}>{c.container_number}</span>
              <span style={{ flex: 1, minWidth: 80, color: '#b45309', fontSize: 10 }}>{c.route ?? '—'}</span>
              <span style={{ flexShrink: 0, color: '#d97706', fontWeight: 600 }}>+{c.days_overdue}일</span>
              <button
                type="button"
                onClick={() => onDelete(c.container_number)}
                style={{
                  flexShrink: 0, padding: '2px 7px', borderRadius: 4, border: 'none',
                  background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 10,
                }}
              >
                도착 완료 (삭제)
              </button>
              <button
                type="button"
                onClick={() => onDismiss(c.container_number)}
                style={{
                  flexShrink: 0, padding: '2px 7px', borderRadius: 4, border: '1px solid #d1d5db',
                  background: '#f9fafb', color: '#6b7280', cursor: 'pointer', fontSize: 10,
                }}
              >
                30일 보류
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
