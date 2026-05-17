import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, AlertCircle, X, ChevronRight, CheckCircle2, Ship } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
  current_latitude:         number | null
  current_longitude:        number | null
  eta:                      string | null
  signal:                   'red' | 'yellow' | 'green' | 'gray'
  last_success_at:          string | null
  last_error_at:            string | null
  last_error_message:       string | null
  consecutive_errors:       number
  open_alert_count:         number
  open_alert_types:         string[]
  origin_key:               string | null
  current_from:             string | null
  current_from_country:     string | null
  current_to_country:       string | null
  transport_name:           string | null
  voyage_number:            string | null
}

interface DashboardResponse {
  ok:     boolean
  total:  number
  limit:  number
  offset: number
  data:   ContainerItem[]
  error?: string
}

/* ── Helpers ─────────────────────────────────────────────────────────── */
const SIGNAL_RANK: Record<string, number> = { red: 3, yellow: 2, green: 1, gray: 0 }

function worstSignal(signals: string[]): string {
  return signals.reduce(
    (w, s) => SIGNAL_RANK[s] > SIGNAL_RANK[w] ? s : w,
    'gray',
  )
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

/* ── Signal dot ─────────────────────────────────────────────────────── */
function SignalDot({ signal }: { signal: string }) {
  const color =
    signal === 'red'    ? '#dc2626' :
    signal === 'yellow' ? '#d97706' :
    signal === 'green'  ? '#0d9488' : '#94a3b8'
  const glow = signal !== 'gray' ? `0 0 0 2.5px ${color}30` : undefined
  return (
    <span
      className={`fesco-signal flex-shrink-0${signal === 'red' ? ' fesco-signal-pulse-red' : ''}`}
      style={{ background: color, boxShadow: glow }}
    />
  )
}

/* ── Donut chart ─────────────────────────────────────────────────────── */
function DonutChart({ green, yellow, red, centerLabel }: {
  green: number; yellow: number; red: number; centerLabel: string
}) {
  const total = green + yellow + red
  if (total === 0) return null

  const R  = 52
  const SW = 12
  const CX = R + SW / 2 + 2   // 60
  const C  = 2 * Math.PI * R  // ≈ 326.73

  const redLen    = C * (red    / total)
  const yellowLen = C * (yellow / total)
  const greenLen  = C * (green  / total)

  // After rotate(-90), circle starts at 12 o'clock.
  // Negative dashoffset shifts the segment start CW.
  const redOff    = 0
  const yellowOff = -redLen
  const greenOff  = -(redLen + yellowLen)

  const size = CX * 2  // 120

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {/* background ring */}
      <circle cx={CX} cy={CX} r={R} fill="none" strokeWidth={SW} stroke="var(--ink-200)" />

      {redLen > 0 && (
        <circle
          cx={CX} cy={CX} r={R} fill="none" strokeWidth={SW}
          stroke="var(--signal-red)"
          strokeDasharray={`${redLen} ${C - redLen}`}
          strokeDashoffset={redOff}
          strokeLinecap="butt"
          transform={`rotate(-90 ${CX} ${CX})`}
        />
      )}
      {yellowLen > 0 && (
        <circle
          cx={CX} cy={CX} r={R} fill="none" strokeWidth={SW}
          stroke="var(--signal-yellow)"
          strokeDasharray={`${yellowLen} ${C - yellowLen}`}
          strokeDashoffset={yellowOff}
          strokeLinecap="butt"
          transform={`rotate(-90 ${CX} ${CX})`}
        />
      )}
      {greenLen > 0 && (
        <circle
          cx={CX} cy={CX} r={R} fill="none" strokeWidth={SW}
          stroke="var(--signal-green)"
          strokeDasharray={`${greenLen} ${C - greenLen}`}
          strokeDashoffset={greenOff}
          strokeLinecap="butt"
          transform={`rotate(-90 ${CX} ${CX})`}
        />
      )}

      {/* center text */}
      <text x={CX} y={CX - 5} textAnchor="middle" fontSize="24" fontWeight="700"
        fill="var(--ink-900)" fontFamily="var(--font-body)">
        {total}
      </text>
      <text x={CX} y={CX + 11} textAnchor="middle" fontSize="8" fontWeight="600"
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
        background: 'var(--mint-bg)',
        borderColor: 'var(--mint-border)',
        color: 'var(--mint-deep)',
      } : {
        background: 'transparent',
        borderColor: 'var(--ink-300)',
        color: 'var(--ink-500)',
      }}
    >
      {label} <span className="font-mono opacity-70">{count}</span>
    </button>
  )
}

