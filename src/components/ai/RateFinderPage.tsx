import { useState, useEffect } from 'react'
import { ChevronLeft, Search, Download, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'

interface RateRow {
  id:          string
  agent:       string | null
  mode:        string | null
  pol:         string | null
  loading:     string | null
  border:      string | null
  pod:         string | null
  type:        string | null
  owner:       string | null
  rate_jan:    number | null
  rate_feb:    number | null
  rate_mar:    number | null
  rate_apr:    number | null
  rate_may:    number | null
  ltime:       string | null
  valid_month: string | null
}

const MONTH_COLS: { value: string; key: keyof RateRow; label: string }[] = [
  { value: '1', key: 'rate_jan', label: '1월' },
  { value: '2', key: 'rate_feb', label: '2월' },
  { value: '3', key: 'rate_mar', label: '3월' },
  { value: '4', key: 'rate_apr', label: '4월' },
  { value: '5', key: 'rate_may', label: '5월' },
]

interface Props {
  onBack: () => void
}

export function RateFinderPage({ onBack }: Props) {
  const { t } = useTranslation()

  const [polOptions,    setPolOptions]    = useState<string[]>([])
  const [borderOptions, setBorderOptions] = useState<string[]>([])
  const [podOptions,    setPodOptions]    = useState<string[]>([])
  const [pol,           setPol]           = useState('')
  const [border,        setBorder]        = useState('')
  const [pod,           setPod]           = useState('')
  const [owner,         setOwner]         = useState('')
  const [selectedMonth, setSelectedMonth] = useState('5')
  const [results,       setResults]       = useState<RateRow[]>([])
  const [loading,       setLoading]       = useState(false)
  const [searched,      setSearched]      = useState(false)
  const [filterLoading, setFilterLoading] = useState(true)

  // Load filter options on mount
  useEffect(() => {
    void (async () => {
      setFilterLoading(true)
      const [polRes, borderRes, podRes] = await Promise.all([
        supabase.from('rate_entries').select('pol').not('pol', 'is', null),
        supabase.from('rate_entries').select('border').not('border', 'is', null),
        supabase.from('rate_entries').select('pod').not('pod', 'is', null),
      ])
      const pols    = [...new Set((polRes.data    ?? []).map(r => r.pol    as string))].sort()
      const borders = [...new Set((borderRes.data ?? []).map(r => r.border as string))].sort()
      const pods    = [...new Set((podRes.data    ?? []).map(r => r.pod    as string))].sort()
      setPolOptions(pols)
      setBorderOptions(borders)
      setPodOptions(pods)
      setFilterLoading(false)
    })()
  }, [])

  const handleSearch = async () => {
    setLoading(true)
    setSearched(true)

    let query = supabase.from('rate_entries').select('*')

    if (pol)    query = query.eq('pol',    pol)
    if (border) query = query.eq('border', border)
    if (pod)    query = query.eq('pod',    pod)
    if (owner)  query = query.eq('owner',  owner)

    const monthCol = MONTH_COLS.find(m => m.value === selectedMonth)?.key ?? 'rate_may'
    const { data, error } = await query
      .not(monthCol as string, 'is', null)
      .order(monthCol as string, { ascending: true })

    if (error) console.error('[RateFinder] query error:', error.message)
    setResults((data as RateRow[]) ?? [])
    setLoading(false)
  }

  const handleDownload = () => {
    if (results.length === 0) return
    const monthMeta = MONTH_COLS.find(m => m.value === selectedMonth)!
    const rows = results.map(r => ({
      '대리점':          r.agent   ?? '',
      'Mode':           r.mode    ?? '',
      'POL':            r.pol     ?? '',
      'Loading':        r.loading ?? '',
      'Border':         r.border  ?? '',
      'POD':            r.pod     ?? '',
      'Type':           r.type    ?? '',
      'Owner':          r.owner   ?? '',
      [`${monthMeta.label} 운임`]: r[monthMeta.key] ?? '',
      'T/Time':         r.ltime   ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '운임조회')
    XLSX.writeFile(wb, `운임조회_${monthMeta.label}.xlsx`)
  }

  const monthMeta = MONTH_COLS.find(m => m.value === selectedMonth) ?? MONTH_COLS[4]

  const selectStyle = {
    background:   'var(--card)',
    color:        'var(--ink)',
    borderColor:  'var(--line)',
    borderRadius: '0.5rem',
    border:       '1px solid var(--line)',
    padding:      '0.375rem 0.75rem',
    fontSize:     '0.8125rem',
    outline:      'none',
    width:        '100%',
  } as React.CSSProperties

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--chat-bg)' }}>

      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
      >
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg flex-shrink-0"
          style={{ color: 'var(--ink-3)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          aria-label="Back"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-sm font-bold" style={{ color: 'var(--ink-1)' }}>
          {t('rateFinderTitle')}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto flex flex-col gap-4">

          {/* Filter card */}
          <div
            className="rounded-2xl border p-4"
            style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
          >
            <div className="grid grid-cols-2 gap-3">

              {/* POL */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--ink-3)' }}>
                  {t('rateFinderPol')}
                </label>
                <select
                  value={pol}
                  onChange={e => setPol(e.target.value)}
                  style={selectStyle}
                  disabled={filterLoading}
                >
                  <option value="">{t('rateFinderAll')}</option>
                  {polOptions.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              {/* Border */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--ink-3)' }}>
                  Border
                </label>
                <select
                  value={border}
                  onChange={e => setBorder(e.target.value)}
                  style={selectStyle}
                  disabled={filterLoading}
                >
                  <option value="">{t('rateFinderAll')}</option>
                  {borderOptions.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              {/* POD */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--ink-3)' }}>
                  {t('rateFinderPod')}
                </label>
                <select
                  value={pod}
                  onChange={e => setPod(e.target.value)}
                  style={selectStyle}
                  disabled={filterLoading}
                >
                  <option value="">{t('rateFinderAll')}</option>
                  {podOptions.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              {/* Owner */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--ink-3)' }}>
                  {t('rateFinderOwner')}
                </label>
                <div className="flex gap-2">
                  {(['', 'SOC', 'COC'] as const).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setOwner(v)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                      style={{
                        background:  owner === v ? 'var(--brand)' : 'var(--card)',
                        color:       owner === v ? '#fff'         : 'var(--ink-3)',
                        borderColor: owner === v ? 'var(--brand)' : 'var(--line)',
                      }}
                    >
                      {v || t('rateFinderAll')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Month */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--ink-3)' }}>
                  {t('rateFinderMonth')}
                </label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  style={selectStyle}
                >
                  {MONTH_COLS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search button */}
            <div className="flex justify-end mt-3">
              <button
                type="button"
                onClick={() => void handleSearch()}
                disabled={loading || filterLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                style={{ background: 'var(--brand)', color: '#fff' }}
                onMouseEnter={e => !loading && (e.currentTarget.style.filter = 'brightness(1.1)')}
                onMouseLeave={e => (e.currentTarget.style.filter = '')}
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                {t('rateFinderSearch')}
              </button>
            </div>
          </div>

          {/* Results */}
          {searched && (
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
            >
              {/* Results header */}
              <div
                className="flex items-center justify-between px-4 py-2.5 border-b"
                style={{ borderColor: 'var(--line)' }}
              >
                <span className="text-xs font-semibold" style={{ color: 'var(--ink-3)' }}>
                  총 {results.length}건
                </span>
                {results.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all"
                    style={{ color: 'var(--brand)', borderColor: 'var(--brand)40' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--brand)10')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Download size={12} />
                    {t('rateFinderDownload')}
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--ink-4)' }} />
                </div>
              ) : results.length === 0 ? (
                <div className="flex justify-center py-10">
                  <p className="text-sm" style={{ color: 'var(--ink-4)' }}>
                    {t('rateFinderEmpty')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: 'var(--chat-bg)', borderBottom: '1px solid var(--line)' }}>
                        {['대리점', 'Mode', 'POL', 'Loading', 'Border', 'POD', 'Type', 'Owner', `${monthMeta.label} 운임`, 'L/Time'].map(h => (
                          <th
                            key={h}
                            className="px-3 py-2 text-left font-semibold whitespace-nowrap"
                            style={{ color: 'var(--ink-3)' }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((row, i) => {
                        const rate = row[monthMeta.key] as number | null
                        return (
                          <tr
                            key={row.id}
                            style={{
                              borderBottom: '1px solid var(--line)',
                              background:   i % 2 === 0 ? 'transparent' : 'var(--chat-bg)',
                            }}
                          >
                            <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: 'var(--ink)' }}>
                              {row.agent ?? '—'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--ink)' }}>
                              {row.mode ?? '—'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--ink-3)' }}>
                              {row.pol ?? '—'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--ink-3)' }}>
                              {row.loading ?? '—'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--ink-3)' }}>
                              {row.border ?? '—'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--ink)' }}>
                              {row.pod ?? '—'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--ink-3)' }}>
                              {row.type ?? '—'}
                            </td>
                            <td className="px-3 py-2" style={{ color: 'var(--ink-3)' }}>
                              {row.owner
                                ? <span
                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                    style={{
                                      background: row.owner === 'SOC' ? '#3B82F610' : '#F59E0B10',
                                      color:      row.owner === 'SOC' ? '#3B82F6'   : '#F59E0B',
                                    }}
                                  >{row.owner}</span>
                                : '—'}
                            </td>
                            <td className="px-3 py-2 font-bold whitespace-nowrap" style={{ color: 'var(--brand)' }}>
                              {rate != null ? `$${rate.toLocaleString()}` : '—'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--ink-3)' }}>
                              {row.ltime || '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
