import { useState, useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { useTranslation } from 'react-i18next'

export interface ContainerPoint {
  containerNumber: string
  latitude:        number
  longitude:       number
  signal:          'red' | 'yellow' | 'green' | 'gray'
}

export interface ContainerPopupData {
  signal:                   'red' | 'yellow' | 'green' | 'gray'
  current_from:             string | null
  current_to:               string | null
  last_event_location:      string | null
  last_success_at:          string | null
  planned_destination_date: string | null
  alert_reason:             string | null
}

interface ContainerMapProps {
  containers:           ContainerPoint[]
  allContainerNumbers?: string[]
  containerDetails?:    Record<string, ContainerPopupData>
  onSelectContainers?:  (containerNumbers: string[]) => void
  onClearSelection?:    () => void
}

const TOKEN = import.meta.env.MAPBOX_ACCESS_TOKEN as string | undefined

const SIG_COLOR: Record<string, string> = {
  red:    '#dc2626',
  yellow: '#d97706',
  green:  '#0d9488',
  gray:   '#94a3b8',
}

/* ── Popup style injection (once per page) ──────────────────────────── */
let popupStyleInjected = false
function ensurePopupStyles() {
  if (popupStyleInjected) return
  popupStyleInjected = true
  const el = document.createElement('style')
  el.textContent = `
    .container-popup .mapboxgl-popup-content {
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      border: 1px solid #e2e8f0;
    }
    .container-popup .mapboxgl-popup-close-button {
      font-size: 16px;
      color: #94a3b8;
      padding: 4px 8px;
      line-height: 1;
      border-radius: 0 12px 0 0;
    }
  `
  document.head.appendChild(el)
}

/* ── Popup HTML builder ─────────────────────────────────────────────── */
function buildPopupHtml(
  cn:     string,
  detail: ContainerPopupData | undefined,
  i18n:   { route: string; lastEvent: string; eta: string; openInFesco: string },
): string {
  const sig = detail?.signal ?? 'gray'
  const dotColor =
    sig === 'red'    ? '#dc2626' :
    sig === 'yellow' ? '#d97706' :
    sig === 'green'  ? '#0d9488' : '#94a3b8'

  const fmtDate = (iso: string | null): string => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const route     = detail ? `${detail.current_from ?? '—'} → ${detail.current_to ?? '—'}` : '—'
  const lastEvent = detail?.last_event_location ?? '—'
  const lastDate  = detail?.last_success_at ?? null
  const eta       = detail?.planned_destination_date ?? null
  const alert     = detail?.alert_reason ?? null

  const etaHtml = eta ? `
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid #f1f5f9">
      <div style="font-size:10px;color:#94a3b8;margin-bottom:3px">${i18n.eta}</div>
      <div style="font-size:12px;color:#1e293b">${fmtDate(eta)}</div>
    </div>` : ''

  const alertHtml = (alert && sig !== 'green' && sig !== 'gray') ? `
    <div style="margin-top:8px;padding:4px 8px;border-radius:4px;background:#f8fafc;font-size:11px;color:#475569">
      ${alert}
    </div>` : ''

  return `
    <div style="font-family:var(--font-body,system-ui,sans-serif);min-width:240px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="width:10px;height:10px;border-radius:50%;background:${dotColor};flex-shrink:0"></span>
        <span style="font-weight:600;font-size:13px;color:#1e293b;font-family:var(--font-mono,monospace)">${cn}</span>
        <a href="https://my.fesco.com/tracking?tab=${cn}" target="_blank" rel="noopener noreferrer"
           style="margin-left:auto;font-size:11px;color:#0d9488;text-decoration:underline;white-space:nowrap">
          ${i18n.openInFesco} ↗
        </a>
      </div>
      <div style="font-size:10px;color:#94a3b8;margin-bottom:3px">${i18n.route}</div>
      <div style="font-size:12px;color:#1e293b;margin-bottom:10px">${route}</div>
      <div style="font-size:10px;color:#94a3b8;margin-bottom:3px">${i18n.lastEvent}</div>
      <div style="font-size:12px;color:#1e293b">
        ${lastEvent}
        ${lastDate ? `<span style="font-size:10px;color:#94a3b8;margin-left:4px">· ${fmtDate(lastDate)}</span>` : ''}
      </div>
      ${etaHtml}
      ${alertHtml}
    </div>
  `
}

/* ── Reset-view custom control ──────────────────────────────────────── */
class ResetViewControl implements mapboxgl.IControl {
  private _container?: HTMLDivElement
  constructor(private onReset: () => void) {}

  onAdd(map: mapboxgl.Map): HTMLElement {
    this._container = document.createElement('div')
    this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group'
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'mapboxgl-ctrl-icon'
    btn.setAttribute('aria-label', 'Reset view')
    btn.title = 'Reset view'
    btn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>'
    btn.addEventListener('click', () => {
      map.flyTo({ center: [80, 55], zoom: 4, duration: 800 })
      this.onReset()
    })
    this._container.appendChild(btn)
    return this._container
  }

  onRemove(): void {
    this._container?.parentNode?.removeChild(this._container)
  }

  getDefaultPosition(): mapboxgl.ControlPosition {
    return 'top-right'
  }
}

/* ── Search overlay ─────────────────────────────────────────────────── */
function SearchOverlay({
  containers,
  allContainerNumbers,
  onSearchHit,
  onSearchClear,
  mapRef,
}: {
  containers:          ContainerPoint[]
  allContainerNumbers: string[]
  onSearchHit:         (containerNumber: string, lng: number, lat: number) => void
  onSearchClear:       () => void
  mapRef:              { current: mapboxgl.Map | null }
}) {
  const { t } = useTranslation()
  const [query,  setQuery]  = useState('')
  const [flash,  setFlash]  = useState<'idle' | 'ok' | 'error' | 'warn'>('idle')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const doSearch = () => {
    const q = query.trim().toUpperCase()
    if (!q) return
    const point = containers.find(c => c.containerNumber === q)
    if (point) {
      mapRef.current?.flyTo({ center: [point.longitude, point.latitude], zoom: 8, duration: 1200 })
      onSearchHit(q, point.longitude, point.latitude)
      setErrMsg(null)
      setFlash('ok')
      setTimeout(() => setFlash('idle'), 600)
      return
    }
    if (allContainerNumbers.includes(q)) {
      setErrMsg(t('tracking.containerNoLocation'))
      setFlash('warn')
      return
    }
    setErrMsg(t('tracking.containerNotFound'))
    setFlash('error')
  }

  const handleClear = () => {
    setQuery('')
    setFlash('idle')
    setErrMsg(null)
    onSearchClear()
  }

  const shadowColor =
    flash === 'ok'    ? 'rgba(13,148,136,0.5)' :
    flash === 'error' ? 'rgba(220,38,38,0.4)'  :
    flash === 'warn'  ? 'rgba(217,119,6,0.4)'  :
    'rgba(0,0,0,0.1)'

  return (
    <div style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 10, width: 224, fontFamily: 'var(--font-body, sans-serif)' }}>
      <div
        className="mapboxgl-ctrl mapboxgl-ctrl-group"
        style={{ display: 'flex', alignItems: 'center', padding: '0 4px 0 8px', gap: 2,
                 boxShadow: `0 0 0 2px ${shadowColor}`, transition: 'box-shadow 0.25s' }}
      >
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value.toUpperCase()); setFlash('idle'); setErrMsg(null) }}
          onKeyDown={e => { if (e.key === 'Enter') doSearch() }}
          placeholder={t('tracking.searchContainerPlaceholder')}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 11, fontFamily: 'var(--font-mono, monospace)',
            color: '#374151', padding: '7px 0', minWidth: 0,
          }}
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear"
            style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', lineHeight: 1, fontSize: 15 }}
          >×</button>
        )}
        <button
          type="button"
          onClick={doSearch}
          aria-label="Search"
          style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
        </button>
      </div>
      {errMsg && (
        <div style={{
          marginTop: 4, background: '#ffffff', borderRadius: 4, padding: '4px 8px',
          fontSize: 10, color: flash === 'warn' ? '#d97706' : '#dc2626',
          boxShadow: '0 0 0 2px rgba(0,0,0,0.08)',
        }}>
          {errMsg}
        </div>
      )}
    </div>
  )
}

