export interface WeatherResult {
  temp:     number
  code:     number
  location: string
}

const CACHE_KEY = 'mtl_weather_v1'
const CACHE_TTL = 30 * 60 * 1000

function getCached(): (WeatherResult & { at: number }) | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WeatherResult & { at: number }
    if (Date.now() - parsed.at > CACHE_TTL) return null
    return parsed
  } catch { return null }
}

function saveCache(data: WeatherResult) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, at: Date.now() }))
  } catch { /* quota exceeded — ignore */ }
}

async function getLocation(): Promise<{ lat: number; lon: number; city: string }> {
  const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) })
  if (!res.ok) throw new Error('ipapi failed')
  const d = await res.json() as { latitude: number; longitude: number; city: string }
  return { lat: d.latitude, lon: d.longitude, city: d.city }
}

async function fetchWeather(lat: number, lon: number): Promise<{ temp: number; code: number }> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error('open-meteo failed')
  const d = await res.json() as { current: { temperature_2m: number; weather_code: number } }
  return {
    temp: Math.round(d.current.temperature_2m),
    code: d.current.weather_code,
  }
}

export async function getWeather(): Promise<WeatherResult | null> {
  const hit = getCached()
  if (hit) return hit

  // Seoul fallback coordinates
  let lat = 37.5665, lon = 126.978, city = 'Seoul'

  try {
    const loc = await getLocation()
    lat = loc.lat; lon = loc.lon; city = loc.city
  } catch { /* use Seoul fallback */ }

  try {
    const { temp, code } = await fetchWeather(lat, lon)
    const result: WeatherResult = { temp, code, location: city }
    saveCache(result)
    return result
  } catch {
    return null
  }
}

// WMO weather code → emoji icon
export function getWeatherIcon(code: number): string {
  if (code === 0)        return '☀️'
  if (code <= 3)         return '⛅'
  if (code <= 48)        return '🌫️'
  if (code <= 55)        return '🌦️'
  if (code <= 65)        return '🌧️'
  if (code <= 77)        return '❄️'
  if (code <= 82)        return '🌦️'
  if (code <= 86)        return '🌨️'
  return '⛈️'
}

// WMO weather code → i18n key
export function getWeatherKey(code: number): string {
  if (code === 0)        return 'weatherClear'
  if (code <= 3)         return 'weatherPartlyCloudy'
  if (code <= 48)        return 'weatherFog'
  if (code <= 55)        return 'weatherDrizzle'
  if (code <= 65)        return 'weatherRain'
  if (code <= 77)        return 'weatherSnow'
  if (code <= 82)        return 'weatherShowers'
  if (code <= 86)        return 'weatherSnow'
  return 'weatherThunder'
}
