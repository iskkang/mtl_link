import { useMemo } from 'react'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useHolidays } from '../../hooks/useHolidays'
import type { CountryCode, Holiday } from '../../hooks/useHolidays'
import { COUNTRY_COLORS } from '../../constants/calendarColors'

interface Props {
  year:        number
  month:       number  // 0-indexed
  onPrevMonth: () => void
  onNextMonth: () => void
}

function formatDate(dateStr: string, lang: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  try {
    const wd = new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(d)
    return `${mm}/${dd} (${wd})`
  } catch {
    return `${mm}/${dd}`
  }
}

export function CalendarHolidayList({ year, month, onPrevMonth, onNextMonth }: Props) {
  const { t, i18n } = useTranslation()

  const { holidays: krHolidays, isLoading: krLoading } = useHolidays(year, 'KR')
  const { holidays: usHolidays, isLoading: usLoading } = useHolidays(year, 'US')
  const { holidays: ruHolidays, isLoading: ruLoading } = useHolidays(year, 'RU')
  const { holidays: uzHolidays, isLoading: uzLoading } = useHolidays(year, 'UZ')
  const { holidays: cnHolidays, isLoading: cnLoading } = useHolidays(year, 'CN')
  const { holidays: jpHolidays, isLoading: jpLoading } = useHolidays(year, 'JP')

  const isLoading = krLoading || usLoading || ruLoading || uzLoading || cnLoading || jpLoading

  const mm = String(month + 1).padStart(2, '0')
  const prefix = `${year}-${mm}`

  const allHolidays = useMemo(() => ({
    KR: krHolidays, US: usHolidays, RU: ruHolidays,
    UZ: uzHolidays, CN: cnHolidays, JP: jpHolidays,
  }), [krHolidays, usHolidays, ruHolidays, uzHolidays, cnHolidays, jpHolidays])

  const items = useMemo(() => {
    const list: { date: string; country: CountryCode; name: string }[] = []
    for (const [code, holidays] of Object.entries(allHolidays) as [CountryCode, Holiday[]][]) {
      for (const h of holidays) {
        if (h.date.startsWith(prefix)) {
          list.push({ date: h.date, country: code, name: h.localName || h.name })
        }
      }
    }
    return list.sort((a, b) => a.date.localeCompare(b.date))
  }, [allHolidays, prefix])

  const monthLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(i18n.language, { year: 'numeric', month: 'long' })
        .format(new Date(year, month, 1))
    } catch {
      return `${year}-${mm}`
    }
  }, [year, month, i18n.language, mm])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Month nav */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0"
        style={{ borderColor: 'var(--side-line)' }}
      >
        <button
          onClick={onPrevMonth}
          className="p-1 rounded-md"
          style={{ color: 'var(--side-mute)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          aria-label="Previous month"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-[12px] font-semibold" style={{ color: 'var(--side-text)' }}>
          {monthLabel}
        </span>
        <button
          onClick={onNextMonth}
          className="p-1 rounded-md"
          style={{ color: 'var(--side-mute)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          aria-label="Next month"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Holiday list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--side-mute)' }} />
          </div>
        ) : items.length === 0 ? (
          <p className="px-3 pt-4 text-xs text-center" style={{ color: 'var(--side-mute)' }}>
            {t('calendarNoHolidays')}
          </p>
        ) : (
          <ul className="py-2">
            {items.map((item, i) => (
              <li key={`${item.date}-${item.country}-${i}`} className="flex items-start gap-2 px-3 py-1.5">
                <span
                  className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: COUNTRY_COLORS[item.country] }}
                />
                <div className="min-w-0">
                  <span className="text-[11px] tabular-nums block" style={{ color: 'var(--side-mute)' }}>
                    {formatDate(item.date, i18n.language)}
                  </span>
                  <span className="text-xs truncate block" style={{ color: 'var(--side-text)' }}>
                    {item.name}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
