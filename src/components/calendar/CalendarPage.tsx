import { useState } from 'react'
import { Loader2, ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { CalendarGrid } from './CalendarGrid'
import { useHolidays } from '../../hooks/useHolidays'
import type { CountryCode, Holiday } from '../../hooks/useHolidays'
import type { Section } from '../layout/MenuRail'

const LANG_TO_COUNTRY: Record<string, CountryCode> = {
  ko: 'KR', en: 'US', ru: 'RU', uz: 'UZ', zh: 'CN', ja: 'JP',
}

const COUNTRIES: CountryCode[] = ['KR', 'US', 'RU', 'UZ', 'CN', 'JP']

const COUNTRY_INFO: Record<CountryCode, { flag: string; name: string }> = {
  KR: { flag: '🇰🇷', name: 'Korea'      },
  US: { flag: '🇺🇸', name: 'USA'        },
  RU: { flag: '🇷🇺', name: 'Russia'     },
  UZ: { flag: '🇺🇿', name: 'Uzbekistan' },
  CN: { flag: '🇨🇳', name: 'China'      },
  JP: { flag: '🇯🇵', name: 'Japan'      },
}

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

      {/* Body: sidebar + calendar */}
      <div className="flex flex-1 min-h-0">

        {/* Desktop: holiday sidebar (left) */}
        <div
          className="hidden md:flex flex-col w-56 flex-shrink-0 border-r overflow-y-auto"
          style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
        >
          <HolidaySidebar year={year} month={month} lang={i18n.language} t={t} />
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
              holidays={holidays}
              lang={i18n.language}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
            />
          )}

          {/* Mobile: holiday list below grid */}
          <div className="md:hidden mt-6">
            <HolidaySidebar year={year} month={month} lang={i18n.language} t={t} />
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

function CountryHolidays({
  code, year, month, lang, noHolidaysLabel,
}: {
  code:             CountryCode
  year:             number
  month:            number
  lang:             string
  noHolidaysLabel:  string
}) {
  const { holidays, isLoading } = useHolidays(year, code)
  const mm = String(month + 1).padStart(2, '0')
  const filtered: Holiday[] = holidays
    .filter(h => h.date.startsWith(`${year}-${mm}`))
    .sort((a, b) => a.date.localeCompare(b.date))

  const info = COUNTRY_INFO[code]

  return (
    <div>
      <div className="flex items-center gap-1.5 px-3 pt-3 pb-1">
        <span className="text-base leading-none">{info.flag}</span>
        <span className="text-[11px] font-semibold" style={{ color: 'var(--ink-3)' }}>
          {info.name}
        </span>
      </div>
      {isLoading ? (
        <div className="px-3 pb-2">
          <div className="h-4 rounded animate-pulse" style={{ background: 'var(--line)', width: '70%' }} />
        </div>
      ) : filtered.length === 0 ? (
        <p className="px-3 pb-2 text-xs" style={{ color: 'var(--ink-4)' }}>
          {noHolidaysLabel}
        </p>
      ) : (
        <ul className="pb-2">
          {filtered.map(h => (
            <li key={h.date} className="flex items-baseline gap-2 px-3 py-0.5">
              <span className="text-[11px] tabular-nums flex-shrink-0" style={{ color: 'var(--ink-4)' }}>
                {formatDate(h.date, lang)}
              </span>
              <span className="text-xs truncate" style={{ color: 'var(--ink)' }}>
                {h.localName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function HolidaySidebar({
  year, month, lang, t,
}: {
  year:  number
  month: number
  lang:  string
  t:     (key: string) => string
}) {
  return (
    <div className="pb-4">
      <p
        className="px-3 pt-3 pb-2 text-[11px] font-bold uppercase tracking-wider border-b"
        style={{ color: 'var(--ink-4)', borderColor: 'var(--line)' }}
      >
        {t('calendarSidebarTitle')}
      </p>
      {COUNTRIES.map(code => (
        <CountryHolidays
          key={code}
          code={code}
          year={year}
          month={month}
          lang={lang}
          noHolidaysLabel={t('calendarNoHolidays')}
        />
      ))}
    </div>
  )
}
