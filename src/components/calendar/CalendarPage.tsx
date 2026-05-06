import { useState } from 'react'
import { Loader2, ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { CalendarGrid } from './CalendarGrid'
import { useHolidays } from '../../hooks/useHolidays'
import type { CountryCode } from '../../hooks/useHolidays'
import type { Section } from '../layout/MenuRail'

const LANG_TO_COUNTRY: Record<string, CountryCode> = {
  ko: 'KR', en: 'US', ru: 'RU', uz: 'UZ', zh: 'CN', ja: 'JP',
}

const COUNTRIES: CountryCode[] = ['KR', 'US', 'RU', 'UZ', 'CN', 'JP']

interface Props {
  onSectionChange: (s: Section) => void
}

export function CalendarPage({ onSectionChange }: Props) {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()

  const defaultCountry =
    LANG_TO_COUNTRY[profile?.preferred_language ?? i18n.language] ?? 'KR'

  const [country, setCountry] = useState<CountryCode>(defaultCountry)

  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const { holidays, isLoading, error } = useHolidays(year, country)

  const handlePrevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  const handleNextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--chat-bg)' }}>

      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
      >
        {/* Back button — mobile only */}
        <button
          className="p-1.5 rounded-lg md:hidden flex-shrink-0"
          style={{ color: 'var(--ink-3)' }}
          onClick={() => onSectionChange('chat')}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          aria-label="Back"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-sm font-bold" style={{ color: 'var(--ink-1)' }}>
          {t('calendarTitle')}
        </h1>
      </div>

      {/* Country tabs */}
      <div
        className="flex overflow-x-auto scrollbar-none border-b flex-shrink-0"
        style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
      >
        {COUNTRIES.map(c => (
          <button
            key={c}
            onClick={() => setCountry(c)}
            className="flex-shrink-0 px-5 py-2.5 text-xs font-semibold border-b-2 transition-colors"
            style={{
              borderColor: country === c ? 'var(--brand)' : 'transparent',
              color:       country === c ? 'var(--brand)' : 'var(--ink-3)',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Calendar body */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ink-3)' }} />
          </div>
        ) : error ? (
          <div
            className="flex items-center justify-center h-48 text-sm"
            style={{ color: 'var(--ink-4)' }}
          >
            {t('calendarLoadError')}
          </div>
        ) : (
          <CalendarGrid
            year={year}
            month={month}
            holidays={holidays}
            lang={i18n.language}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
          />
        )}
      </div>
    </div>
  )
}
