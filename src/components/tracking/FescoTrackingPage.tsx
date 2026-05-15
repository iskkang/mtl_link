import { useState, useEffect, useCallback } from 'react'
import { translateFescoStatus } from '../../lib/fesco-status'

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
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--chat-bg)' }}>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: 'var(--line)' }}
      >
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
            FESCO Bookings
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ink-4)' }}>
            {loading ? 'Loading…' : `${total.toLocaleString()} bookings synced from FESCO LK`}
          </p>
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

        {/* ── List column ── */}
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
            <div className="space-y-2">
              {orders.map(order => {
                const isSelected = order.id === selectedId
                const label      = order.external_1c_number ?? `FESCO-${order.id}`
                const containers = order.containers ?? []
                const preview    = containers.slice(0, 3)
                const extra      = containers.length - preview.length
                const { bg, color } = getStatusStyle(order.status)

                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => handleCardClick(order.id)}
                    className="w-full text-left rounded-xl border p-4 transition-colors"
                    style={{
                      background:  isSelected ? 'rgba(13,148,136,0.08)' : 'var(--card)',
                      borderColor: isSelected ? '#0d9488'               : 'var(--line)',
                      outline:     'none',
                    }}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                            {label}
                          </span>
                          <span
                            className="px-1.5 py-0.5 rounded text-xs font-medium"
                            style={{ background: bg, color }}
                          >
                            {order.status ?? '—'}
                          </span>
                          {order.external_1c_status && (
                            <span className="text-xs" style={{ color: 'var(--ink-4)' }}>
                              {translateFescoStatus(order.external_1c_status)}
                            </span>
                          )}
                        </div>
                        <div
                          className="text-sm truncate"
                          style={{ color: 'var(--ink-3)' }}
                          title={order.route_latin ?? undefined}
                        >
                          {order.route_latin ?? '—'}
                        </div>
                      </div>
                      <div
                        className="text-xs flex-shrink-0 pt-0.5"
                        style={{ color: 'var(--ink-4)' }}
                        title={order.last_synced_at ?? undefined}
                      >
                        {relativeTime(order.last_synced_at)}
                      </div>
                    </div>

                    {/* Bottom row */}
                    <div
                      className="mt-2 flex items-center flex-wrap gap-x-3 gap-y-1 text-xs"
                      style={{ color: 'var(--ink-4)' }}
                    >
                      {containers.length > 0 ? (
                        <span>
                          <span style={{ color: 'var(--ink-3)' }}>{containers.length} ctr:</span>{' '}
                          <span className="font-mono">
                            {preview.join(' · ')}
                            {extra > 0 && <span style={{ color: 'var(--ink-4)' }}> +{extra}</span>}
                          </span>
                        </span>
                      ) : (
                        <span>No containers</span>
                      )}
                      {order.manager && (
                        <span
                          className="ml-auto truncate"
                          style={{ color: 'var(--ink-4)', maxWidth: 160 }}
                          title={order.manager}
                        >
                          {order.manager}
                        </span>
                      )}
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
              <div className="px-6 py-4 space-y-5">

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
                        <span className="text-xs" style={{ color: 'var(--ink-4)' }}>
                          {translateFescoStatus(detail.external_1c_status)}
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
                <section
                  className="rounded-xl border p-4"
                  style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
                >
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ink-4)' }}>
                    Containers ({(detail.containers ?? []).length})
                  </h3>
                  {(detail.containers ?? []).length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--ink-4)' }}>No containers</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(detail.containers ?? []).map(c => (
                        <span
                          key={c}
                          className="font-mono text-xs px-2 py-1 rounded"
                          style={{ background: 'var(--side-row)', color: 'var(--ink-3)' }}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </section>

                {/* Bills */}
                <section
                  className="rounded-xl border p-4"
                  style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
                >
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ink-4)' }}>
                    Bills of Lading ({(detail.bills ?? []).length})
                  </h3>
                  {(detail.bills ?? []).length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--ink-4)' }}>No bills</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(detail.bills ?? []).map(b => (
                        <span
                          key={b}
                          className="font-mono text-xs px-2 py-1 rounded"
                          style={{ background: 'var(--side-row)', color: 'var(--ink-3)' }}
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  )}
                </section>

                {/* Segments */}
                <section
                  className="rounded-xl border p-4"
                  style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
                >
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ink-4)' }}>
                    Segments ({(detail.segments ?? []).length})
                  </h3>
                  {(detail.segments ?? []).length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--ink-4)' }}>No segment data</p>
                  ) : (
                    <div className="space-y-2">
                      {(detail.segments ?? []).map((s, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-sm"
                        >
                          {s.type && (
                            <span
                              className="font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                              style={{ background: 'var(--side-row)', color: 'var(--ink-3)' }}
                            >
                              {String(s.type).toUpperCase()}
                            </span>
                          )}
                          <span style={{ color: 'var(--ink)' }}>
                            {s.from && s.to ? `${s.from} → ${s.to}` : JSON.stringify(s)}
                          </span>
                          {s.status && (
                            <span className="ml-auto text-xs flex-shrink-0" style={{ color: 'var(--ink-4)' }}>
                              {translateFescoStatus(s.status)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Tracking */}
                <section
                  className="rounded-xl border p-4"
                  style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
                >
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ink-4)' }}>
                    Tracking ({(detail.tracking ?? []).length})
                  </h3>
                  {(detail.tracking ?? []).length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--ink-4)' }}>No tracking data</p>
                  ) : (
                    <div className="space-y-2">
                      {(detail.tracking ?? []).map((t, i) => (
                        <div key={i} className="text-xs font-mono p-2 rounded" style={{ background: 'var(--side-row)', color: 'var(--ink-3)' }}>
                          {JSON.stringify(t)}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
