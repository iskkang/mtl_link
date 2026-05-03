import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Cloud } from 'lucide-react'
import { DashboardCard } from './DashboardCard'
import { getWeather, getWeatherIcon, getWeatherKey } from '../../lib/weather'
import type { WeatherResult } from '../../lib/weather'

export function WeatherCard() {
  const { t } = useTranslation()
  const [weather,  setWeather]  = useState<WeatherResult | null>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    let cancelled = false
    getWeather().then(data => {
      if (!cancelled) { setWeather(data); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [])

  return (
    <DashboardCard title={t('dashWeather')} icon={Cloud}>
      {loading ? (
        <div className="flex items-center gap-3 pt-1">
          <div className="w-10 h-10 rounded-xl animate-pulse flex-shrink-0" style={{ background: 'var(--side-row)' }} />
          <div className="flex flex-col gap-1.5">
            <div className="w-16 h-5 rounded animate-pulse" style={{ background: 'var(--side-row)' }} />
            <div className="w-24 h-3 rounded animate-pulse" style={{ background: 'var(--side-row)' }} />
          </div>
        </div>
      ) : weather ? (
        <div className="flex items-center gap-3 pt-1">
          <span className="text-4xl leading-none flex-shrink-0">{getWeatherIcon(weather.code)}</span>
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-tight" style={{ color: 'var(--ink)' }}>
              {weather.temp}°C
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--ink-3)' }}>
              {t(getWeatherKey(weather.code))} · {weather.location}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs pt-1" style={{ color: 'var(--ink-4)' }}>{t('weatherError')}</p>
      )}
    </DashboardCard>
  )
}
