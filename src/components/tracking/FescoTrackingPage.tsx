import { useState, useEffect, useCallback } from 'react'

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

interface OrdersResponse {
  ok:     boolean
  total:  number
  limit:  number
  offset: number
  data:   FescoOrder[]
  error?: string
}

const STATUS_TABS = ['All', 'ACTIVE', 'REJECTED'] as const
type StatusTab = typeof STATUS_TABS[number]

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ACTIVE:   { bg: 'rgba(20,184,166,0.12)',   color: '#0d9488' },
  REJECTED: { bg: 'rgba(220,38,38,0.10)',    color: '#dc2626' },
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

const PAGE_SIZE = 50

export function FescoTrackingPage() {
  const [searchInput,  setSearchInput]  = useState('')
  const [q,            setQ]            = useState('')
  const [statusTab,    setStatusTab]    = useState<StatusTab>('All')
  const [orders,       setOrders]       = useState<FescoOrder[]>([])
  const [total,        setTotal]        = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [refreshKey,   setRefreshKey]   = useState(0)

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

  const handleSearch  = () => setQ(searchInput.trim())
  const handleRefresh = () => setRefreshKey(k => k + 1)

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
        {/* Search */}
        <div className="flex gap-2 flex-1 min-w-0">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search by booking #, route, client, manager…"
            className="flex-1 min-w-0 px-3 py-1.5 rounded-lg text-sm outline-none border transition-colors"
            style={{
              background:  'var(--card)',
              borderColor: 'var(--line)',
              color:       'var(--ink)',
            }}
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

        {/* Status filter pills */}
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">

        {/* Error */}
        {error && (
          <div
            className="rounded-xl border p-4 mb-4 text-sm"
            style={{
              background:  'rgba(220,38,38,0.06)',
              borderColor: 'rgba(220,38,38,0.25)',
              color:       '#dc2626',
            }}
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
                style={{
                  background:  'var(--card)',
                  borderColor: 'var(--line)',
                  height:      84,
                }}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
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
              const label      = order.external_1c_number ?? `FESCO-${order.id}`
              const containers = order.containers ?? []
              const { bg, color } = getStatusStyle(order.status)
              const preview    = containers.slice(0, 3)
              const extra      = containers.length - preview.length

              return (
                <div
                  key={order.id}
                  className="rounded-xl border p-4"
                  style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
                >
                  {/* Top row: booking label + status + synced time */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className="font-mono text-sm font-semibold"
                          style={{ color: 'var(--ink)' }}
                        >
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
                            {order.external_1c_status}
                          </span>
                        )}
                      </div>

                      {/* Route */}
                      <div
                        className="text-sm truncate"
                        style={{ color: 'var(--ink-3)' }}
                        title={order.route_latin ?? undefined}
                      >
                        {order.route_latin ?? '—'}
                      </div>
                    </div>

                    {/* Synced time */}
                    <div
                      className="text-xs flex-shrink-0 pt-0.5"
                      style={{ color: 'var(--ink-4)' }}
                      title={order.last_synced_at ?? undefined}
                    >
                      {relativeTime(order.last_synced_at)}
                    </div>
                  </div>

                  {/* Bottom row: containers + manager */}
                  <div
                    className="mt-2 flex items-center flex-wrap gap-x-3 gap-y-1 text-xs"
                    style={{ color: 'var(--ink-4)' }}
                  >
                    {containers.length > 0 ? (
                      <span>
                        <span style={{ color: 'var(--ink-3)' }}>
                          {containers.length} ctr:
                        </span>{' '}
                        <span className="font-mono">
                          {preview.join(' · ')}
                          {extra > 0 && (
                            <span style={{ color: 'var(--ink-4)' }}> +{extra}</span>
                          )}
                        </span>
                      </span>
                    ) : (
                      <span>No containers</span>
                    )}

                    {order.manager && (
                      <span
                        className="ml-auto truncate"
                        style={{ color: 'var(--ink-4)', maxWidth: 180 }}
                        title={order.manager}
                      >
                        {order.manager}
                      </span>
                    )}
                  </div>
                </div>
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
    </div>
  )
}
