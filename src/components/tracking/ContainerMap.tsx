import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'

export interface ContainerPoint {
  containerNumber: string
  latitude:        number
  longitude:       number
  signal:          'red' | 'yellow' | 'green' | 'gray'
}

interface ContainerMapProps {
  containers:     ContainerPoint[]
  onMarkerClick?: (containerNumber: string) => void
}

const TOKEN = import.meta.env.MAPBOX_ACCESS_TOKEN as string | undefined

/* signal → hex color */
const SIG_COLOR: Record<string, string> = {
  red:    '#dc2626',
  yellow: '#d97706',
  green:  '#0d9488',
  gray:   '#94a3b8',
}

export function ContainerMap({ containers, onMarkerClick }: ContainerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<mapboxgl.Map | null>(null)
  const initialized  = useRef(false)

  /* ── Init map once ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || initialized.current) return
    if (!TOKEN) {
      console.error('[ContainerMap] VITE_MAPBOX_PUBLIC_TOKEN is not set')
      return
    }

    initialized.current = true
    mapboxgl.accessToken = TOKEN

    const map = new mapboxgl.Map({
      container:   containerRef.current,
      style:       'mapbox://styles/mapbox/light-v11',
      center:      [60, 50],
      zoom:        3,
      pitchWithRotate: false,
      touchPitch:      false,
    })

    map.keyboard.disable()
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    mapRef.current = map

    map.on('load', () => {
      addSourceAndLayers(map, containers, onMarkerClick)
      fitToContainers(map, containers)
    })

    return () => {
      map.remove()
      mapRef.current = null
      initialized.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Update data when containers / filter changes ───────────────── */
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

      {/* Empty-filter overlay */}
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
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [c.longitude, c.latitude],
      },
      properties: {
        containerNumber: c.containerNumber,
        signal:          c.signal,
      },
    })),
  }
}

function addSourceAndLayers(
  map: mapboxgl.Map,
  containers: ContainerPoint[],
  onMarkerClick?: (cn: string) => void,
) {
  /* ── Source ─────────────────────────────────────────────────────── */
  map.addSource('containers', {
    type:          'geojson',
    data:          toGeoJSON(containers),
    cluster:       true,
    clusterRadius: 50,
    clusterProperties: {
      red:    ['+', ['case', ['==', ['get', 'signal'], 'red'],    1, 0]],
      yellow: ['+', ['case', ['==', ['get', 'signal'], 'yellow'], 1, 0]],
      green:  ['+', ['case', ['==', ['get', 'signal'], 'green'],  1, 0]],
    },
  })

  /* ── Cluster circles ────────────────────────────────────────────── */
  map.addLayer({
    id:     'clusters',
    type:   'circle',
    source: 'containers',
    filter: ['has', 'point_count'],
    paint:  {
      'circle-color': ['case',
        ['>', ['get', 'red'],    0], SIG_COLOR.red,
        ['>', ['get', 'yellow'], 0], SIG_COLOR.yellow,
        SIG_COLOR.green,
      ],
      'circle-radius': ['step', ['get', 'point_count'], 14, 5, 18, 15, 22],
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.85,
    },
  })

  /* ── Cluster count labels ───────────────────────────────────────── */
  map.addLayer({
    id:     'cluster-count',
    type:   'symbol',
    source: 'containers',
    filter: ['has', 'point_count'],
    layout: {
      'text-field':            '{point_count}',
      'text-font':             ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size':             11,
      'text-allow-overlap':    true,
    },
    paint: { 'text-color': '#ffffff' },
  })

  /* ── Individual markers ─────────────────────────────────────────── */
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

  /* ── Cluster click → zoom in ────────────────────────────────────── */
  map.on('click', 'clusters', e => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
    if (!features.length) return

    const clusterId = features[0].properties?.cluster_id as number
    const geom = features[0].geometry as GeoJSON.Point
    ;(map.getSource('containers') as mapboxgl.GeoJSONSource)
      .getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || zoom == null) return
        map.easeTo({ center: geom.coordinates as [number, number], zoom })
      })
  })

  /* ── Individual marker click ────────────────────────────────────── */
  map.on('click', 'unclustered', e => {
    const cn = e.features?.[0]?.properties?.containerNumber as string | undefined
    if (cn) {
      console.log('[ContainerMap] marker click:', cn)
      onMarkerClick?.(cn)
    }
  })

  /* ── Pointer cursor on hover ────────────────────────────────────── */
  for (const layer of ['clusters', 'unclustered'] as const) {
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
  }
}

function fitToContainers(map: mapboxgl.Map, containers: ContainerPoint[]) {
  if (containers.length === 0) return

  const lngs = containers.map(c => c.longitude)
  const lats = containers.map(c => c.latitude)
  const bounds: mapboxgl.LngLatBoundsLike = [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
  map.fitBounds(bounds, { padding: 40, maxZoom: 10, duration: 600 })
}
