import { useMemo } from 'react'
import {
  format, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isToday,
} from 'date-fns'
import { ko, enUS, ru, zhCN, ja } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CountryCode, Holiday } from '../../hooks/useHolidays'
import { COUNTRY_COLORS } from '../../constants/calendarColors'

const LOCALES: Record<string, Locale> = {
  ko, en: enUS, ru, uz: ru, zh: zhCN, ja,
}

function weekdayLabels(locale: Locale): string[] {
  // 2024-01-01 is a known Monday
  const monday = new Date(2024, 0, 1)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(1 + i)
    return format(d, 'EEEEE', { locale })
  })
}

interface Props {
  year:        number
  month:       number  // 0-indexed
  allHolidays: Record<string, Holiday[]>
  lang:        string
  onPrevMonth: () => void
  onNextMonth: () => void
}

export function CalendarGrid({ year, month, allHolidays, lang, onPrevMonth, onNextMonth }: Props) {
  const { t } = useTranslation()
  const locale = LOCALES[lang] ?? LOCALES.ko

  const monthStart = useMemo(() => new Date(year, month, 1), [year, month])

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(monthStart), end: endOfMonth(monthStart) }),
    [monthStart],
  )

  const leadingEmpty = useMemo(() => {
    const d = getDay(startOfMonth(monthStart))
    return d === 0 ? 6 : d - 1
  }, [monthStart])

  const labels = useMemo(() => weekdayLabels(locale), [locale])

  // date string → list of { country, holiday } across all countries
  const holidayMap = useMemo(() => {
    const map = new Map<string, { country: string; holiday: Holiday }[]>()
    for (const [country, holidays] of Object.entries(allHolidays)) {
      for (const h of holidays) {
        const list = map.get(h.date) ?? []
        map.set(h.date, [...list, { country, holiday: h }])
      }
    }
    return map
  }, [allHolidays])

  const headerText = useMemo(() => {
    if (lang === 'ko') return format(monthStart, 'yyyy년 M월', { locale })
    if (lang === 'zh' || lang === 'ja') return format(monthStart, 'yyyy年M月', { locale })
    return format(monthStart, 'MMMM yyyy', { locale })
  }, [monthStart, lang, locale])

  const totalHolidays = useMemo(
    () => Object.values(allHolidays).reduce((sum, arr) => sum + arr.length, 0),
    [allHolidays],
  )

  return (
    <div className="max-w-4xl mx-auto">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onPrevMonth}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--ink-3)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-sm font-bold" style={{ color: 'var(--ink-1)' }}>
          {headerText}
        </h2>
        <button
          onClick={onNextMonth}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--ink-3)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Calendar grid */}
      <div
        className="grid grid-cols-7 gap-px rounded-xl overflow-hidden"
        style={{ background: 'var(--line)' }}
      >
        {/* Weekday headers */}
        {labels.map((label, i) => (
          <div
            key={i}
            className="py-2 text-center text-[11px] font-semibold"
            style={{ background: 'var(--card)', color: 'var(--ink-3)' }}
          >
            {label}
          </div>
        ))}

        {/* Leading empty cells */}
        {Array.from({ length: leadingEmpty }, (_, i) => (
          <div
            key={`empty-${i}`}
            className="min-h-[80px] md:min-h-[100px]"
            style={{ background: 'var(--chat-bg)' }}
          />
        ))}

        {/* Day cells */}
        {days.map(day => {
          const key    = format(day, 'yyyy-MM-dd')
          const hols   = holidayMap.get(key)
          const todayCell = isToday(day)
          const dayNum = day.getDate()
          const uniqueCountries = hols
            ? [...new Set(hols.map(({ country }) => country))]
            : null

          return (
            <div
              key={key}
              className="group relative min-h-[80px] md:min-h-[100px] flex flex-col
                         items-center pt-2 pb-1 cursor-default select-none"
              style={{ background: 'var(--card)' }}
            >
              {/* Day number */}
              <span
                className="w-8 h-8 flex items-center justify-center rounded-full text-base font-medium"
                style={
                  todayCell
                    ? { background: 'var(--brand)', color: 'white' }
                    : { color: 'var(--ink-1)' }
                }
              >
                {dayNum}
              </span>

              {/* Country color dots */}
              {uniqueCountries && (
                <div className="mt-1 flex flex-wrap justify-center gap-0.5 px-1">
                  {uniqueCountries.map(country => (
                    <div
                      key={country}
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: COUNTRY_COLORS[country as CountryCode] ?? 'var(--brand)' }}
                    />
                  ))}
                </div>
              )}

              {/* Tooltip on hover */}
              {hols && (
                <div
                  className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1
                             hidden group-hover:block z-20
                             px-2 py-1 rounded-md text-[11px] shadow-lg"
                  style={{
                    background: 'rgba(0,0,0,0.82)',
                    color:      '#ffffff',
                    maxWidth:   200,
                    whiteSpace: 'pre-line',
                    textAlign:  'center',
                    lineHeight: '1.5',
                  }}
                >
                  {hols.map(({ country, holiday }) =>
                    `${country}: ${holiday.localName || holiday.name}`
                  ).join('\n')}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* No holidays note */}
      {totalHolidays === 0 && (
        <p className="text-center text-xs mt-6" style={{ color: 'var(--ink-4)' }}>
          {t('calendarNoHolidays')}
        </p>
      )}
    </div>
  )
}
