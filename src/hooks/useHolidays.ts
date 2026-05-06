import { useState, useEffect } from 'react'

export interface Holiday {
  date:      string
  localName: string
  name:      string
}

export type CountryCode = 'KR' | 'US' | 'RU' | 'UZ' | 'CN' | 'JP'

// UZ: not in nager.date — static fixed holidays
const UZ_STATIC: Array<{ md: string; localName: string; name: string }> = [
  { md: '01-01', localName: 'Yangi yil bayrami',                 name: "New Year's Day"            },
  { md: '03-08', localName: 'Xalqaro xotin-qizlar kuni',        name: "International Women's Day"  },
  { md: '03-21', localName: "Navro'z bayrami",                  name: 'Nowruz'                     },
  { md: '05-09', localName: 'Xotira va qadrlash kuni',          name: 'Day of Memory and Honor'    },
  { md: '06-01', localName: 'Bolalar himoyasi kuni',             name: "Children's Day"             },
  { md: '09-01', localName: 'Mustaqillik kuni',                  name: 'Independence Day'           },
  { md: '10-01', localName: "O'qituvchi va murabbiylar kuni",   name: "Teacher's Day"              },
  { md: '12-08', localName: 'Konstitutsiya kuni',                name: 'Constitution Day'           },
]

function uzHolidays(year: number): Holiday[] {
  return UZ_STATIC.map(h => ({ date: `${year}-${h.md}`, localName: h.localName, name: h.name }))
}

function cacheKey(year: number, country: CountryCode) {
  return `holidays_${year}_${country}`
}

function readCache(year: number, country: CountryCode): Holiday[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(year, country))
    if (!raw) return null
    return JSON.parse(raw) as Holiday[]
  } catch {
    return null
  }
}

function writeCache(year: number, country: CountryCode, data: Holiday[]) {
  try {
    localStorage.setItem(cacheKey(year, country), JSON.stringify(data))
  } catch {
    // storage full — silently ignore
  }
}

export function useHolidays(year: number, country: CountryCode) {
  const [holidays,  setHolidays]  = useState<Holiday[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      // UZ: always use static data
      if (country === 'UZ') {
        setHolidays(uzHolidays(year))
        setIsLoading(false)
        return
      }

      const cached = readCache(year, country)
      if (cached) {
        setHolidays(cached)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as Holiday[]
        if (cancelled) return
        writeCache(year, country, data)
        setHolidays(data)
      } catch (err) {
        if (cancelled) return
        const fallback = readCache(year, country)
        if (fallback) {
          setHolidays(fallback)
        } else {
          setHolidays([])
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    setHolidays([])
    setError(null)
    load()

    return () => { cancelled = true }
  }, [year, country])

  return { holidays, isLoading, error }
}
