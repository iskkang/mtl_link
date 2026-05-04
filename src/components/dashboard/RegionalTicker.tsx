import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface FbxItem { code: string; route: string; value: string; change: string }

const CACHE_KEY = 'mtl_ticker_fbx_v1'
const CACHE_TTL = 6 * 60 * 60 * 1000 // 6h — FBX는 주 1회 갱신

function loadCache(): FbxItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts }: { data: FbxItem[]; ts: number } = JSON.parse(raw)
    return Date.now() - ts < CACHE_TTL ? data : null
  } catch { return null }
}

function changeColor(change: string): string {
  if (change.startsWith('+')) return '#22c55e'
  if (change.startsWith('-')) return '#ef4444'
  return 'var(--ink-4)'
}

export function RegionalTicker() {
  const [items, setItems] = useState<FbxItem[]>(loadCache() ?? [])

  useEffect(() => {
    if (items.length > 0) return
    supabase.functions.invoke<{ data: FbxItem[] }>('dashboard-data', { body: { type: 'fbx' } })
      .then(({ data: res }) => {
        if (!res?.data?.length) return
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: res.data, ts: Date.now() }))
        setItems(res.data)
      })
      .catch(() => { /* silent — no data to show */ })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (items.length === 0) return null

  // Duplicate for seamless infinite loop
  const tickerItems = [...items, ...items]
  const duration = `${items.length * 6}s`

  return (
    <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
      {/* Label */}
      <div className="flex items-center gap-1.5 flex-shrink-0 pl-1">
        <TrendingUp size={11} style={{ color: 'var(--ink-4)' }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
          FBX 운임지수
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 flex-shrink-0" style={{ background: 'var(--line)' }} />

      {/* Scrolling ticker */}
      <div className="flex-1 overflow-hidden">
        <div
          className="animate-ticker flex items-center whitespace-nowrap"
          style={{ animationDuration: duration }}
        >
          {tickerItems.map((item, i) => {
            const color = changeColor(item.change)
            return (
              <span key={i} className="inline-flex items-center gap-1.5 px-5">
                <span className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--ink-3)' }}>
                  {item.code}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>
                  {item.route}
                </span>
                <span className="text-[12px] font-bold tabular-nums" style={{ color: 'var(--ink-2)' }}>
                  {item.value}
                </span>
                <span className="text-[10px] font-semibold tabular-nums" style={{ color }}>
                  {item.change}
                </span>
                <span className="text-[10px] pl-3" style={{ color: 'var(--line)' }}>|</span>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
