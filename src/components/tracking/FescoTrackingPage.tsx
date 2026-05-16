import { useState, useEffect, useCallback } from 'react'
import {
  getFescoSignal,
  translateFescoStatusText,
  SIGNAL_COLOR,
} from '../../lib/fescoSignal'

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

/* ── Constants ────────────────────────────────────────────────────── */
const STATUS_TABS = ['All', 'ACTIVE', 'REJECTED'] as const
type StatusTab = typeof STATUS_TABS[number]

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ACTIVE:   { bg: 'rgba(20,184,166,0.12)', color: '#0d9488' },
  REJECTED: { bg: 'rgba(220,38,38,0.10)', color: '#dc2626' },
}

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

const val = (v: string | null | undefined) => v?.trim() || '—'

const PAGE_SIZE = 50

/* ── Detail panel helper ─────────────────────────────────────────── */
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b last:border-0" style={{ borderColor: 'var(--line)' }}>
      <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>{label}</span>
      <span className="text-sm break-words" style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────────── */
export function FescoTrackingPage() {
  /* list state */
  const [searchInput, setSearchInput] = useState('')
  const [q,           setQ]           = useState('')
  const [statusTab,   setStatusTab]   = useState<StatusTab>('All')
  const [orders,      setOrders]      = useState<FescoOrder[]>([])
  const [total,       setTotal]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [refreshKey,  setRefreshKey]  = useState(0)

  /* detail state */
  const [selectedId,    setSelectedId]    = useState<number | null>(null)
  const [detail,        setDetail]        = useState<FescoOrderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError,   setDetailError]   = useState<string | null>(null)

  /* fetch list */
  const fetchOrders = useCallback(async (query: string, status: StatusTab) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: '0' })
      if (query)            params.set('q',      query)
      if (status !== 'All') params.set('status', status)
      const res  = await fetch(`/api/fesco/orders?${params}`)
      const json = await res.json() as OrdersResponse
      if (!json.ok) throw new Error(json.error ?? 'Failed to load bookings')
      setOrders(json.data)
      setTotal(json.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders(q, statusTab)
  }, [q, statusTab, fetchOrders, refreshKey])

  /* fetch detail */
  const fetchDetail = useCallback(async (id: number) => {
    setDetailLoading(true)
    setDetailError(null)
    setDetail(null)
    try {
      const res  = await fetch(`/api/fesco/order?id=${id}`)
      const json = await res.json() as DetailResponse
      if (!json.ok) throw new Error(json.error ?? 'Failed to load order detail')
      setDetail(json.data ?? null)
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : String(e))
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const handleCardClick = (id: number) => {
    if (id === selectedId) {
      setSelectedId(null)
      setDetail(null)
      setDetailError(null)
    } else {
      setSelectedId(id)
      fetchDetail(id)
    }
  }

  const handleSearch  = () => setQ(searchInput.trim())
  const handleRefresh = () => setRefreshKey(k => k + 1)
  const handleClose   = () => { setSelectedId(null); setDetail(null); setDetailError(null) }

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className="fesco-bookings-shell flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--chat-bg)' }}>

      {/* Header */}
      <div className="fesco-header flex-shrink-0 flex items-start justify-between">
        <div>
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
            placeholder="Search by booking #, route, client, manager…"
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
          {!loading && !error && orders.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-20 text-sm"
              style={{ color: 'var(--ink-4)' }}
            >
              <div className="text-3xl mb-3">📭</div>
              <div className="font-medium">No bookings found</div>
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
          {!loading && orders.length > 0 && (
            <div>
              {orders.map(order => {
                const isSelected     = order.id === selectedId
                const containers     = order.containers ?? []
                const containerCount = containers.length
                const { signal, region, elapsedDays } = getFescoSignal(order)
                const color          = SIGNAL_COLOR[signal]
                const statusStr      = (order.status ?? '').toLowerCase()
                const pillClass      = statusStr === 'active'   ? 'active'
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
                  </button>
                )
              })}
            </div>
          )}

          {/* Pagination hint */}
          {!loading && total > orders.length && (
            <div className="text-center text-xs py-5" style={{ color: 'var(--ink-4)' }}>
              Showing {orders.length.toLocaleString()} of {total.toLocaleString()} bookings
            </div>
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

                {/* Containers */}
                {(() => {
                  const { signal: cSig } = getFescoSignal(detail)
                  const cColor = SIGNAL_COLOR[cSig]
                  const containers: string[] = Array.isArray(detail.containers) ? detail.containers : []

                  return (
                    <div className="detail-card">
                      <div className="detail-title">CONTAINERS ({containers.length})</div>

                      {containers.length > 0 ? (
                        <div className="container-list">
                          {containers.map(containerNo => (
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
                          ))}
                        </div>
                      ) : (
                        <div className="detail-empty">No containers</div>
                      )}
                    </div>
                  )
                  /*
                    v1.1 NOTE:
                    Containers are actual container numbers (text[]), but signal is still order-level.

                    v1.5 future:
                    If FESCO provides per-container events, compute:
                      - containerSignal per container
                      - orderSignal = worst child container signal
                        priority: red > blue > yellow > green > gray
                    Then replace "Order signal applied" with actual per-container signal.
                    Do NOT use segments[*].containers as per-container event data —
                    those are service/rate rows, not actual container movements.
                  */
                })()}

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
                    key:      string
                    order:    number
                    mode:     string
                    from:     string
                    to:       string
                    countryTo: string
                    services: SegmentService[]
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

                  const fmtDate = (val: unknown): string => {
                    if (val === null || val === undefined || val === '') return '—'
                    const m = String(val).match(/^(\d{4}-\d{2}-\d{2})/)
                    return m ? m[1] : String(val)
                  }

                  const fmtVote = (val: unknown): string => {
                    if (val === true  || val === 'true'  || val === 1) return 'Yes'
                    if (val === false || val === 'false' || val === 0) return 'No'
                    if (val === undefined || val === null) return '—'
                    return String(val)
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
                                      <span className="tracking-value">{fmtDate(dep)}</span>
                                    </div>
                                    <div className="tracking-field">
                                      <span className="tracking-label">Destination</span>
                                      <span className="tracking-value">{fmtDate(dest)}</span>
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
