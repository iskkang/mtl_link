import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, X, Search, ChevronRight } from 'lucide-react'
import {
  getFescoSignal,
  translateFescoStatusText,
  SIGNAL_COLOR,
} from '../../lib/fescoSignal'
import { useIsMobile } from '../../hooks/useIsMobile'

/* ── List-view order (subset of columns) ─────────────────────────── */
interface FescoOrder {
  id:                 number
  external_1c_number: string | null
  status:             string | null
  external_1c_status: string | null
  type:               string | null
  client_name:        string | null
  manager:            string | null
  route_latin:        string | null
  containers:         string[] | null
  bills:              string[] | null
  fesco_created_at:   string | null
  last_synced_at:     string | null
}

/* ── Detail-view order (all columns) ─────────────────────────────── */
interface FescoOrderDetail {
  id:                 number
  external_1c_number: string | null
  status:             string | null
  external_1c_status: string | null
  type:               string | null
  req_type:           number | null
  client_name:        string | null
  email:              string | null
  manager:            string | null
  manager_email:      string | null
  route_latin:        string | null
  containers:         string[] | null
  bills:              string[] | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tracking:           any[] | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  segments:           any[] | null
  signal:             string | null
  signal_message:     string | null
  region:             string | null
  fesco_created_at:   string | null
  last_synced_at:     string | null
}

/* ── Container tracking types ─────────────────────────────────────── */
interface ContainerTrackingRow {
  container_number:         string
  status:                   string | null
  alert_level:              string | null
  alert_reason:             string | null
  current_segment_type:     string | null
  current_from:             string | null
  current_to:               string | null
  departure_date:           string | null
  planned_departure_date:   string | null
  destination_date:         string | null
  planned_destination_date: string | null
  transport_name:           string | null
  voyage_number:            string | null
  last_checked_at:          string | null
  last_success_at:          string | null
  last_error_at:            string | null
  last_error_message:       string | null
  consecutive_errors:       number | null
  last_event_location:      string | null
}

interface OrderAlertSummary {
  red:    number
  yellow: number
  green:  number
  gray:   number
  total:  number
}

interface OrdersResponse {
  ok:     boolean
  total:  number
  limit:  number
  offset: number
  data:   FescoOrder[]
  error?: string
}

interface DetailResponse {
  ok:     boolean
  data?:  FescoOrderDetail
  error?: string
}

interface ContainerTrackingDetailResponse {
  ok:       boolean
  tracking: ContainerTrackingRow[]
  alerts:   unknown[]
  error?:   string
}

interface AlertSummaryResponse {
  ok:      boolean
  summary: Record<string, OrderAlertSummary>
  error?:  string
}

/* ── Constants ────────────────────────────────────────────────────── */
const STATUS_TABS = ['All', 'ACTIVE', 'REJECTED'] as const
type StatusTab = typeof STATUS_TABS[number]

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ACTIVE:   { bg: 'rgba(20,184,166,0.12)', color: '#0d9488' },
  REJECTED: { bg: 'rgba(220,38,38,0.10)', color: '#dc2626' },
}

const STATUS_LABELS: Record<string, string> = {
  planned:           'Planned',
  in_progress:       'In progress',
  awaiting_next_leg: 'Awaiting next leg',
  completed:         'Completed',
  unavailable:       'Unavailable',
  unknown:           'Unknown',
}

const ALERT_DISPLAY: Record<string, { label: string; color: string; bg: string; border: string }> = {
  red:    { label: 'Risk',      color: '#dc2626', bg: 'rgba(220,38,38,0.08)',   border: 'rgba(220,38,38,0.25)'   },
  yellow: { label: 'Watch',     color: '#d97706', bg: 'rgba(217,119,6,0.08)',   border: 'rgba(217,119,6,0.25)'   },
  green:  { label: 'OK',        color: '#0d9488', bg: 'rgba(20,184,166,0.08)',  border: 'rgba(20,184,166,0.25)'  },
  gray:   { label: 'Completed', color: '#6b7280', bg: 'rgba(107,114,128,0.06)', border: 'rgba(107,114,128,0.2)'  },
}

const ALERT_SORT: Record<string, number> = { red: 0, yellow: 1, green: 2, gray: 3 }

const STALE_WATCH_HOURS = 24
const STALE_RISK_HOURS  = 48

const STALE_DISPLAY = {
  watch: { label: '미업데이트', color: '#d97706', bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.25)'  },
  risk:  { label: '미업데이트', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.25)' },
}

