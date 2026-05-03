import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getWeather, getWeatherIcon, getWeatherKey, getWeatherStyle } from '../../lib/weather'
import type { WeatherResult } from '../../lib/weather'

export function WeatherCard() {
  const { t, i18n } = useTranslation()
  const [weather, setWeather] = useState<WeatherResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getWeather().then(data => {
      if (!cancelled) { setWeather(data); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [])

  const style  = weather ? getWeatherStyle(weather.code) : { gradient: 'linear-gradient(135deg, #4B5563 0%, #374151 100%)', dark: true }
  const ink    = style.dark ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.90)'
  const inkSub = style.dark ? 'rgba(255,255,255,0.60)' : 'rgba(15,23,42,0.55)'

  const dateStr = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'short', month: 'short', day: 'numeric',
  }).format(new Date())

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col justify-between"
      style={{
        background: style.gradient,
        border:     style.dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
        boxShadow:  'var(--shadow-panel)',
        minHeight:  148,
        padding:    '18px 20px',
      }}
    >
      {loading ? (
        <div className="flex flex-col gap-2 animate-pulse">
          <div className="h-3 w-16 rounded" style={{ background: 'rgba(255,255,255,0.25)' }} />
          <div className="h-10 w-20 rounded mt-2" style={{ background: 'rgba(255,255,255,0.25)' }} />
          <div className="h-3 w-28 rounded mt-1" style={{ background: 'rgba(255,255,255,0.25)' }} />
        </div>
      ) : weather ? (
        <>
          {/* Top: date + large icon */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-medium" style={{ color: inkSub }}>{dateStr}</p>
              <p className="text-[11px] mt-0.5" style={{ color: inkSub }}>{weather.location}</p>
            </div>
            <span style={{ fontSize: 50, lineHeight: 1 }}>{getWeatherIcon(weather.code)}</span>
          </div>

          {/* Bottom: temperature + condition */}
          <div className="mt-3">
            <p className="text-[40px] font-bold leading-none tabular-nums" style={{ color: ink }}>
              {weather.temp}°
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="text-[12px] font-semibold" style={{ color: ink }}>
                {t(getWeatherKey(weather.code))}
              </span>
              <span className="text-[11px]" style={{ color: inkSub }}>
                · {t('weatherFeelsLike')} {weather.feelsLike}°
              </span>
            </div>
          </div>
        </>
      ) : (
        <p className="text-[11px]" style={{ color: inkSub }}>{t('weatherError')}</p>
      )}
    </div>
  )
}
