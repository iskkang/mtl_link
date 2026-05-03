export interface WeatherResult {
  temp:      number
  feelsLike: number
  code:      number
  location:  string
}

const CACHE_KEY = 'mtl_weather_v2'
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

async function fetchWeather(lat: number, lon: number): Promise<{ temp: number; feelsLike: number; code: number }> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code`
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error('open-meteo failed')
  const d = await res.json() as { current: { temperature_2m: number; apparent_temperature: number; weather_code: number } }
  return {
    temp:      Math.round(d.current.temperature_2m),
    feelsLike: Math.round(d.current.apparent_temperature),
    code:      d.current.weather_code,
  }
}

export async function getWeather(): Promise<WeatherResult | null> {
  const hit = getCached()
  if (hit) return hit

  let lat = 37.5665, lon = 126.978, city = 'Seoul'

  try {
    const loc = await getLocation()
    lat = loc.lat; lon = loc.lon; city = loc.city
  } catch { /* use Seoul fallback */ }

  try {
    const { temp, feelsLike, code } = await fetchWeather(lat, lon)
    const result: WeatherResult = { temp, feelsLike, code, location: city }
    saveCache(result)
    return result
  } catch {
    return null
  }
}

// WMO code → gradient + whether background is dark
export function getWeatherStyle(code: number): { gradient: string; dark: boolean } {
  if (code === 0)  return { gradient: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',  dark: true }
  if (code <= 3)   return { gradient: 'linear-gradient(135deg, #4B5563 0%, #374151 100%)',  dark: true }
  if (code <= 48)  return { gradient: 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)',  dark: true }
  if (code <= 55)  return { gradient: 'linear-gradient(135deg, #1D4ED8 0%, #60A5FA 100%)',  dark: true }
  if (code <= 65)  return { gradient: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)',  dark: true }
  if (code <= 77)  return { gradient: 'linear-gradient(135deg, #BAE6FD 0%, #E0F2FE 100%)',  dark: false }
  if (code <= 82)  return { gradient: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)',  dark: true }
  if (code <= 86)  return { gradient: 'linear-gradient(135deg, #CBD5E1 0%, #E2E8F0 100%)',  dark: false }
  return             { gradient: 'linear-gradient(135deg, #1E1B4B 0%, #4C1D95 100%)',        dark: true }
}

// WMO code → emoji icon
export function getWeatherIcon(code: number): string {
  if (code === 0)  return '☀️'
  if (code <= 3)   return '⛅'
  if (code <= 48)  return '🌫️'
  if (code <= 55)  return '🌦️'
  if (code <= 65)  return '🌧️'
  if (code <= 77)  return '❄️'
  if (code <= 82)  return '🌦️'
  if (code <= 86)  return '🌨️'
  return '⛈️'
}

// WMO code → i18n key
export function getWeatherKey(code: number): string {
  if (code === 0)  return 'weatherClear'
  if (code <= 3)   return 'weatherPartlyCloudy'
  if (code <= 48)  return 'weatherFog'
  if (code <= 55)  return 'weatherDrizzle'
  if (code <= 65)  return 'weatherRain'
  if (code <= 77)  return 'weatherSnow'
  if (code <= 82)  return 'weatherShowers'
  if (code <= 86)  return 'weatherSnow'
  return 'weatherThunder'
}

// Time-based greeting card gradient
export function getGreetingStyle(): { gradient: string } {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return { gradient: 'linear-gradient(135deg, #F97316 0%, #DC2626 100%)' }  // dawn
  if (h >= 12 && h < 18) return { gradient: 'linear-gradient(135deg, #2563EB 0%, #0EA5E9 100%)' }  // day
  if (h >= 18 && h < 22) return { gradient: 'linear-gradient(135deg, #7C3AED 0%, #DB2777 100%)' }  // dusk
  return                          { gradient: 'linear-gradient(135deg, #111827 0%, #1E3A8A 100%)' }  // night
}
