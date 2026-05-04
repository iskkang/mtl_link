import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { getWeather, getWeatherIcon, getWeatherKey, getWeatherStyle } from '../../lib/weather'
import type { WeatherResult } from '../../lib/weather'

function getGreetKey(named: boolean): string {
  const h = new Date().getHours()
  const base = h >= 5 && h < 12 ? 'Morning' : h >= 12 && h < 18 ? 'Afternoon' : 'Evening'
  return `greet${base}${named ? 'Name' : ''}`
}

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

  const dateStr = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'long', month: 'long', day: 'numeric',
  }).format(new Date())

  const greetText = profile?.name
    ? t(getGreetKey(true), { name: profile.name })
    : t(getGreetKey(false))

  const gStart = greetingStart()
  const gMid   = greetingMid()
  const wEnd   = weather ? weatherEnd(weather.code) : '#6B7280'
  const gradient = `linear-gradient(135deg, ${gStart} 0%, ${gMid} 50%, ${wEnd} 100%)`

  const icon         = weather ? getWeatherIcon(weather.code) : null
  const conditionKey = weather ? getWeatherKey(weather.code)  : null

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
          <h2 className="text-[17px] font-bold leading-snug truncate" style={{ color: 'rgba(255,255,255,0.95)' }}>
            {greetText}
          </h2>
          {(profile?.position || profile?.department) && (
            <p className="text-[10px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.60)' }}>
              {[profile.position, profile.department].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        {weather && (
          <div className="text-right flex-shrink-0">
            <p className="text-[30px] font-bold leading-none tabular-nums" style={{ color: 'rgba(255,255,255,0.95)' }}>
              {weather.temp}°
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {conditionKey ? t(conditionKey) : ''} · 체감 {weather.feelsLike}°
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
