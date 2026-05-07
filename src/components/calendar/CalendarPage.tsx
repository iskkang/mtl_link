import { useMemo } from 'react'
import { Loader2, ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CalendarGrid } from './CalendarGrid'
import { useHolidays } from '../../hooks/useHolidays'
import type { CountryCode, Holiday } from '../../hooks/useHolidays'
import type { Section } from '../layout/MenuRail'

interface Props {
  onSectionChange: (s: Section) => void
  currentYear:     number
  currentMonth:    number  // 0-indexed
  onPrevMonth:     () => void
  onNextMonth:     () => void
}

export function CalendarPage({ onSectionChange, currentYear, currentMonth, onPrevMonth, onNextMonth }: Props) {
  const { t, i18n } = useTranslation()

  const { holidays: krHolidays, isLoading: krLoading, error: krError } = useHolidays(currentYear, 'KR')
  const { holidays: usHolidays, isLoading: usLoading, error: usError } = useHolidays(currentYear, 'US')
  const { holidays: ruHolidays, isLoading: ruLoading, error: ruError } = useHolidays(currentYear, 'RU')
  const { holidays: uzHolidays, isLoading: uzLoading, error: uzError } = useHolidays(currentYear, 'UZ')
  const { holidays: cnHolidays, isLoading: cnLoading, error: cnError } = useHolidays(currentYear, 'CN')
  const { holidays: jpHolidays, isLoading: jpLoading, error: jpError } = useHolidays(currentYear, 'JP')

  const isLoading = krLoading || usLoading || ruLoading || uzLoading || cnLoading || jpLoading
  const error     = krError   || usError   || ruError   || uzError   || cnError   || jpError

  const allHolidays: Record<CountryCode, Holiday[]> = useMemo(() => ({
    KR: krHolidays,
    US: usHolidays,
    RU: ruHolidays,
    UZ: uzHolidays,
    CN: cnHolidays,
    JP: jpHolidays,
  }), [krHolidays, usHolidays, ruHolidays, uzHolidays, cnHolidays, jpHolidays])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--chat-bg)' }}>

      {/* Header — mobile back button */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
      >
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
          {t('calendarSidebarTitle')}
        </h1>
      </div>

      {/* Calendar — full width */}
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
            year={currentYear}
            month={currentMonth}
            allHolidays={allHolidays}
            lang={i18n.language}
            onPrevMonth={onPrevMonth}
            onNextMonth={onNextMonth}
          />
        )}
      </div>
    </div>
  )
}