/* ── Component ──────────────────────────────────────────────────────── */
export function ContainerMap({
  containers,
  allContainerNumbers = [],
  containerDetails = {},
  onSelectContainers,
  onClearSelection,
}: ContainerMapProps) {
  const { t }         = useTranslation()
  const containerRef  = useRef<HTMLDivElement>(null)
  const mapRef        = useRef<mapboxgl.Map | null>(null)
  const initialized   = useRef(false)
  const popupRef      = useRef<mapboxgl.Popup | null>(null)

  /* Stable refs so event handlers never capture stale props */
  const selectRef  = useRef(onSelectContainers)
  const clearRef   = useRef(onClearSelection)
  const tRef       = useRef(t)
  const detailsRef = useRef(containerDetails)
  useEffect(() => { selectRef.current  = onSelectContainers }, [onSelectContainers])
  useEffect(() => { clearRef.current   = onClearSelection  }, [onClearSelection])
  useEffect(() => { tRef.current       = t                 }, [t])
  useEffect(() => { detailsRef.current = containerDetails  }, [containerDetails])

  /* show/clear search highlight — updated once, refs stable, body reads refs */
  const showSearchRef  = useRef((_cn: string, _lng: number, _lat: number) => {})
  const clearSearchRef = useRef(() => {})

  useEffect(() => {
    showSearchRef.current = (cn: string, lng: number, lat: number) => {
      const map = mapRef.current
      if (!map || !map.isStyleLoaded()) return
      const src = map.getSource('searched-container') as mapboxgl.GeoJSONSource | undefined
      if (!src) return
      const detail = detailsRef.current[cn]
      src.setData({
        type: 'FeatureCollection',
        features: [{
          type:     'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: { containerNumber: cn, signal: detail?.signal ?? 'gray' },
        }],
      })
      popupRef.current?.remove()
      const ti = tRef.current
      popupRef.current = new mapboxgl.Popup({
        anchor: 'bottom', offset: 30, closeButton: true, maxWidth: '320px', className: 'container-popup',
      })
        .setLngLat([lng, lat])
        .setHTML(buildPopupHtml(cn, detail, {
          route:        ti('tracking.route'),
          lastEvent:    ti('tracking.lastEvent'),
          eta:          ti('tracking.eta'),
          openInFesco:  ti('tracking.openInFesco'),
        }))
        .addTo(map)
    }

    clearSearchRef.current = () => {
      const map = mapRef.current
      if (!map || !map.isStyleLoaded()) return
      const src = map.getSource('searched-container') as mapboxgl.GeoJSONSource | undefined
      src?.setData({ type: 'FeatureCollection', features: [] })
      popupRef.current?.remove()
      popupRef.current = null
    }
  }, [])

  /* ── Init map once ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || initialized.current) return
    if (!TOKEN) {
      console.error('[ContainerMap] MAPBOX_ACCESS_TOKEN is not set')
      return
    }

    initialized.current  = true
    mapboxgl.accessToken = TOKEN
    ensurePopupStyles()

    const map = new mapboxgl.Map({
      container:       containerRef.current,
      style:           'mapbox://styles/mapbox/streets-v12',
      center:          [80, 55],
      zoom:            3,
      projection:      'mercator',
      pitchWithRotate: false,
      touchPitch:      false,
    })

    map.keyboard.disable()
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new ResetViewControl(() => {
      clearRef.current?.()
      clearSearchRef.current()
    }), 'top-right')

    mapRef.current = map

    map.on('load', () => {
      addSourceAndLayers(map, containers, selectRef, clearRef, showSearchRef, clearSearchRef)
      fitToContainers(map, containers)
    })

    return () => {
      popupRef.current?.remove()
      popupRef.current  = null
      map.remove()
      mapRef.current    = null
      initialized.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Update GeoJSON when containers change ──────────────────────── */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const src = map.getSource('containers') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    src.setData(toGeoJSON(containers))
    fitToContainers(map, containers)
  }, [containers])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      <SearchOverlay
        containers={containers}
        allContainerNumbers={allContainerNumbers}
        onSearchHit={(cn, lng, lat) => showSearchRef.current(cn, lng, lat)}
        onSearchClear={() => clearSearchRef.current()}
        mapRef={mapRef}
      />

      {containers.length === 0 && (
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.75)',
            fontSize: 12, color: '#6b7280',
            fontFamily: 'var(--font-body, sans-serif)',
            pointerEvents: 'none',
          }}
        >
          No containers in current filter
        </div>
      )}
    </div>
  )
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function toGeoJSON(containers: ContainerPoint[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: containers.map(c => ({
      type:     'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [c.longitude, c.latitude] },
      properties: { containerNumber: c.containerNumber, signal: c.signal },
    })),
  }
}