/* ── Stat pill ───────────────────────────────────────────────────────── */
function StatPill({ count, signal, label }: { count: number; signal: 'red' | 'yellow' | 'green'; label: string }) {
  const bg  = `var(--signal-${signal}-bg)`
  const clr = `var(--signal-${signal})`
  return (
    <span
      className="fesco-status-pill flex items-center gap-1"
      style={{ background: bg, color: clr }}
    >
      <span className="font-mono">{count}</span> {label}
    </span>
  )
}

/* ── Main component ──────────────────────────────────────────────────── */
const ALL_COUNTRIES = ['RU', 'UZ', 'BY', 'KZ'] as const

export function ContainerDashboard({ onViewBookings }: { onViewBookings: () => void }) {
  const { t } = useTranslation()

  const [data,       setData]       = useState<ContainerItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [lastFetch,  setLastFetch]  = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(
    () => new Set(['RU', 'UZ', 'BY', 'KZ']),
  )

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
      setLastFetch(new Date().toISOString())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  /* ── Filter: null country always shown ─────────────────────────────── */
  const filteredData = useMemo(
    () => data.filter(c =>
      c.destination_country_code === null ||
      selectedCountries.has(c.destination_country_code),
    ),
    [data, selectedCountries],
  )

  /* ── Stats ─────────────────────────────────────────────────────────── */
  const stats = useMemo(() => ({
    red:    filteredData.filter(c => c.signal === 'red').length,
    yellow: filteredData.filter(c => c.signal === 'yellow').length,
    green:  filteredData.filter(c => c.signal === 'green').length,
  }), [filteredData])

  /* ── Country counts (from full dataset, for chip badges) ───────────── */
  const countryCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of data) {
      const cc = c.destination_country_code
      if (cc) m[cc] = (m[cc] ?? 0) + 1
    }
    return m
  }, [data])

  /* ── Recent orders (grouped, sorted by latest activity) ─────────────  */
  const recentOrders = useMemo(() => {
    const map = new Map<string, ContainerItem[]>()
    for (const c of filteredData) {
      const key = c.order_number ?? `_${c.container_number}`
      const arr = map.get(key) ?? []
      arr.push(c)
      map.set(key, arr)
    }
    return [...map.entries()]
      .map(([key, ctrs]) => ({
        key,
        orderNum: ctrs[0].order_number ?? '—',
        ctrs,
        signal: worstSignal(ctrs.map(c => c.signal)),
        latest: ctrs.map(c => c.last_success_at ?? '').sort().reverse()[0] ?? '',
        route: ctrs[0].origin_city && ctrs[0].destination_city
          ? `${ctrs[0].origin_city} → ${ctrs[0].destination_city}`
          : ctrs[0].destination_city ?? '—',
      }))
      .sort((a, b) => b.latest.localeCompare(a.latest))
      .slice(0, 8)
  }, [filteredData])

  /* ── Action needed (red, sorted by consecutive_errors desc) ─────────── */
  const actionNeeded = useMemo(
    () => filteredData
      .filter(c => c.signal === 'red')
      .sort((a, b) =>
        (b.consecutive_errors ?? 0) - (a.consecutive_errors ?? 0) ||
        (b.last_error_at ?? '').localeCompare(a.last_error_at ?? ''),
      )
      .slice(0, 8),
    [filteredData],
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
      <div className="fesco-header flex-shrink-0" style={{ marginBottom: 0 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1>{t('tracking.dashboard.title')}</h1>
            <div className="sub">
              {loading
                ? 'Loading…'
                : t('tracking.dashboard.activeContainersSynced', {
                    count: data.length,
                    time:  fmtRelTime(lastFetch),
                  })
              }
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 pt-1">
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
      </div>

      {/* ── Country filter row ─────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-7 py-2 border-b flex items-center gap-2 flex-wrap"
        style={{ borderColor: 'var(--ink-200)' }}
      >
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

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4 min-h-0">

        {/* Error banner */}
        {error && (
          <div
            className="rounded-lg border px-4 py-3 flex items-center gap-3 text-sm"
            style={{ background: 'var(--signal-red-bg)', borderColor: 'rgba(220,38,38,0.25)', color: 'var(--signal-red)' }}
          >
            <AlertCircle size={15} />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              className="text-xs underline underline-offset-2"
              onClick={() => fetchData()}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-4" style={{ minHeight: 280 }}>
              <div className="flex-1 rounded-lg border animate-pulse" style={{ background: 'var(--card)', borderColor: 'var(--line)' }} />
              <div className="rounded-lg border animate-pulse" style={{ width: 220, background: 'var(--card)', borderColor: 'var(--line)' }} />
            </div>
            <div className="flex gap-4" style={{ height: 200 }}>
              <div className="rounded-lg border animate-pulse" style={{ width: 240, background: 'var(--card)', borderColor: 'var(--line)' }} />
              <div className="flex-1 rounded-lg border animate-pulse" style={{ background: 'var(--card)', borderColor: 'var(--line)' }} />
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ── Top row ─────────────────────────────────────────────── */}
            <div className="flex gap-4" style={{ minHeight: 280 }}>

              {/* Map placeholder */}
              <div
                className="flex-1 rounded-lg border flex flex-col items-center justify-center gap-3"
                style={{ borderColor: 'var(--ink-200)', background: 'var(--card)' }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--ink-100)' }}
                >
                  <Ship size={22} style={{ color: 'var(--ink-400)' }} />
                </div>
                <div>
                  <p className="label-mono text-center">{t('tracking.dashboard.panel.containerLocations')}</p>
                  <p className="text-[10px] text-center mt-1" style={{ color: 'var(--ink-400)' }}>
                    {t('tracking.dashboard.mapPlaceholder')}
                  </p>
                </div>
              </div>

              {/* Recent orders */}
              <div
                className="rounded-lg border flex flex-col overflow-hidden"
                style={{ width: 220, borderColor: 'var(--ink-200)', background: 'var(--card)' }}
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
                        key={ord.key}
                        className="px-4 py-2.5 border-b flex items-center gap-2 transition-colors cursor-default"
                        style={{ borderColor: 'var(--ink-200)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--ink-50)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                      >
                        <SignalDot signal={ord.signal} />
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-[11px] font-mono font-medium truncate"
                            style={{ color: 'var(--ink-900)' }}
                          >
                            {ord.orderNum}
                          </div>
                          <div className="text-[10px] truncate" style={{ color: 'var(--ink-500)' }}>
                            {ord.route}
                          </div>
                        </div>
                        <span className="text-[9px] font-mono flex-shrink-0" style={{ color: 'var(--ink-400)' }}>
                          {ord.ctrs.length}×
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* ── Bottom row ──────────────────────────────────────────── */}
            <div className="flex gap-4" style={{ minHeight: 200 }}>

              {/* Status donut */}
              <div
                className="rounded-lg border flex items-center px-5 gap-5 flex-shrink-0"
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

              {/* Action needed */}
              <div
                className="flex-1 rounded-lg border flex flex-col overflow-hidden"
                style={{ borderColor: 'var(--ink-200)', background: 'var(--card)' }}
              >
                <div
                  className="px-4 pt-3 pb-2 border-b flex-shrink-0"
                  style={{ borderColor: 'var(--ink-200)' }}
                >
                  <span className="label-mono">{t('tracking.dashboard.panel.actionNeeded')}</span>
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
                    actionNeeded.map(c => (
                      <div
                        key={c.container_number}
                        className="px-4 py-2.5 border-b flex items-center gap-2.5 transition-colors"
                        style={{ borderColor: 'var(--ink-200)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--ink-50)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                      >
                        <SignalDot signal="red" />
                        <span
                          className="font-mono text-[11px] font-medium flex-shrink-0"
                          style={{ color: 'var(--ink-900)' }}
                        >
                          {c.container_number}
                        </span>
                        {c.last_error_at && daysSince(c.last_error_at) > 0 && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold flex-shrink-0"
                            style={{ background: 'var(--signal-red-bg)', color: 'var(--signal-red)' }}
                          >
                            +{daysSince(c.last_error_at)}d
                          </span>
                        )}
                        <span className="text-[10px] truncate flex-1" style={{ color: 'var(--ink-600)' }}>
                          {c.destination_city ?? '—'}
                          {c.destination_country_code && (
                            <span className="font-mono ml-1" style={{ color: 'var(--ink-400)' }}>
                              {c.destination_country_code}
                            </span>
                          )}
                        </span>
                        {c.last_error_message && (
                          <span
                            className="text-[9px] truncate hidden"
                            style={{ maxWidth: 140, color: 'var(--ink-400)' }}
                            title={c.last_error_message}
                          >
                            {c.last_error_message.substring(0, 40)}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
