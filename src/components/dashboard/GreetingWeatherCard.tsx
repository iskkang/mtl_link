import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { getWeather, getWeatherIcon, getWeatherStyle } from '../../lib/weather'
import type { WeatherResult } from '../../lib/weather'

// ── 시간대별 인사 (i18n) ──────────────────────────────────────────
function getGreetingBody(h: number, t: (key: string) => string): string {
  if (h < 5)  return t('greetingLateNight')
  if (h < 8)  return t('greetingMorning')
  if (h < 11) return t('greetingMidMorning')
  if (h < 13) return t('greetingNoon')
  if (h < 15) return t('greetingAfternoon')
  if (h < 18) return t('greetingLateAfternoon')
  if (h < 21) return t('greetingEvening')
  return t('greetingNight')
}

// ── 날씨 카테고리 → i18n 키 매핑 ────────────────────────────────
const WEATHER_MSG_KEYS: Record<string, string> = {
  clear:        'weatherMsgClear',
  cloudy:       'weatherCloudy',
  rainExpected: 'weatherRainExpected',
  raining:      'weatherRaining',
  heavyRain:    'weatherHeavyRain',
  snowExpected: 'weatherSnowExpected',
  heavySnow:    'weatherHeavySnow',
  hot:          'weatherHot',
  extremeHot:   'weatherExtremeHot',
  freezing:     'weatherFreezing',
  coldWave:     'weatherColdWave',
}

function getWeatherCategory(code: number, temp: number): string {
  if (code >= 95) return 'heavyRain'
  if (code >= 85) return 'heavySnow'
  if (code >= 80) return 'heavyRain'
  if (code >= 75) return 'heavySnow'
  if (code >= 71) return 'snowExpected'
  if (code >= 65) return 'heavyRain'
  if (code >= 61) return 'raining'
  if (code >= 51) return 'rainExpected'
  if (temp >= 35) return 'extremeHot'
  if (temp >= 30) return 'hot'
  if (temp < -10) return 'coldWave'
  if (temp < 0)   return 'freezing'
  if (code >= 2)  return 'cloudy'
  return 'clear'
}

// ── Locale 매핑 ───────────────────────────────────────────────────
const LOCALE_MAP: Record<string, string> = {
  ko: 'ko-KR', en: 'en-US', ru: 'ru-RU',
  uz: 'uz-UZ', zh: 'zh-CN', ja: 'ja-JP',
}

// ── 그라디언트 헬퍼 ───────────────────────────────────────────────
function greetingStart(): string {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return '#F97316'
  if (h >= 12 && h < 18) return '#2563EB'
  if (h >= 18 && h < 22) return '#7C3AED'
  return '#111827'
}

function greetingMid(): string {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return '#DC2626'
  if (h >= 12 && h < 18) return '#0EA5E9'
  if (h >= 18 && h < 22) return '#DB2777'
  return '#1E3A8A'
}

function weatherEnd(code: number): string {
  const g = getWeatherStyle(code).gradient
  const m = g.match(/#[0-9a-fA-F]{6}/g) ?? ['#F59E0B']
  return m[0]
}

export function GreetingWeatherCard() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const [weather, setWeather] = useState<WeatherResult | null>(null)

  useEffect(() => {
    let cancelled = false
    getWeather().then(data => { if (!cancelled) setWeather(data) })
    return () => { cancelled = true }
  }, [])

  const userLanguage = i18n.language.split('-')[0]
  const locale = LOCALE_MAP[userLanguage] ?? 'en-US'

  const dateStr = new Intl.DateTimeFormat(locale, {
    weekday: 'long', month: 'long', day: 'numeric',
  }).format(new Date())

  const name = profile?.name ?? ''
  const h    = new Date().getHours()
  const body = getGreetingBody(h, t)

  const weatherCategory = weather ? getWeatherCategory(weather.code, weather.temp) : null
  const weatherMsgKey   = weatherCategory ? WEATHER_MSG_KEYS[weatherCategory] : null
  const weatherMsg      = weatherMsgKey ? t(weatherMsgKey) : null

  const gStart = greetingStart()
  const gMid   = greetingMid()
  const wEnd   = weather ? weatherEnd(weather.code) : '#6B7280'
  const gradient = `linear-gradient(135deg, ${gStart} 0%, ${gMid} 50%, ${wEnd} 100%)`

  const icon = weather ? getWeatherIcon(weather.code) : null

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col justify-between"
      style={{
        background: gradient,
        border:     '1px solid rgba(255,255,255,0.12)',
        boxShadow:  'var(--shadow-panel)',
        minHeight:  120,
        padding:    '12px 20px',
      }}
    >
      {/* Top row: date | location + icon */}
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.60)' }}>
          {dateStr}
        </p>
        {weather && (
          <div className="flex items-center gap-1">
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.70)' }}>{weather.location}</span>
            <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>
          </div>
        )}
      </div>

      {/* Bottom row: greeting | temperature */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {name && (
            <p className="text-[12px] font-medium leading-tight truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {name}님,
            </p>
          )}
          <h2 className="text-[17px] font-bold leading-snug truncate" style={{ color: 'rgba(255,255,255,0.95)' }}>
            {body}
          </h2>
          {weatherMsg && (
            <p className="text-[10px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.72)' }}>
              {weatherMsg}
            </p>
          )}
        </div>
        {weather && (
          <div className="text-right flex-shrink-0">
            <p className="text-[30px] font-bold leading-none tabular-nums" style={{ color: 'rgba(255,255,255,0.95)' }}>
              {weather.temp}°
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {t('weatherFeelsLikeTemp', { temp: weather.feelsLike })}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