type CbRef<T> = { current: T | undefined }

function addSourceAndLayers(
  map:            mapboxgl.Map,
  containers:     ContainerPoint[],
  selectRef:      CbRef<(nums: string[]) => void>,
  clearRef:       CbRef<() => void>,
  showSearchRef:  { current: (cn: string, lng: number, lat: number) => void },
  clearSearchRef: { current: () => void },
) {
  /* Main containers source */
  map.addSource('containers', {
    type:          'geojson',
    data:          toGeoJSON(containers),
    cluster:       true,
    clusterRadius: 50,
    clusterProperties: {
      redCount:    ['+', ['case', ['==', ['get', 'signal'], 'red'],    1, 0]],
      yellowCount: ['+', ['case', ['==', ['get', 'signal'], 'yellow'], 1, 0]],
      greenCount:  ['+', ['case', ['==', ['get', 'signal'], 'green'],  1, 0]],
    },
  })

  /* Searched-container source (starts empty, filled on search hit) */
  map.addSource('searched-container', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })

  /* Cluster circles */
  map.addLayer({
    id:     'clusters',
    type:   'circle',
    source: 'containers',
    filter: ['has', 'point_count'],
    paint:  {
      'circle-color': ['case',
        ['>=', ['get', 'redCount'], ['*', 0.5, ['get', 'point_count']]], '#ef4444',
        ['>', ['get', 'redCount'], 0], '#f97316',
        ['>', ['get', 'yellowCount'], 0], '#eab308',
        '#14b8a6',
      ],
      'circle-radius':       ['step', ['get', 'point_count'], 14, 5, 18, 15, 22],
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#ffffff',
      'circle-opacity':      0.85,
    },
  })

  /* Cluster count labels */
  map.addLayer({
    id:     'cluster-count',
    type:   'symbol',
    source: 'containers',
    filter: ['has', 'point_count'],
    layout: {
      'text-field':         '{point_count}',
      'text-font':          ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size':          11,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#ffffff' },
  })

  /* Red count badge — background circle */
  map.addLayer({
    id:     'cluster-red-badge-bg',
    type:   'circle',
    source: 'containers',
    filter: ['all', ['has', 'point_count'], ['>', ['get', 'redCount'], 0]],
    paint:  {
      'circle-color':        '#dc2626',
      'circle-radius':       7,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#ffffff',
      'circle-translate':    [14, -14],
    },
  })

  /* Red count badge — text */
  map.addLayer({
    id:     'cluster-red-badge-text',
    type:   'symbol',
    source: 'containers',
    filter: ['all', ['has', 'point_count'], ['>', ['get', 'redCount'], 0]],
    layout: {
      'text-field':         ['to-string', ['get', 'redCount']],
      'text-font':          ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size':          9,
      'text-allow-overlap': true,
      'text-offset':        [1.4, -1.4],
    },
    paint: { 'text-color': '#ffffff' },
  })

  /* Individual markers */
  map.addLayer({
    id:     'unclustered',
    type:   'circle',
    source: 'containers',
    filter: ['!', ['has', 'point_count']],
    paint:  {
      'circle-color': ['case',
        ['==', ['get', 'signal'], 'red'],    SIG_COLOR.red,
        ['==', ['get', 'signal'], 'yellow'], SIG_COLOR.yellow,
        ['==', ['get', 'signal'], 'gray'],   SIG_COLOR.gray,
        SIG_COLOR.green,
      ],
      'circle-radius':       7,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  })

  /* Searched container — glow ring */
  map.addLayer({
    id:     'searched-glow',
    type:   'circle',
    source: 'searched-container',
    paint:  {
      'circle-color': ['case',
        ['==', ['get', 'signal'], 'red'],    SIG_COLOR.red,
        ['==', ['get', 'signal'], 'yellow'], SIG_COLOR.yellow,
        ['==', ['get', 'signal'], 'green'],  SIG_COLOR.green,
        SIG_COLOR.gray,
      ],
      'circle-radius':  18,
      'circle-opacity': 0.18,
    },
  })

  /* Searched container — main marker */
  map.addLayer({
    id:     'searched-marker',
    type:   'circle',
    source: 'searched-container',
    paint:  {
      'circle-color': ['case',
        ['==', ['get', 'signal'], 'red'],    SIG_COLOR.red,
        ['==', ['get', 'signal'], 'yellow'], SIG_COLOR.yellow,
        ['==', ['get', 'signal'], 'green'],  SIG_COLOR.green,
        SIG_COLOR.gray,
      ],
      'circle-radius':       10,
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#ffffff',
    },
  })

  /* Searched container — container number label */
  map.addLayer({
    id:     'searched-label',
    type:   'symbol',
    source: 'searched-container',
    layout: {
      'text-field':         ['get', 'containerNumber'],
      'text-font':          ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size':          11,
      'text-offset':        [0, 1.8],
      'text-anchor':        'top',
      'text-allow-overlap': true,
    },
    paint: {
      'text-color':       '#1e293b',
      'text-halo-color':  '#ffffff',
      'text-halo-width':  1.5,
    },
  })

  /* Cluster click → get all leaves → onSelectContainers */
  map.on('click', 'clusters', e => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
    if (!features.length) return
    const feat      = features[0]
    const clusterId = feat.properties?.cluster_id as number
    const count     = feat.properties?.point_count as number
    ;(map.getSource('containers') as mapboxgl.GeoJSONSource)
      .getClusterLeaves(clusterId, count, 0, (err, leaves) => {
        if (err || !leaves) return
        const nums = leaves
          .map(l => (l.properties as { containerNumber?: string } | null)?.containerNumber)
          .filter((n): n is string => typeof n === 'string' && n.length > 0)
        if (nums.length) selectRef.current?.(nums)
      })
  })

  /* Single marker click → onSelectContainers + popup */
  map.on('click', 'unclustered', e => {
    const cn = e.features?.[0]?.properties?.containerNumber as string | undefined
    if (cn) {
      selectRef.current?.([cn])
      showSearchRef.current(cn, e.lngLat.lng, e.lngLat.lat)
    }
  })

  /* Searched marker click → re-open popup if closed */
  map.on('click', 'searched-marker', e => {
    const cn = e.features?.[0]?.properties?.containerNumber as string | undefined
    if (cn) showSearchRef.current(cn, e.lngLat.lng, e.lngLat.lat)
  })

  /* Empty area click → clear selection + search highlight */
  map.on('click', e => {
    const hit = map.queryRenderedFeatures(e.point, {
      layers: ['clusters', 'unclustered', 'searched-marker', 'searched-glow'],
    })
    if (hit.length === 0) {
      clearRef.current?.()
      clearSearchRef.current()
    }
  })

  /* Pointer cursor on hover */
  for (const layer of ['clusters', 'unclustered', 'searched-marker'] as const) {
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
  }
}

function fitToContainers(map: mapboxgl.Map, containers: ContainerPoint[]) {
  if (containers.length === 0) return
  const lngs = containers.map(c => c.longitude)
  const lats  = containers.map(c => c.latitude)
  const bounds: mapboxgl.LngLatBoundsLike = [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
  map.fitBounds(bounds, { padding: 40, maxZoom: 10, duration: 600 })
}
