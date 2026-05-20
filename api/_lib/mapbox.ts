// Server-side only. MAPBOX_ACCESS_TOKEN must never reach the client bundle.

import { FESCO_LOCATION_ALIASES } from './fescoAliases.js'

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN

// CIS + East Asia + Poland (transit). Excludes noise from other regions.
const COUNTRY_FILTER = 'ru,uz,by,kz,kg,tj,tm,az,am,ge,kr,cn,jp,vn,th,pl'

export interface GeocodeResult {
  latitude:    number
  longitude:   number
  countryCode: string | null  // ISO alpha-2, uppercased
  countryName: string | null
  placeName:   string
  placeType:   string
}

async function callMapbox(q: string): Promise<GeocodeResult | null> {
  const url =
    `https://api.mapbox.com/search/geocode/v6/forward` +
    `?q=${encodeURIComponent(q)}` +
    `&access_token=${MAPBOX_TOKEN}` +
    `&limit=1` +
    `&types=place,locality,district,region` +
    `&country=${COUNTRY_FILTER}`

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

// j→y transliteration: "j" before a vowel or at end-of-word → "y"
function jToY(s: string): string {
  return s
    .replace(/j([aeiouAEIOU])/g, 'y$1')
    .replace(/j$/i, 'y')
}

export async function geocodeLocation(
  query: string,
): Promise<GeocodeResult | null> {
  if (!MAPBOX_TOKEN) throw new Error('MAPBOX_ACCESS_TOKEN is not configured')

  const normalized = query.trim().toLowerCase()
  if (!normalized) return null

  const aliased = FESCO_LOCATION_ALIASES[normalized]
  const searchQuery = aliased ?? query.trim()

  // First Mapbox call
  const result = await callMapbox(searchQuery)
  if (result) return result

  // j→y fallback — only when no alias was applied
  if (!aliased) {
    const transformed = jToY(searchQuery)
    if (transformed !== searchQuery) {
      return await callMapbox(transformed)
    }
  }

  return null
}
