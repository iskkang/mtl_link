// Server-side only. MAPBOX_ACCESS_TOKEN must never reach the client bundle.

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN

export interface GeocodeResult {
  latitude:    number
  longitude:   number
  countryCode: string | null  // ISO alpha-2, uppercased
  countryName: string | null
  placeName:   string
  placeType:   string
}

export async function geocodeLocation(
  query: string,
): Promise<GeocodeResult | null> {
  const q = query.trim()
  if (!q) return null

  if (!MAPBOX_TOKEN) throw new Error('MAPBOX_ACCESS_TOKEN is not configured')

  const url =
    `https://api.mapbox.com/search/geocode/v6/forward` +
    `?q=${encodeURIComponent(q)}` +
    `&access_token=${MAPBOX_TOKEN}` +
    `&limit=1` +
    `&types=place,locality,district,region`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5_000)

  let response: Response
  try {
    response = await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Mapbox geocode ${response.status}: ${body.substring(0, 200)}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await response.json()
  const feature = json?.features?.[0]
  if (!feature) return null

  // v6: coordinates in properties.coordinates or geometry.coordinates
  const lat: number =
    feature.properties?.coordinates?.latitude  ??
    feature.geometry?.coordinates?.[1]
  const lng: number =
    feature.properties?.coordinates?.longitude ??
    feature.geometry?.coordinates?.[0]

  if (lat == null || lng == null) return null

  // v6: context is an object keyed by feature type
  const countryCtx = feature.properties?.context?.country
  const rawCode: string | null = countryCtx?.country_code ?? null
  const countryCode = rawCode ? rawCode.toUpperCase() : null
  const countryName: string | null = countryCtx?.name ?? null

  const placeName: string =
    feature.properties?.full_address ??
    feature.properties?.name ??
    q

  const placeType: string = feature.properties?.feature_type ?? ''

  return { latitude: lat, longitude: lng, countryCode, countryName, placeName, placeType }
}
