import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Newspaper, RefreshCw, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { DashboardCard } from './DashboardCard'

// ── Types ────────────────────────────────────────────────────────
interface NewsItem { pNum: string; title: string; url: string; date: string | null }
interface NewsData  { items: NewsItem[]; fetchedAt: string }

// ── Cache ────────────────────────────────────────────────────────
const CACHE_KEY = 'mtl_dashboard_news_v1'
const CACHE_TTL = 6 * 60 * 60 * 1000 // 6 h

function loadCache(): NewsData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts }: { data: NewsData; ts: number } = JSON.parse(raw)
    return Date.now() - ts < CACHE_TTL ? data : null
  } catch { return null }
}

function saveCache(d: NewsData) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: d, ts: Date.now() })) }
  catch { /* storage quota */ }
}

// ── NewsRow ───────────────────────────────────────────────────────
function NewsRow({ item, last }: { item: NewsItem; last: boolean }) {
  // Display date as MM.DD HH:mm  → e.g. "04.30 22:00"
  const datePart = item.date
    ? item.date.slice(5).replace(' ', ' ').replace('-', '.')  // "MM.DD HH:MM"
    : null

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start justify-between gap-3 py-2.5 group"
      style={{ borderBottom: last ? 'none' : '1px solid var(--line)' }}
    >
      <span
        className="text-[12px] leading-snug flex-1 group-hover:underline"
        style={{ color: 'var(--ink)', textUnderlineOffset: 2 }}
      >
        {item.title}
      </span>
      {datePart && (
        <span className="text-[10px] flex-shrink-0 mt-0.5 tabular-nums" style={{ color: 'var(--ink-4)' }}>
          {datePart}
        </span>
      )}
    </a>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5 py-1">
      {[100, 85, 90, 75, 95].map((w, i) => (
        <div key={i} className="h-4 rounded animate-pulse" style={{ background: 'var(--bg-primary)', width: `${w}%` }} />
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────
export function NewsCard() {
  const { t } = useTranslation()
  const cached = loadCache()
  const [data,     setData]     = useState<NewsData | null>(cached)
  const [loading,  setLoading]  = useState<boolean>(!cached)
  const [error,    setError]    = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: res, error: fnErr } = await supabase.functions.invoke<NewsData>('dashboard-data', {
        body: { type: 'news' },
      })
      if (fnErr) throw new Error(fnErr.message)
      if (!res)  throw new Error('empty response')
      saveCache(res)
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!cached) load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const items = data?.items ?? []

  return (
    <DashboardCard title={t('dashNews')} icon={Newspaper} className="h-full">
      {/* Source + refresh row */}
      <div
        className="flex items-center justify-between mb-1 pb-2"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        <a
          href="https://www.ksg.co.kr"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 transition-opacity hover:opacity-70"
          style={{ color: 'var(--ink-4)' }}
        >
          <ExternalLink size={10} />
          <span className="text-[10px]">코리아쉬핑가제트 · ksg.co.kr</span>
        </a>
        <button
          onClick={load}
          disabled={loading}
          className="p-0.5 rounded transition-opacity hover:opacity-60 disabled:opacity-30"
          style={{ color: 'var(--ink-4)' }}
          title={t('dashNewsRetry')}
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Content */}
      {loading && !data ? (
        <Skeleton />
      ) : error && !data ? (
        <div className="flex flex-col items-center py-6 gap-2">
          <p className="text-[11px]" style={{ color: 'var(--ink-4)' }}>{t('dashNewsError')}</p>
          <button
            onClick={load}
            className="text-[11px] font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--brand)' }}
          >
            {t('dashNewsRetry')}
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-[11px] py-4 text-center" style={{ color: 'var(--ink-4)' }}>
          {t('dashNewsEmpty')}
        </p>
      ) : (
        <>
          <div className="overflow-y-auto flex-1 min-h-0">
          {items.map((item, idx) => (
            <NewsRow key={item.pNum} item={item} last={idx === items.length - 1} />
          ))}

          </div>
        </>
      )}
    </DashboardCard>
  )
}
