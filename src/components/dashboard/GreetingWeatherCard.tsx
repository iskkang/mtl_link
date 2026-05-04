import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getWeather, getWeatherIcon, getWeatherStyle } from '../../lib/weather'
import type { WeatherResult } from '../../lib/weather'

// ── 시간대별 인사 ──────────────────────────────────────────────────
function getGreetingMessage(name: string): string {
  const h = new Date().getHours()
  if (h < 5)  return `${name}님, 늦은 시간까지 고생 많으세요`
  if (h < 8)  return `${name}님, 오늘도 좋은 하루 시작하세요`
  if (h < 11) return `${name}님, 오늘도 활기찬 하루 되세요!`
  if (h < 13) return `${name}님, 오전 업무 마무리 잘하세요`
  if (h < 15) return `${name}님, 오후도 차분히 시작해요`
  if (h < 18) return `${name}님, 오후도 조금만 더 힘내세요`
  if (h < 21) return `${name}님, 오늘 하루도 고생 많으셨어요!`
  return `${name}님, 편안한 밤 보내세요`
}

// ── 날씨 서브 멘트 ────────────────────────────────────────────────
const WEATHER_MESSAGES: Record<string, string> = {
  clear:        '맑은 날이에요. 가볍게 움직이기 좋아요.',
  cloudy:       '흐린 날이에요. 일정은 여유 있게 잡으세요.',
  rainExpected: '비가 올 예정이에요. 우산을 챙기세요.',
  raining:      '비가 내리고 있어요. 이동 시 조심하세요.',
  heavyRain:    '비가 많이 와요. 외근 일정은 다시 확인하세요.',
  snowExpected: '눈 예보가 있어요. 이동 시간을 넉넉히 잡으세요.',
  heavySnow:    '눈이 많이 와요. 출퇴근길 안전에 유의하세요.',
  hot:          '더운 날이에요. 물 자주 마시고 무리하지 마세요.',
  extremeHot:   '폭염 수준이에요. 야외 활동은 최소화하세요.',
  freezing:     '기온이 영하예요. 따뜻하게 입고 이동하세요.',
  coldWave:     '매우 추운 날이에요. 방한 준비를 꼭 하세요.',
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
  const { profile } = useAuth()
  const [weather, setWeather] = useState<WeatherResult | null>(null)

  useEffect(() => {
    let cancelled = false
    getWeather().then(data => { if (!cancelled) setWeather(data) })
    return () => { cancelled = true }
  }, [])

  const dateStr = new Intl.DateTimeFormat('ko-KR', {
    weekday: 'long', month: 'long', day: 'numeric',
  }).format(new Date())

  const name = profile?.name ?? ''
  const greetText = name
    ? getGreetingMessage(name)
    : '오늘도 좋은 하루 되세요!'

  const weatherCategory = weather ? getWeatherCategory(weather.code, weather.temp) : null
  const weatherMsg      = weatherCategory ? WEATHER_MESSAGES[weatherCategory] : null

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
          <h2 className="text-[17px] font-bold leading-snug truncate" style={{ color: 'rgba(255,255,255,0.95)' }}>
            {greetText}
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
              체감 {weather.feelsLike}°
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
