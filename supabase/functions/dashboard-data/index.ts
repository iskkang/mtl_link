const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

type RawItem = { description?: string; currentIndex?: number; previousIndex?: number; weeklyGrowth?: number }
type RawSection = { currentIndexDate?: string; previousIndexDate?: string; data?: RawItem[] }
type RawPoint  = Record<string, unknown>

function findComposite(data?: RawItem[]): RawItem | null {
  if (!data) return null
  return data.find(d => d.description === '복합지수')
    ?? data.find(d => /composite/i.test(d.description ?? ''))
    ?? null
}

function normGraphData(raw: RawPoint[]): { date: string; kcci: number | null; scfi: number | null; ccfi: number | null }[] {
  const getNum = (p: RawPoint, ...keys: string[]): number | null => {
    for (const k of keys) {
      const v = p[k]
      if (typeof v === 'number') return v
    }
    return null
  }
  return raw
    .map(p => ({
      date: String(p.date ?? p.referenceDate ?? p.searchDate ?? p.baseDate ?? ''),
      kcci: getNum(p, 'kcci', 'kcciIndex', 'kcci_index', 'KCCI'),
      scfi: getNum(p, 'scfi', 'scfiIndex', 'scfi_index', 'SCFI'),
      ccfi: getNum(p, 'ccfi', 'ccfiIndex', 'ccfi_index', 'CCFI'),
    }))
    .filter(p => p.date !== '')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  let type = 'indices'
  try {
    const body = await req.json() as { type?: string }
    type = body.type ?? 'indices'
  } catch { /* GET or no body — use default */ }

  if (type !== 'indices') return json({ error: 'unknown type' }, 400)

  try {
    const today = new Date()
    const sixMonthsAgo = new Date(today)
    sixMonthsAgo.setMonth(today.getMonth() - 6)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)

    const apiUrl = `https://cms.surff.kr/api/freight/indicator?startDate=${fmt(sixMonthsAgo)}&endDate=${fmt(today)}`
    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': 'MTLLink/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return json({ error: `upstream ${res.status}` }, 502)

    const raw = await res.json() as { resultObject?: Record<string, unknown> }
    const obj = (raw.resultObject ?? raw) as {
      kcciData?: RawSection
      scfiData?: RawSection
      ccfiData?: RawSection
      graphData?: RawPoint[]
    }

    const kcciItem = findComposite(obj.kcciData?.data)
    const scfiItem = findComposite(obj.scfiData?.data)
    const ccfiItem = findComposite(obj.ccfiData?.data)

    return json({
      kcci: kcciItem ? {
        current:      kcciItem.currentIndex  ?? null,
        weeklyGrowth: kcciItem.weeklyGrowth  ?? null,
        date:         obj.kcciData?.currentIndexDate ?? null,
      } : null,
      scfi: scfiItem ? {
        current:      scfiItem.currentIndex  ?? null,
        weeklyGrowth: scfiItem.weeklyGrowth  ?? null,
        date:         obj.scfiData?.currentIndexDate ?? null,
      } : null,
      ccfi: ccfiItem ? {
        current:      ccfiItem.currentIndex  ?? null,
        weeklyGrowth: ccfiItem.weeklyGrowth  ?? null,
        date:         obj.ccfiData?.currentIndexDate ?? null,
      } : null,
      graphData:  normGraphData(obj.graphData ?? []),
      fetchedAt:  new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[dashboard-data]', msg)
    return json({ error: msg }, 500)
  }
})
