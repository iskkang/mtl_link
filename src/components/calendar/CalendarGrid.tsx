import { useMemo } from 'react'
import {
  format, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isToday,
} from 'date-fns'
import { ko, enUS, ru, zhCN, ja } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Holiday } from '../../hooks/useHolidays'

const LOCALES: Record<string, Locale> = {
  ko, en: enUS, ru, uz: ru, zh: zhCN, ja,
}

// 7 narrow weekday labels starting from Monday
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
  holidays:    Holiday[]
  lang:        string
  onPrevMonth: () => void
  onNextMonth: () => void
}

export function CalendarGrid({ year, month, holidays, lang, onPrevMonth, onNextMonth }: Props) {
  const { t } = useTranslation()
  const locale = LOCALES[lang] ?? LOCALES.ko

  const monthStart = useMemo(() => new Date(year, month, 1), [year, month])

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(monthStart), end: endOfMonth(monthStart) }),
    [monthStart],
  )

  // Mon-start offset: Sun(0)→6, Mon(1)→0, …
  const leadingEmpty = useMemo(() => {
    const d = getDay(startOfMonth(monthStart))
    return d === 0 ? 6 : d - 1
  }, [monthStart])

  const labels = useMemo(() => weekdayLabels(locale), [locale])

  // date string → holidays on that day
  const holidayMap = useMemo(() => {
    const map = new Map<string, Holiday[]>()
    for (const h of holidays) {
      const list = map.get(h.date) ?? []
      map.set(h.date, [...list, h])
    }
    return map
  }, [holidays])

  const headerText = useMemo(() => {
    if (lang === 'ko') return format(monthStart, 'yyyy년 M월', { locale })
    if (lang === 'zh' || lang === 'ja') return format(monthStart, 'yyyy年M月', { locale })
    return format(monthStart, 'MMMM yyyy', { locale })
  }, [monthStart, lang, locale])

  return (
    <div className="max-w-2xl mx-auto">
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
            className="min-h-[44px] md:min-h-[56px]"
            style={{ background: 'var(--chat-bg)' }}
          />
        ))}

        {/* Day cells */}
        {days.map(day => {
          const key    = format(day, 'yyyy-MM-dd')
          const hols   = holidayMap.get(key)
          const today  = isToday(day)
          const dayNum = day.getDate()

          return (
            <div
              key={key}
              className="group relative min-h-[44px] md:min-h-[56px] flex flex-col
                         items-center justify-start pt-1.5 pb-1 cursor-default select-none"
              style={{ background: 'var(--card)' }}
            >
              {/* Day number */}
              <span
                className="w-7 h-7 flex items-center justify-center rounded-full text-[13px] font-medium"
                style={
                  today
                    ? { background: 'var(--brand)', color: 'white' }
                    : { color: 'var(--ink-1)' }
                }
              >
                {dayNum}
              </span>

              {/* Holiday dot */}
              {hols && (
                <div
                  className="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: 'var(--brand)' }}
                />
              )}

              {/* Tooltip on hover */}
              {hols && (
                <div
                  className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1
                             hidden group-hover:block z-20
                             px-2 py-1 rounded-md text-[11px] shadow-lg whitespace-nowrap"
                  style={{
                    background:  'var(--ink-1)',
                    color:       'var(--chat-bg)',
                    maxWidth:    160,
                    whiteSpace:  'normal',
                    textAlign:   'center',
                    lineHeight:  '1.4',
                  }}
                >
                  {hols.map(h => h.localName).join('\n')}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* No holidays note */}
      {holidays.length === 0 && (
        <p className="text-center text-xs mt-6" style={{ color: 'var(--ink-4)' }}>
          {t('calendarNoHolidays')}
        </p>
      )}
    </div>
  )
}
