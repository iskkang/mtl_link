import { useState, useMemo } from 'react'
import { Loader2, ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CalendarGrid } from './CalendarGrid'
import { useHolidays } from '../../hooks/useHolidays'
import type { CountryCode, Holiday } from '../../hooks/useHolidays'
import { COUNTRY_COLORS } from '../../constants/calendarColors'
import type { Section } from '../layout/MenuRail'

interface Props {
  onSectionChange: (s: Section) => void
}

export function CalendarPage({ onSectionChange }: Props) {
  const { t, i18n } = useTranslation()

  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const { holidays: krHolidays, isLoading: krLoading, error: krError } = useHolidays(year, 'KR')
  const { holidays: usHolidays, isLoading: usLoading, error: usError } = useHolidays(year, 'US')
  const { holidays: ruHolidays, isLoading: ruLoading, error: ruError } = useHolidays(year, 'RU')
  const { holidays: uzHolidays, isLoading: uzLoading, error: uzError } = useHolidays(year, 'UZ')
  const { holidays: cnHolidays, isLoading: cnLoading, error: cnError } = useHolidays(year, 'CN')
  const { holidays: jpHolidays, isLoading: jpLoading, error: jpError } = useHolidays(year, 'JP')

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

      {/* Body: sidebar + calendar */}
      <div className="flex flex-1 min-h-0">

        {/* Desktop: holiday sidebar (left) */}
        <div
          className="hidden md:flex flex-col w-56 flex-shrink-0 border-r overflow-y-auto"
          style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
        >
          <HolidaySidebar
            allHolidays={allHolidays}
            year={year}
            month={month}
            lang={i18n.language}
            t={t}
          />
        </div>

        {/* Main calendar area */}
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
              allHolidays={allHolidays}
              lang={i18n.language}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
            />
          )}

          {/* Mobile: holiday list below grid */}
          <div className="md:hidden mt-6">
            <HolidaySidebar
              allHolidays={allHolidays}
              year={year}
              month={month}
              lang={i18n.language}
              t={t}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Holiday Sidebar ─────────────────────────────── */

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

function HolidaySidebar({
  allHolidays, year, month, lang, t,
}: {
  allHolidays: Record<CountryCode, Holiday[]>
  year:        number
  month:       number
  lang:        string
  t:           (key: string) => string
}) {
  const mm = String(month + 1).padStart(2, '0')
  const prefix = `${year}-${mm}`

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

  return (
    <div className="pb-4">
      <p
        className="px-3 pt-3 pb-2 text-[11px] font-bold uppercase tracking-wider border-b"
        style={{ color: 'var(--ink-4)', borderColor: 'var(--line)' }}
      >
        {t('calendarSidebarTitle')}
      </p>
      {items.length === 0 ? (
        <p className="px-3 pt-3 text-xs" style={{ color: 'var(--ink-4)' }}>
          {t('calendarNoHolidays')}
        </p>
      ) : (
        <ul className="pt-1">
          {items.map((item, i) => (
            <li key={`${item.date}-${item.country}-${i}`} className="flex items-start gap-2 px-3 py-1">
              <span
                className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: COUNTRY_COLORS[item.country] }}
              />
              <div className="min-w-0">
                <span className="text-[11px] tabular-nums block" style={{ color: 'var(--ink-4)' }}>
                  {formatDate(item.date, lang)}
                </span>
                <span className="text-xs truncate block" style={{ color: 'var(--ink)' }}>
                  {item.name}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