function staleLabel(info: { label: string }, lastSuccessAt: string | null): string {
  if (!lastSuccessAt) return info.label
  const d = new Date(lastSuccessAt)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${info.label} · ${mm}/${dd}`
}

function getStaleState(row: ContainerTrackingRow): 'fresh' | 'watch' | 'risk' {
  if (row.status === 'completed') return 'fresh'
  if (!row.last_success_at) return 'risk'
  const ageHours = (Date.now() - new Date(row.last_success_at).getTime()) / 3_600_000
  if (ageHours >= STALE_RISK_HOURS)  return 'risk'
  if (ageHours >= STALE_WATCH_HOURS) return 'watch'
  return 'fresh'
}

// Load more than default to support full client-side search across all orders.
// API caps at 100; current total active orders: ~57.
const PAGE_SIZE = 100

function getStatusStyle(status: string | null) {
  return STATUS_STYLE[(status ?? '').toUpperCase()] ?? { bg: 'var(--side-row)', color: 'var(--ink-3)' }
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins   = Math.floor(diffMs / 60_000)
  const hours  = Math.floor(diffMs / 3_600_000)
  const days   = Math.floor(diffMs / 86_400_000)
  if (mins  < 1)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return '—'
  const m = v.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : v
}

const val = (v: string | null | undefined) => v?.trim() || '—'

/* ── Search helpers ──────────────────────────────────────────────── */
function getOrderContainerNumbers(order: FescoOrder): string[] {
  const value = order.containers
  if (Array.isArray(value)) {
    return value.map(v => String(v || '').trim()).filter(Boolean)
  }
  return []
}

function matchesSearch(order: FescoOrder, q: string): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  const containerText = getOrderContainerNumbers(order).join(' ')
  const haystack = [
    order.external_1c_number,
    order.route_latin,
    order.manager,
    order.client_name,
    order.status,
    order.external_1c_status,
    order.type,
    containerText,
  ].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(needle)
}

/* ── Detail panel helper ─────────────────────────────────────────── */
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b last:border-0" style={{ borderColor: 'var(--line)' }}>
      <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>{label}</span>
      <span className="text-sm break-words" style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  )
}

/* ── FESCO signal mini donut ─────────────────────────────────────── */
function FescoSignalDonut({ green, yellow, red }: { green: number; yellow: number; red: number }) {
  const total = green + yellow + red
  const CX = 37, R = 27, SW = 9
  const C = 2 * Math.PI * R
  if (total === 0) return (
    <svg width={74} height={74} style={{ flexShrink: 0 }}>
      <circle cx={CX} cy={CX} r={R} fill="none" strokeWidth={SW} stroke="var(--ink-100)" />
      <text x={CX} y={CX + 4} textAnchor="middle" fontSize="12" fill="var(--ink-400)" fontFamily="var(--font-body)">0</text>
    </svg>
  )
  const segs = [
    { val: red,    color: '#dc2626' },
    { val: yellow, color: '#d97706' },
    { val: green,  color: '#0d9488' },
  ]
  let offset = 0
  return (
    <svg width={74} height={74} style={{ flexShrink: 0 }}>
      {segs.map(({ val, color }, i) => {
        if (val === 0) return null
        const len = (val / total) * C
        const el = (
          <circle key={i} cx={CX} cy={CX} r={R} fill="none" strokeWidth={SW}
            stroke={color} strokeDasharray={`${len} ${C - len}`}
            strokeDashoffset={-offset} strokeLinecap="butt"
            transform={`rotate(-90 ${CX} ${CX})`} />
        )
        offset += len
        return el
      })}
      <text x={CX} y={CX - 2} textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--ink-900)" fontFamily="var(--font-body)">{total}</text>
      <text x={CX} y={CX + 9} textAnchor="middle" fontSize="5" fontWeight="600" fill="var(--ink-500)" letterSpacing="1" fontFamily="var(--font-mono)">TOTAL</text>
    </svg>
  )
}

/* ── Mobile FESCO view ───────────────────────────────────────────── */
interface MobileFescoViewProps {
  filteredOrders:      FescoOrder[]
  loading:             boolean
  error:               string | null
  searchInput:         string
  setSearchInput:      (v: string) => void
  q:                   string
  setQ:                (v: string) => void
  statusTab:           StatusTab
  setStatusTab:        (t: StatusTab) => void
  selectedId:          number | null
  detail:              FescoOrderDetail | null
  detailLoading:       boolean
  detailError:         string | null
  containerTracking:   ContainerTrackingRow[]
  trackingLoading:     boolean
  trackingError:       string | null
  expandedStaleCtr:    string | null
  setExpandedStaleCtr: (v: string | null) => void
  onCardClick:         (id: number) => void
  onClose:             () => void
  onRefresh:           () => void
  alertSummaries:      Record<number, OrderAlertSummary>
}

function MobileFescoView({
  filteredOrders, loading, error, searchInput, setSearchInput,
  q, setQ, statusTab, setStatusTab, selectedId, detail, detailLoading, detailError,
  containerTracking, trackingLoading, trackingError, expandedStaleCtr, setExpandedStaleCtr,
  onCardClick, onClose, onRefresh, alertSummaries,
}: MobileFescoViewProps) {
  const [mobileTab, setMobileTab] = useState<'action' | 'all'>('all')

  const actionOrders = useMemo(() =>
    filteredOrders.filter(o => {
      const { signal } = getFescoSignal(o)
      return signal === 'red' || signal === 'yellow'
    }),
    [filteredOrders],
  )

  const fescoStats = useMemo(() => {
    const m = { green: 0, yellow: 0, red: 0 }
    filteredOrders.forEach(o => {
      const { signal } = getFescoSignal(o)
      if      (signal === 'green')  m.green++
      else if (signal === 'yellow') m.yellow++
      else if (signal === 'red')    m.red++
    })
    return m
  }, [filteredOrders])

  const displayOrders = mobileTab === 'action' ? actionOrders : filteredOrders

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--chat-bg)', overflow: 'hidden', paddingBottom: 64 }}>

      {/* [1] Header — title row */}
      <div style={{ flexShrink: 0, padding: '12px 14px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>FESCO 추적</span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--ink-300)', color: 'var(--ink-500)', background: 'transparent', cursor: 'pointer', opacity: loading ? 0.4 : 1 }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* [1b] Status badges */}
      {!loading && (fescoStats.red > 0 || fescoStats.yellow > 0 || fescoStats.green > 0) && (
        <div style={{ flexShrink: 0, padding: '0 14px 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {fescoStats.red > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', background: 'rgba(220,38,38,0.08)', borderRadius: 10, padding: '2px 8px' }}>
              {fescoStats.red} 조치필요
            </span>
          )}
          {fescoStats.yellow > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#d97706', background: 'rgba(217,119,6,0.08)', borderRadius: 10, padding: '2px 8px' }}>
              {fescoStats.yellow} 주의
            </span>
          )}
          {fescoStats.green > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#0d9488', background: 'rgba(20,184,166,0.08)', borderRadius: 10, padding: '2px 8px' }}>
              {fescoStats.green} 정상
            </span>
          )}
        </div>
      )}

      {/* [3] Search bar */}
      <div style={{ flexShrink: 0, padding: '0 14px 6px' }}>
        <div style={{ display: 'flex', height: 34, background: 'var(--card)', borderRadius: 8, border: `1px solid ${q ? 'var(--brand)' : 'var(--ink-200)'}`, overflow: 'hidden', alignItems: 'center' }}>
          <span style={{ paddingLeft: 10, color: 'var(--ink-400)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Search size={13} />
          </span>
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setQ(searchInput.trim()) }}
            placeholder="부킹번호 / 컨테이너 / 고객 / 경로…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '0 8px', fontSize: 13, color: 'var(--ink-800)' }}
          />
          {searchInput && (
            <button type="button" onClick={() => { setSearchInput(''); setQ('') }}
              style={{ padding: '0 6px', color: 'var(--ink-400)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <X size={12} />
            </button>
          )}
          <button type="button" onClick={() => setQ(searchInput.trim())}
            style={{ padding: '0 12px', height: '100%', background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
            검색
          </button>
        </div>
      </div>

      {/* Status filter chips */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 6, padding: '0 14px 8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setStatusTab(tab)}
            style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 14, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              background: statusTab === tab ? '#E1F5EE' : 'var(--side-row)',
              color:      statusTab === tab ? '#0F6E56'  : 'var(--ink-3)',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* [5] Summary card */}
      {!loading && (
        <div style={{ flexShrink: 0, margin: '0 14px 8px', background: 'var(--card)', borderRadius: 12, border: '0.5px solid var(--ink-200)', display: 'flex', alignItems: 'center', padding: '12px 14px', gap: 14 }}>
          <FescoSignalDonut green={fescoStats.green} yellow={fescoStats.yellow} red={fescoStats.red} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
            {[
              { color: '#0d9488', label: '정상',     count: fescoStats.green },
              { color: '#d97706', label: '주의',     count: fescoStats.yellow },
              { color: '#dc2626', label: '조치필요', count: fescoStats.red },
            ].map(({ color, label, count }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, flex: 1, color: 'var(--ink-700)' }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--ink-900)' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* [6] List with tabs */}
      <div style={{ flex: 1, minHeight: 0, margin: '0 14px', background: 'var(--card)', borderRadius: '12px 12px 0 0', border: '0.5px solid var(--ink-200)', borderBottom: 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Tab bar */}
        <div style={{ flexShrink: 0, display: 'flex', borderBottom: '0.5px solid var(--ink-200)' }}>
          {([
            { key: 'action' as const, label: '조치필요', badge: actionOrders.length > 0 ? actionOrders.length : null },
            { key: 'all'    as const, label: '전체',     badge: null },
          ]).map(({ key, label, badge }) => {
            const isActive = mobileTab === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMobileTab(key)}
                style={{ flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 600,
                  borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                  borderBottom: `2px solid ${isActive ? '#0F6E56' : 'transparent'}`,
                  color:      isActive ? '#0F6E56'  : 'var(--ink-400)',
                  background: isActive ? '#E1F5EE30' : 'transparent',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
              >
                {label}
                {badge != null && (
                  <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 700, color: '#dc2626' }}>{badge}</span>
                )}
              </button>
            )
          })}
        </div>
        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {error && (
            <div style={{ margin: '4px 0', padding: 12, borderRadius: 10, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', color: '#dc2626', fontSize: 13 }}>
              {error}
            </div>
          )}
          {loading && !error && (
            <>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="animate-pulse" style={{ height: 56, background: 'var(--ink-100)', borderRadius: 8 }} />
              ))}
            </>
          )}
          {!loading && displayOrders.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', fontSize: 12, color: 'var(--ink-400)' }}>
              {mobileTab === 'action' ? '조치 필요 항목 없음' : '부킹 없음'}
            </div>
          )}
          {!loading && displayOrders.map(order => {
            const { signal: rawSignal } = getFescoSignal(order)
            const ctrSum = alertSummaries[order.id]
            const signal = (rawSignal !== 'gray' && (ctrSum?.red ?? 0) > 0) ? 'red' : rawSignal
            const color  = SIGNAL_COLOR[signal]
            const ctrs   = order.containers ?? []
            return (
              <button
                key={order.id}
                type="button"
                onClick={() => onCardClick(order.id)}
                style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: '0.5px solid var(--ink-200)', borderRadius: 8, background: order.id === selectedId ? '#E1F5EE40' : 'var(--card)', display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, cursor: 'pointer' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color.dotBg, boxShadow: `0 0 0 2.5px ${color.dotRing}`, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: 'var(--ink-900)', marginBottom: 2 }}>
                    {order.external_1c_number ?? `FESCO-${order.id}`}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ink-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {order.route_latin ?? (ctrs.slice(0, 2).join(' · ') || '—')}
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--ink-300)', flexShrink: 0 }} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Detail fullscreen overlay */}
      <div
        style={{
          position: 'fixed', inset: 0,
          transform: selectedId != null ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.25s cubic-bezier(.4,0,.2,1)',
          zIndex: 100, pointerEvents: selectedId != null ? 'auto' : 'none',
          background: 'var(--chat-bg)', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Overlay header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--line)', background: 'var(--chat-bg)' }}>
          <button type="button" onClick={onClose} style={{ padding: '4px 8px 4px 0', color: 'var(--ink-400)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <X size={20} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {detail ? (detail.external_1c_number ?? `FESCO-${detail.id}`) : 'Loading…'}
          </span>
        </div>
        {/* Overlay body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          {detailLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3,4,5].map(i => <div key={i} className="animate-pulse" style={{ height: 40, borderRadius: 8, background: 'var(--side-row)' }} />)}
            </div>
          )}
          {detailError && !detailLoading && (
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', color: '#dc2626', fontSize: 13 }}>
              {detailError}
            </div>
          )}
          {detail && !detailLoading && (() => {
            const { signal } = getFescoSignal(detail)
            const color = SIGNAL_COLOR[signal]
            const containers: string[] = Array.isArray(detail.containers) ? detail.containers : []
            const trackingMap = new Map(containerTracking.map(t => [t.container_number, t]))
            return (
              <>
                {/* Signal banner */}
                {detail.signal && (
                  <div style={{ marginBottom: 12, borderRadius: 10, padding: 10, fontSize: 13,
                    background: detail.signal === 'green' ? 'rgba(20,184,166,0.08)' : detail.signal === 'red' ? 'rgba(220,38,38,0.06)' : 'rgba(217,119,6,0.08)',
                    border: `1px solid ${detail.signal === 'green' ? 'rgba(20,184,166,0.3)' : detail.signal === 'red' ? 'rgba(220,38,38,0.25)' : 'rgba(217,119,6,0.3)'}`,
                  }}>
                    <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{detail.signal_message ?? detail.signal}</span>
                  </div>
                )}

                {/* Info */}
                <div style={{ borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card)', padding: '12px 14px', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>부킹 정보</div>
                  {[
                    { label: 'Status',  value: detail.status ?? '—' },
                    { label: 'Route',   value: detail.route_latin ?? '—' },
                    { label: 'Client',  value: detail.client_name ?? '—' },
                    { label: 'Manager', value: detail.manager ?? '—' },
                    { label: 'Signal',  value: <span style={{ color: color.text, fontWeight: 600 }}>{color.label}</span> },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 11, color: 'var(--ink-4)', minWidth: 72 }}>{label}</span>
                      <span style={{ fontSize: 13, color: 'var(--ink)', textAlign: 'right', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Containers */}
                {containers.length > 0 && (
                  <div style={{ borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card)', padding: '12px 14px', marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                      Containers ({containers.length})
                    </div>
                    {containers.map(cn => {
                      const tr = trackingMap.get(cn)
                      const alertInfo = tr ? (ALERT_DISPLAY[tr.alert_level ?? 'gray'] ?? ALERT_DISPLAY.gray) : null
                      return (
                        <div key={cn} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--ink-100)' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)' }}>{cn}</span>
                          {alertInfo && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: alertInfo.color, background: alertInfo.bg, border: `1px solid ${alertInfo.border}`, borderRadius: 4, padding: '1px 6px' }}>
                              {alertInfo.label}
                            </span>
                          )}
                        </div>
                      )
                    })}
                    {trackingLoading && <div style={{ fontSize: 11, color: 'var(--ink-4)', paddingTop: 6 }}>Loading tracking…</div>}
                  </div>
                )}

                {/* Container tracking */}
                {!trackingLoading && containerTracking.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                      Container Tracking ({containerTracking.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[...containerTracking]
                        .sort((a, b) => (ALERT_SORT[a.alert_level ?? 'gray'] ?? 3) - (ALERT_SORT[b.alert_level ?? 'gray'] ?? 3) || a.container_number.localeCompare(b.container_number))
                        .map(tr => {
                          const ai = ALERT_DISPLAY[tr.alert_level ?? 'gray'] ?? ALERT_DISPLAY.gray
                          const staleState = getStaleState(tr)
                          const staleInfo  = staleState !== 'fresh' ? STALE_DISPLAY[staleState] : null
                          const isExpanded = expandedStaleCtr === tr.container_number
                          const route = [tr.current_from, tr.current_to].filter(Boolean).join(' → ')
                          return (
                            <div key={tr.container_number} style={{ borderRadius: 10, padding: 12, background: ai.bg, border: `1px solid ${ai.border}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{tr.container_number}</span>
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                  {staleInfo && (
                                    <button onClick={() => setExpandedStaleCtr(isExpanded ? null : tr.container_number)}
                                      style={{ fontSize: 10, fontWeight: 600, color: staleInfo.color, background: staleInfo.bg, border: `1px solid ${staleInfo.border}`, borderRadius: 4, padding: '1px 6px', cursor: 'pointer' }}>
                                      {staleLabel(staleInfo, tr.last_success_at)}
                                    </button>
                                  )}
                                  <span style={{ fontSize: 11, fontWeight: 600, color: ai.color }}>{ai.label}</span>
                                </div>
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                                {STATUS_LABELS[tr.status ?? ''] ?? (tr.status ?? '—')}
                                {route ? ` · ${route}` : ''}
                              </div>
                              {tr.last_event_location && (
                                <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>
                                  📍 {tr.last_event_location}
                                </div>
                              )}
                              {tr.alert_reason && (
                                <div style={{ fontSize: 11, color: ai.color, marginTop: 2 }}>{tr.alert_reason}</div>
                              )}
                              {staleInfo && isExpanded && (
                                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: 'var(--side-row)', border: `1px solid ${staleInfo.border}`, fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                                  <div style={{ fontWeight: 600, color: staleInfo.color, marginBottom: 2 }}>Tracking data is stale</div>
                                  <div>Last refreshed: <span style={{ color: 'var(--ink)' }}>{tr.last_success_at ? relativeTime(tr.last_success_at) : 'Never'}</span></div>
                                  {tr.last_error_message && (
                                    <div>Last error: <span style={{ color: '#dc2626' }}>{tr.last_error_message}</span></div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}
                {trackingError && !trackingLoading && (
                  <div style={{ fontSize: 11, color: '#dc2626', padding: '4px 0' }}>Unable to load container tracking.</div>
                )}
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────────── */
export function FescoTrackingPage({ onBack }: { onBack?: () => void } = {}) {
  /* list state */
  const [searchInput,    setSearchInput]    = useState('')
  const [q,              setQ]              = useState('')
  const [statusTab,      setStatusTab]      = useState<StatusTab>('All')
  const [orders,         setOrders]         = useState<FescoOrder[]>([])
  const [total,          setTotal]          = useState(0)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<string | null>(null)
  const [refreshKey,     setRefreshKey]     = useState(0)
  const [alertSummaries, setAlertSummaries] = useState<Record<number, OrderAlertSummary>>({})

  /* detail state */
  const [selectedId,    setSelectedId]    = useState<number | null>(null)
  const [detail,        setDetail]        = useState<FescoOrderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError,   setDetailError]   = useState<string | null>(null)

  /* container tracking state */
  const [containerTracking,  setContainerTracking]  = useState<ContainerTrackingRow[]>([])
  const [trackingLoading,    setTrackingLoading]    = useState(false)
  const [trackingError,      setTrackingError]      = useState<string | null>(null)
  const [expandedStaleCtr,   setExpandedStaleCtr]   = useState<string | null>(null)

  /* fetch alert summaries (fire-and-forget — non-critical) */
  const fetchAlertSummaries = useCallback(async (orderIds: number[]) => {
    if (orderIds.length === 0) return
    try {
      const res  = await fetch(`/api/fesco/container-tracking?summary=1&order_ids=${orderIds.join(',')}`)
      const json = await res.json() as AlertSummaryResponse
      if (!json.ok) return
      const parsed: Record<number, OrderAlertSummary> = {}
      for (const [k, v] of Object.entries(json.summary)) {
        parsed[parseInt(k, 10)] = v
      }
      setAlertSummaries(parsed)
    } catch {
      // non-critical: card chips simply won't appear
    }
  }, [])

  /* fetch list — search is client-side; only status is sent to server */
  const fetchOrders = useCallback(async (status: StatusTab) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: '0' })
      if (status !== 'All') params.set('status', status)
      const res  = await fetch(`/api/fesco/orders?${params}`)
      const json = await res.json() as OrdersResponse
      if (!json.ok) throw new Error(json.error ?? 'Failed to load bookings')
      setOrders(json.data)
      setTotal(json.total)
      fetchAlertSummaries(json.data.map(o => o.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [fetchAlertSummaries])

  useEffect(() => {
    fetchOrders(statusTab)
  }, [statusTab, fetchOrders, refreshKey])

  /* fetch detail */
  const fetchDetail = useCallback(async (id: number) => {
    setDetailLoading(true)
    setDetailError(null)
    setDetail(null)
    try {
      const res  = await fetch(`/api/fesco/orders?id=${id}`)
      const json = await res.json() as DetailResponse
      if (!json.ok) throw new Error(json.error ?? 'Failed to load order detail')
      setDetail(json.data ?? null)
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : String(e))
    } finally {
      setDetailLoading(false)
    }
  }, [])

  /* fetch container tracking for selected order */
  const fetchContainerTracking = useCallback(async (id: number) => {
    setTrackingLoading(true)
    setTrackingError(null)
    setContainerTracking([])
    try {
      const res  = await fetch(`/api/fesco/container-tracking?order_id=${id}`)
      const json = await res.json() as ContainerTrackingDetailResponse
      if (!json.ok) throw new Error(json.error ?? 'Failed to load tracking')
      setContainerTracking(json.tracking)
    } catch (e) {
      setTrackingError(e instanceof Error ? e.message : String(e))
    } finally {
      setTrackingLoading(false)
    }
  }, [])

  const resetDetail = () => {
    setDetail(null)
    setDetailError(null)
    setContainerTracking([])
    setTrackingError(null)
  }

  const handleCardClick = (id: number) => {
    if (id === selectedId) {
      setSelectedId(null)
      resetDetail()
    } else {
      setSelectedId(id)
      fetchDetail(id)
      fetchContainerTracking(id)
    }
  }

  const handleSearch  = () => setQ(searchInput.trim())
  const handleRefresh = () => setRefreshKey(k => k + 1)
  const handleClose   = () => { setSelectedId(null); resetDetail() }

  /* client-side filter — includes container numbers */
  const filteredOrders = q ? orders.filter(o => matchesSearch(o, q)) : orders

  const isMobile = useIsMobile()

  /* ── Mobile branch ───────────────────────────────────────────── */
  if (isMobile) {
    return (
      <MobileFescoView
        filteredOrders={filteredOrders}
        loading={loading}
        error={error}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        q={q}
        setQ={setQ}
        statusTab={statusTab}
        setStatusTab={setStatusTab}
        selectedId={selectedId}
        detail={detail}
        detailLoading={detailLoading}
        detailError={detailError}
        containerTracking={containerTracking}
        trackingLoading={trackingLoading}
        trackingError={trackingError}
        expandedStaleCtr={expandedStaleCtr}
        setExpandedStaleCtr={setExpandedStaleCtr}
        onCardClick={handleCardClick}
        onClose={handleClose}
        onRefresh={handleRefresh}
        alertSummaries={alertSummaries}
      />
    )
  }

  /* ── Desktop render ──────────────────────────────────────────── */
  return (
    <div className="fesco-bookings-shell flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--chat-bg)' }}>

      {/* Header */}
      <div className="fesco-header flex-shrink-0 flex items-start justify-between">
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="label-mono mb-2 flex items-center gap-1 transition-colors"
              style={{ color: 'var(--mint-deep)', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              ← Dashboard
            </button>
          )}
          <h1>FESCO <em>Bookings</em></h1>
          <div className="sub">
            {loading ? 'Loading…' : `${total.toLocaleString()} bookings synced from FESCO LK`}
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ borderColor: 'var(--line)', color: 'var(--ink-3)', background: 'var(--card)' }}
        >
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div
        className="flex-shrink-0 px-6 py-3 border-b flex flex-wrap items-center gap-3"
        style={{ borderColor: 'var(--line)' }}
      >
        <div className="flex gap-2 flex-1 min-w-0">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search by booking #, container, route, client, manager…"
            className="flex-1 min-w-0 px-3 py-1.5 rounded-lg text-sm outline-none border transition-colors"
            style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
          />
          <button
            type="button"
            onClick={handleSearch}
            className="px-4 py-1.5 rounded-lg text-sm font-medium flex-shrink-0"
            style={{ background: 'var(--brand)', color: '#fff' }}
          >
            Search
          </button>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusTab(tab)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={statusTab === tab
                ? { background: 'var(--brand)', color: '#fff' }
                : { background: 'var(--side-row)', color: 'var(--ink-3)' }
              }
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content — switches to master/detail when an order is selected */}
      <div className={`flex-1 overflow-hidden flex flex-col ${selectedId ? 'md:flex-row' : ''}`}>

        {/* ── List column ──
             Future use:
             This sidebar area is intentionally reserved for recent search/history items,
             similar to ChatGPT conversation history.
             Do not collapse or remove it during current FESCO booking UI work.
        */}
        <div
          className={`overflow-y-auto px-4 py-4 ${
            selectedId
              ? 'md:w-96 md:flex-shrink-0 md:border-r border-b md:border-b-0'
              : 'flex-1 px-6'
          }`}
          style={{ borderColor: 'var(--line)' }}
        >
          {/* List error */}
          {error && (
            <div
              className="rounded-xl border p-4 mb-4 text-sm"
              style={{ background: 'rgba(220,38,38,0.06)', borderColor: 'rgba(220,38,38,0.25)', color: '#dc2626' }}
            >
              <div className="font-medium mb-1">Error</div>
              <div style={{ color: 'var(--ink-3)' }}>{error}</div>
            </div>
          )}

          {/* Loading skeletons */}
          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border animate-pulse"
                  style={{ background: 'var(--card)', borderColor: 'var(--line)', height: 84 }}
                />
              ))}
            </div>
          )}

          {/* Empty */}
          {!loading && !error && filteredOrders.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-20 text-sm"
              style={{ color: 'var(--ink-4)' }}
            >
              <div className="text-3xl mb-3">📭</div>
              {orders.length === 0 ? (
                <div className="font-medium">No bookings found</div>
              ) : (
                <>
                  <div className="font-medium">No bookings match "{q}"</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--ink-4)' }}>
                    {orders.length} bookings loaded — try a different search term
                  </div>
                </>
              )}
              {(q || statusTab !== 'All') && (
                <button
                  type="button"
                  className="mt-3 text-xs underline underline-offset-2"
                  style={{ color: 'var(--brand)' }}
                  onClick={() => { setQ(''); setSearchInput(''); setStatusTab('All') }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Booking cards */}
          {!loading && filteredOrders.length > 0 && (
            <div>
              {filteredOrders.map(order => {
                const isSelected     = order.id === selectedId
                const containers     = order.containers ?? []
                const containerCount = containers.length
                const { signal: rawSignal, region, elapsedDays } = getFescoSignal(order)
                const ctrSummary = alertSummaries[order.id]
                const signal     = (rawSignal !== 'gray' && (ctrSummary?.red ?? 0) > 0) ? 'red' : rawSignal
                const color      = SIGNAL_COLOR[signal]
                const statusStr  = (order.status ?? '').toLowerCase()
                const pillClass  = statusStr === 'active'   ? 'active'
                                 : statusStr === 'rejected' ? 'rejected'
                                 : 'complete'

                return (
                  <button
                    key={order.id}
                    type="button"
                    className={`fesco-card-compact${isSelected ? ' is-active' : ''}`}
                    onClick={() => handleCardClick(order.id)}
                  >
                    {/* top row: dot · number · pill · time */}
                    <div className="fesco-card-top">
                      <span
                        className={`fesco-signal${color.pulse ? ' fesco-signal-pulse-red' : ''}`}
                        style={{
                          backgroundColor: color.dotBg,
                          boxShadow: `0 0 0 3px ${color.dotRing}`,
                        }}
                        aria-label={color.label}
                        title={color.label}
                      />
                      <span className="fesco-number">
                        {order.external_1c_number ?? `FESCO-${order.id}`}
                      </span>
                      <span className={`fesco-status-pill ${pillClass}`}>
                        {order.status ?? '—'}
                      </span>
                      <span className="fesco-time">
                        {relativeTime(order.last_synced_at)}
                      </span>
                    </div>

                    {/* manager */}
                    {order.manager && (
                      <div className="fesco-card-meta">
                        <span className="fesco-manager" title={order.manager}>
                          {order.manager}
                        </span>
                      </div>
                    )}

                    {/* Russian status */}
                    {order.external_1c_status && (
                      <div className="fesco-status-text" title={order.external_1c_status || undefined}>
                        {translateFescoStatusText(order.external_1c_status)}
                      </div>
                    )}

                    {/* route */}
                    <div className="fesco-route" title={order.route_latin ?? undefined}>
                      {order.route_latin ?? '—'}
                    </div>

                    {/* containers */}
                    {containerCount > 0 ? (
                      <div className="fesco-containers">
                        <span className="ctr-count">{containerCount} ctr:</span>{' '}
                        {containers.slice(0, 3).join(' · ')}
                        {containerCount > 3 ? ` +${containerCount - 3}` : ''}
                      </div>
                    ) : (
                      <div className="fesco-containers empty">No containers</div>
                    )}

                    {/* order-level signal label — prefix makes order-level scope explicit */}
                    <div className="fesco-signal-label" style={{ color: color.text }}>
                      Order signal · {color.label}
                      {elapsedDays !== null ? ` · ${elapsedDays}d` : ''}
                      {region !== 'Other' ? ` · ${region}` : ''}
                    </div>

                    {/* container tracking alert chip */}
                    {ctrSummary && ctrSummary.total > 0 && (() => {
                      const hasRisk   = ctrSummary.red > 0 || ctrSummary.yellow > 0
                      const chipColor = ctrSummary.red > 0 ? '#dc2626'
                                      : ctrSummary.yellow > 0 ? '#d97706'
                                      : '#0d9488'
                      const parts: string[] = []
                      if (ctrSummary.red    > 0) parts.push(`${ctrSummary.red} red`)
                      if (ctrSummary.yellow > 0) parts.push(`${ctrSummary.yellow} yellow`)
                      return (
                        <div className="fesco-signal-label" style={{ color: chipColor }}>
                          Container alert · {hasRisk ? parts.join(' · ') : 'OK'}
                        </div>
                      )
                    })()}
                  </button>
                )
              })}
            </div>
          )}

          {/* Search result count / pagination hint */}
          {!loading && !error && (
            <>
              {q && filteredOrders.length > 0 && filteredOrders.length < orders.length && (
                <div className="text-center text-xs py-3" style={{ color: 'var(--ink-4)' }}>
                  {filteredOrders.length} of {orders.length} bookings match
                </div>
              )}
              {!q && total > orders.length && (
                <div className="text-center text-xs py-5" style={{ color: 'var(--ink-4)' }}>
                  Showing {orders.length.toLocaleString()} of {total.toLocaleString()} bookings
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Detail column ── */}
        {selectedId && (
          <div className="flex-1 overflow-y-auto" style={{ minWidth: 0 }}>

            {/* Detail header */}
            <div
              className="sticky top-0 flex items-center justify-between px-6 py-3 border-b"
              style={{ background: 'var(--chat-bg)', borderColor: 'var(--line)', zIndex: 1 }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {detail
                  ? (detail.external_1c_number ?? `FESCO-${detail.id}`)
                  : 'Loading…'}
              </span>
              <button
                type="button"
                onClick={handleClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-colors"
                style={{ color: 'var(--ink-4)', background: 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                aria-label="Close detail"
              >
                ✕
              </button>
            </div>

            {/* Detail loading */}
            {detailLoading && (
              <div className="px-6 py-8 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-lg animate-pulse"
                    style={{ background: 'var(--side-row)', height: 36 }}
                  />
                ))}
              </div>
            )}

            {/* Detail error */}
            {detailError && !detailLoading && (
              <div className="px-6 py-4">
                <div
                  className="rounded-xl border p-4 text-sm"
                  style={{ background: 'rgba(220,38,38,0.06)', borderColor: 'rgba(220,38,38,0.25)', color: '#dc2626' }}
                >
                  <div className="font-medium mb-1">Failed to load detail</div>
                  <div style={{ color: 'var(--ink-3)' }}>{detailError}</div>
                </div>
              </div>
            )}

            {/* Detail content */}
            {detail && !detailLoading && (
              <div className="px-6 pt-6 pb-4 space-y-5">

                {/* Signal banner (if present) */}
                {detail.signal && (
                  <div
                    className="rounded-xl border p-3 text-sm"
                    style={{
                      background:  detail.signal === 'green'  ? 'rgba(20,184,166,0.08)'
                                 : detail.signal === 'red'    ? 'rgba(220,38,38,0.06)'
                                 : 'rgba(217,119,6,0.08)',
                      borderColor: detail.signal === 'green'  ? 'rgba(20,184,166,0.3)'
                                 : detail.signal === 'red'    ? 'rgba(220,38,38,0.25)'
                                 : 'rgba(217,119,6,0.3)',
                    }}
                  >
                    <div className="font-medium" style={{ color: 'var(--ink)' }}>
                      {detail.signal_message ?? detail.signal}
                    </div>
                  </div>
                )}

                {/* Booking info */}
                <section
                  className="rounded-xl border p-4"
                  style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
                >
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ink-4)' }}>
                    Booking
                  </h3>
                  <DetailRow label="Status"     value={
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="px-1.5 py-0.5 rounded text-xs font-medium"
                        style={getStatusStyle(detail.status)}
                      >
                        {val(detail.status)}
                      </span>
                      {detail.external_1c_status && (
                        <span className="text-xs" style={{ color: 'var(--ink-4)' }} title={detail.external_1c_status || undefined}>
                          {translateFescoStatusText(detail.external_1c_status)}
                        </span>
                      )}
                    </span>
                  } />
                  <DetailRow label="Route"       value={val(detail.route_latin)} />
                  <DetailRow label="Type"        value={val(detail.type)} />
                  <DetailRow label="Region"      value={val(detail.region)} />
                  <DetailRow label="Client"      value={val(detail.client_name)} />
                  <DetailRow label="Created"     value={val(detail.fesco_created_at)} />
                  <DetailRow label="Last synced" value={relativeTime(detail.last_synced_at)} />
                </section>

                {/* Contacts */}
                <section
                  className="rounded-xl border p-4"
                  style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
                >
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ink-4)' }}>
                    Manager
                  </h3>
                  <DetailRow label="Name"  value={val(detail.manager)} />
                  <DetailRow label="Email" value={val(detail.manager_email)} />
                </section>

                {/* Containers — compact list with alert chip only.
                    Full tracking detail is shown in the CONTAINER TRACKING section below. */}
                {(() => {
                  const { signal: cSig } = getFescoSignal(detail)
                  const cColor = SIGNAL_COLOR[cSig]
                  const containers: string[] = Array.isArray(detail.containers) ? detail.containers : []
                  const trackingMap = new Map(containerTracking.map(t => [t.container_number, t]))

                  return (
                    <div className="detail-card">
                      <div className="detail-title">CONTAINERS ({containers.length})</div>

                      {containers.length > 0 ? (
                        <div className="container-list">
                          {containers.map(containerNo => {
                            const tr = trackingMap.get(containerNo)

                            if (!tr) {
                              return (
                                <div key={containerNo} className="container-row">
                                  <span
                                    className={`fesco-signal${cColor.pulse ? ' fesco-signal-pulse-red' : ''}`}
                                    style={{
                                      backgroundColor: cColor.dotBg,
                                      boxShadow: `0 0 0 3px ${cColor.dotRing}`,
                                    }}
                                  />
                                  <span className="container-no">{containerNo}</span>
                                  <span className="container-signal" style={{ color: cColor.text }}>
                                    Order signal applied
                                  </span>
                                </div>
                              )
                            }

                            const alertInfo = ALERT_DISPLAY[tr.alert_level ?? 'gray'] ?? ALERT_DISPLAY.gray

                            return (
                              <div key={containerNo} className="container-row">
                                <span className="container-no">{containerNo}</span>
                                <span
                                  className="text-xs font-medium px-1.5 py-0.5 rounded"
                                  style={{ background: alertInfo.bg, color: alertInfo.color, border: `1px solid ${alertInfo.border}` }}
                                >
                                  {alertInfo.label}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="detail-empty">No containers</div>
                      )}

                      {trackingLoading && (
                        <div className="detail-empty" style={{ fontSize: 12, marginTop: 4 }}>
                          Loading container tracking…
                        </div>
                      )}
                    </div>
                  )
                  /*
                    v1.1 NOTE:
                    Containers are actual container numbers (text[]), but signal is still order-level.

                    v1.6 NOTE:
                    Compact chip only here. Full per-container tracking detail is in CONTAINER TRACKING section.

                    v1.5+ future:
                    If FESCO provides per-container events, compute:
                      - containerSignal per container
                      - orderSignal = worst child container signal
                        priority: red > blue > yellow > green > gray
                    Do NOT use segments[*].containers as per-container event data —
                    those are service/rate rows, not actual container movements.
                  */
                })()}

                {/* ── Container Tracking Summary ── */}
                <div className="detail-card">
                  <div className="detail-title">
                    CONTAINER TRACKING
                    {containerTracking.length > 0 && (
                      <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--ink-4)' }}>
                        ({containerTracking.length})
                      </span>
                    )}
                  </div>

                  {trackingLoading && (
                    <div className="detail-empty">Loading container tracking…</div>
                  )}

                  {trackingError && !trackingLoading && (
                    <div className="detail-empty" style={{ color: '#dc2626' }}>
                      Unable to load container tracking.
                    </div>
                  )}

                  {!trackingLoading && !trackingError && containerTracking.length === 0 && (
                    <div className="detail-empty">Container tracking has not been synced yet.</div>
                  )}

                  {!trackingLoading && containerTracking.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[...containerTracking]
                        .sort((a, b) =>
                          (ALERT_SORT[a.alert_level ?? 'gray'] ?? 3) -
                          (ALERT_SORT[b.alert_level ?? 'gray'] ?? 3) ||
                          a.container_number.localeCompare(b.container_number),
                        )
                        .map(tr => {
                          const alertInfo   = ALERT_DISPLAY[tr.alert_level ?? 'gray'] ?? ALERT_DISPLAY.gray
                          const statusLabel = STATUS_LABELS[tr.status ?? ''] ?? (tr.status ?? '—')
                          const route       = [tr.current_from, tr.current_to].filter(Boolean).join(' → ')
                          const segType     = tr.current_segment_type ?? ''
                          const staleState  = getStaleState(tr)
                          const staleInfo   = staleState !== 'fresh' ? STALE_DISPLAY[staleState] : null
                          const staleExpanded = expandedStaleCtr === tr.container_number

                          return (
                            <div
                              key={tr.container_number}
                              className="rounded-lg border p-3"
                              style={{ background: alertInfo.bg, borderColor: alertInfo.border }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span className="text-sm font-semibold" style={{ color: 'var(--ink)', fontFamily: 'monospace' }}>
                                  {tr.container_number}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {staleInfo && (
                                    <button
                                      onClick={() => setExpandedStaleCtr(staleExpanded ? null : tr.container_number)}
                                      className="text-xs font-medium px-1.5 py-0.5 rounded"
                                      style={{ background: staleInfo.bg, color: staleInfo.color, border: `1px solid ${staleInfo.border}`, cursor: 'pointer' }}
                                    >
                                      {staleLabel(staleInfo, tr.last_success_at)}
                                    </button>
                                  )}
                                  <span className="text-xs font-semibold" style={{ color: alertInfo.color }}>
                                    {alertInfo.label}
                                  </span>
                                </div>
                              </div>

                              <div className="text-xs" style={{ color: 'var(--ink-2)', marginBottom: 3 }}>
                                {statusLabel}
                                {segType ? ` · ${segType}` : ''}
                                {route   ? ` · ${route}`   : ''}
                              </div>

                              {tr.last_event_location && (
                                <div className="text-xs" style={{ color: 'var(--ink-2)', marginBottom: 3 }}>
                                  📍 {tr.last_event_location}
                                </div>
                              )}

                              {(tr.departure_date || tr.planned_departure_date || tr.destination_date || tr.planned_destination_date) && (
                                <div className="text-xs" style={{ color: 'var(--ink-4)', marginBottom: 3 }}>
                                  {tr.departure_date
                                    ? `Departed ${fmtDate(tr.departure_date)}`
                                    : tr.planned_departure_date
                                    ? `Planned dep ${fmtDate(tr.planned_departure_date)}`
                                    : null}
                                  {(tr.destination_date || tr.planned_destination_date) &&
                                   (tr.departure_date   || tr.planned_departure_date)
                                    ? '  ·  ' : null}
                                  {tr.destination_date
                                    ? `Arrived ${fmtDate(tr.destination_date)}`
                                    : tr.planned_destination_date
                                    ? `Planned arr ${fmtDate(tr.planned_destination_date)}`
                                    : null}
                                </div>
                              )}

                              {tr.alert_reason && (
                                <div className="text-xs" style={{ color: alertInfo.color, marginBottom: 3 }}>
                                  {tr.alert_reason}
                                </div>
                              )}

                              {tr.last_checked_at && (
                                <div className="text-xs" style={{ color: 'var(--ink-4)' }}>
                                  Checked {relativeTime(tr.last_checked_at)}
                                </div>
                              )}

                              {staleInfo && staleExpanded && (
                                <div
                                  className="text-xs rounded"
                                  style={{ marginTop: 6, padding: '6px 8px', background: 'var(--side-row)', border: `1px solid ${staleInfo.border}`, color: 'var(--ink-2)', lineHeight: 1.6 }}
                                >
                                  <div style={{ fontWeight: 600, color: staleInfo.color, marginBottom: 2 }}>Tracking data is stale</div>
                                  <div>
                                    Last refreshed:{' '}
                                    <span style={{ color: 'var(--ink)' }}>
                                      {tr.last_success_at ? relativeTime(tr.last_success_at) : 'Never refreshed'}
                                    </span>
                                  </div>
                                  {tr.last_error_message && (
                                    <div>
                                      Last error:{' '}
                                      <span style={{ color: '#dc2626' }}>{tr.last_error_message}</span>
                                      {tr.last_error_at && (
                                        <span style={{ color: 'var(--ink-4)' }}> · {relativeTime(tr.last_error_at)}</span>
                                      )}
                                    </div>
                                  )}
                                  <div>
                                    Consecutive errors:{' '}
                                    <span style={{ color: 'var(--ink)' }}>{tr.consecutive_errors ?? 0}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>

                {/* B/L Numbers */}
                {(() => {
                  const bills: string[] = Array.isArray(detail.bills) ? detail.bills : []

                  return (
                    <div className="detail-card">
                      <div className="detail-title">B/L Numbers ({bills.length})</div>

                      {bills.length > 0 ? (
                        <div className="bill-list">
                          {bills.map(bl => (
                            <div key={bl} className="bill-row">{bl}</div>
                          ))}
                        </div>
                      ) : (
                        <div className="detail-empty">No bills</div>
                      )}
                    </div>
                  )
                })()}

                {/* Segments */}
                {(() => {
                  type SegmentService = {
                    key:           string
                    serviceName:   string
                    containerName: string
                    price:         string
                    main:          boolean
                  }

                  type FormattedSegment = {
                    key:       string
                    order:     number
                    mode:      string
                    from:      string
                    to:        string
                    countryTo: string
                    services:  SegmentService[]
                  }

                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const segments: any[] = Array.isArray(detail.segments) ? detail.segments : []

                  const formatted: FormattedSegment[] = [...segments]
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .sort((a: any, b: any) => (a?.segmentOrder ?? 0) - (b?.segmentOrder ?? 0))
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map((s: any, idx: number) => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const serviceRows: any[] = Array.isArray(s?.containers) ? s.containers : []

                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const services: SegmentService[] = serviceRows.map((sv: any, j: number) => ({
                        key:           `${idx}-${j}-${sv?.UUID || sv?.RateNumber || 'service'}`,
                        serviceName:   sv?.ServiceNameEng || sv?.ServiceName || '—',
                        containerName: sv?.ContainerNameEng || sv?.ContainerName || '—',
                        price:         (sv?.Price !== undefined && sv?.Currency)
                                         ? `${sv.Price} ${sv.Currency}`
                                         : '—',
                        main:          Boolean(sv?.MainService),
                      }))

                      services.sort((a, b) => Number(b.main) - Number(a.main))

                      return {
                        key:       `${idx}-${s?.segmentOrder ?? 'seg'}-${s?.LocUidTo || s?.locNameLatinTo || 'to'}`,
                        order:     s?.segmentOrder ?? idx + 1,
                        mode:      s?.rstCode || '—',
                        from:      s?.locNameLatinFrom || '—',
                        to:        s?.locNameLatinTo || '—',
                        countryTo: (s?.locAdditionalNameLatinTo || '').split(',').pop()?.trim() || '',
                        services,
                      }
                    })

                  return (
                    <div className="detail-card">
                      <div className="detail-title">SEGMENTS ({formatted.length})</div>

                      {formatted.length > 0 ? (
                        <div className="segment-list">
                          {formatted.map(seg => (
                            <div key={seg.key} className="segment-row">
                              <div className="segment-head">
                                <span className="segment-order">#{seg.order}</span>
                                <span className="segment-mode">{seg.mode}</span>
                                <span className="segment-route">
                                  {seg.from} → {seg.to}
                                  {seg.countryTo ? (
                                    <span className="segment-country"> · {seg.countryTo}</span>
                                  ) : null}
                                </span>
                              </div>

                              {seg.services.length > 0 ? (
                                <div className="segment-services">
                                  {seg.services.map(sv => (
                                    <div key={sv.key} className="segment-service-row">
                                      <span className="segment-service-name">
                                        {sv.serviceName}
                                        {sv.main ? <span className="segment-badge">MAIN</span> : null}
                                      </span>
                                      <span className="segment-service-meta">
                                        <span>{sv.containerName}</span>
                                        <span className="segment-price">{sv.price}</span>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="detail-empty">No service/rate rows</div>
                              )}
                            </div>
                          ))}

                          <details className="segment-raw">
                            <summary>Show raw segment JSON</summary>
                            <pre>{JSON.stringify(detail.segments, null, 2)}</pre>
                          </details>
                        </div>
                      ) : (
                        <div className="detail-empty">No segment data</div>
                      )}
                    </div>
                  )
                })()}

                {/* Tracking */}
                {(() => {
                  const trackingItems: Record<string, unknown>[] = Array.isArray(detail.tracking) ? detail.tracking : []
                  const containers: string[] = Array.isArray(detail.containers) ? detail.containers : []
                  const countMatch = trackingItems.length > 0 && containers.length === trackingItems.length
                  const KNOWN_TRACKING_KEYS = new Set(['departureDate', 'departure_date', 'destinationDate', 'destination_date', 'vote'])

                  const fmtDateLegacy = (v: unknown): string => {
                    if (v === null || v === undefined || v === '') return '—'
                    const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/)
                    return m ? m[1] : String(v)
                  }

                  const fmtVote = (v: unknown): string => {
                    if (v === true  || v === 'true'  || v === 1) return 'Yes'
                    if (v === false || v === 'false' || v === 0) return 'No'
                    if (v === undefined || v === null) return '—'
                    return String(v)
                  }

                  return (
                    <div className="detail-card">
                      <div className="detail-title">TRACKING ({trackingItems.length})</div>
                      {trackingItems.length === 0 ? (
                        <div className="detail-empty">No tracking data</div>
                      ) : (
                        <>
                          <div className="tracking-list">
                            {trackingItems.map((t, i) => {
                              const dep  = t?.departureDate  ?? t?.departure_date  ?? null
                              const dest = t?.destinationDate ?? t?.destination_date ?? null
                              const unknownEntries = Object.entries(t ?? {}).filter(([k]) => !KNOWN_TRACKING_KEYS.has(k))
                              const rowLabel = countMatch
                                ? `#${i + 1} ${containers[i]}`
                                : `Tracking item #${i + 1}`
                              return (
                                <div key={i} className="tracking-row">
                                  <div className="tracking-row-head">{rowLabel}</div>
                                  <div className="tracking-fields">
                                    <div className="tracking-field">
                                      <span className="tracking-label">Departure</span>
                                      <span className="tracking-value">{fmtDateLegacy(dep)}</span>
                                    </div>
                                    <div className="tracking-field">
                                      <span className="tracking-label">Destination</span>
                                      <span className="tracking-value">{fmtDateLegacy(dest)}</span>
                                    </div>
                                    <div className="tracking-field">
                                      <span className="tracking-label">Vote</span>
                                      <span className="tracking-value">{fmtVote(t?.vote)}</span>
                                    </div>
                                  </div>
                                  {unknownEntries.length > 0 && (
                                    <details className="segment-raw">
                                      <summary>Show extra fields ({unknownEntries.length})</summary>
                                      <pre>{JSON.stringify(Object.fromEntries(unknownEntries), null, 2)}</pre>
                                    </details>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          {countMatch && (
                            <div className="tracking-match-note">
                              Tracking items appear to match containers by order.
                            </div>
                          )}
                          <details className="segment-raw">
                            <summary>Show raw tracking JSON</summary>
                            <pre>{JSON.stringify(detail.tracking, null, 2)}</pre>
                          </details>
                        </>
                      )}
                    </div>
                  )
                })()}

              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
