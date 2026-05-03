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

// ── Indices (surff.kr) ───────────────────────────────────────────

type RawItem    = { description?: string; currentIndex?: number; weeklyGrowth?: number }
type RawSection = { currentIndexDate?: string; data?: RawItem[] }
type RawPoint   = Record<string, unknown>

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

async function fetchIndices() {
  const today = new Date()
  const sixMonthsAgo = new Date(today)
  sixMonthsAgo.setMonth(today.getMonth() - 6)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const apiUrl = `https://cms.surff.kr/api/freight/indicator?startDate=${fmt(sixMonthsAgo)}&endDate=${fmt(today)}`
  const res = await fetch(apiUrl, {
    headers: { 'User-Agent': 'MTLLink/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`upstream ${res.status}`)

  const raw = await res.json() as { resultObject?: Record<string, unknown> }
  const obj = (raw.resultObject ?? raw) as {
    kcciData?: RawSection; scfiData?: RawSection; ccfiData?: RawSection; graphData?: RawPoint[]
  }

  const kcciItem = findComposite(obj.kcciData?.data)
  const scfiItem = findComposite(obj.scfiData?.data)
  const ccfiItem = findComposite(obj.ccfiData?.data)

  return {
    kcci: kcciItem ? { current: kcciItem.currentIndex ?? null, weeklyGrowth: kcciItem.weeklyGrowth ?? null, date: obj.kcciData?.currentIndexDate ?? null } : null,
    scfi: scfiItem ? { current: scfiItem.currentIndex ?? null, weeklyGrowth: scfiItem.weeklyGrowth ?? null, date: obj.scfiData?.currentIndexDate ?? null } : null,
    ccfi: ccfiItem ? { current: ccfiItem.currentIndex ?? null, weeklyGrowth: ccfiItem.weeklyGrowth ?? null, date: obj.ccfiData?.currentIndexDate ?? null } : null,
    graphData:  normGraphData(obj.graphData ?? []),
    fetchedAt:  new Date().toISOString(),
  }
}

// ── News (ksg.co.kr) ─────────────────────────────────────────────

interface NewsItem { pNum: string; title: string; url: string; date: string | null }

async function fetchNews(limit = 10): Promise<{ items: NewsItem[]; fetchedAt: string }> {
  const BASE = 'https://www.ksg.co.kr'
  const res = await fetch(`${BASE}/news/main_news.jsp`, {
    headers: { 'User-Agent': 'MTLLink/1.0', Accept: 'text/html' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`upstream ${res.status}`)

  const html = await res.text()
  const seen  = new Set<string>()
  const items: NewsItem[] = []

  const liRe = /<li>([\s\S]*?)<\/li>/g
  let m: RegExpExecArray | null

  while ((m = liRe.exec(html)) !== null && items.length < limit) {
    const block = m[1]
    const pNumMatch = block.match(/href="\/news\/main_newsView\.jsp\?pNum=(\d+)"/)
    if (!pNumMatch) continue
    const pNum = pNumMatch[1]
    if (seen.has(pNum)) continue
    seen.add(pNum)

    const stripped = block.replace(/<a[^>]*>\s*<img[^>]*\/?\s*>\s*<\/a>/g, '')
    const titleMatch = stripped.match(
      /<a[^>]+href="\/news\/main_newsView\.jsp\?pNum=\d+"[^>]*>\s*([^\s<][^<]{3,200}?)\s*<\/a>/,
    )
    if (!titleMatch) continue
    const title = titleMatch[1].trim()
    if (title.length < 5) continue

    items.push({ pNum, title, url: `${BASE}/news/main_newsView.jsp?pNum=${pNum}`, date: null })
  }

  return { items, fetchedAt: new Date().toISOString() }
}

// ── Ports (EconDB) ───────────────────────────────────────────────

interface PortEntry { port: string; current: number; previous: number; yoyPct: number }

async function fetchPorts(): Promise<{ ports: PortEntry[]; title: string; fetchedAt: string }> {
  const empty = { ports: [], title: '', fetchedAt: new Date().toISOString() }
  try {
    const res = await fetch('https://www.econdb.com/widgets/top-port-comparison/data/', {
      headers: {
        'User-Agent': 'MTLLink/1.0',
        Accept:       'application/json',
        Referer:      'https://www.econdb.com',
        Origin:       'https://www.econdb.com',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) { console.error(`[ports] upstream ${res.status}`); return empty }

    const raw = await res.json() as { plots?: Array<{ title?: string; data?: unknown[] }> }
    const plot = raw.plots?.[0]

    const ports: PortEntry[] = ((plot?.data ?? []) as Array<unknown>)
      .map(row => {
        if (Array.isArray(row)) {
          const [port, current, previous] = row as [string, number, number]
          const yoyPct = previous ? +((current - previous) / previous * 100).toFixed(1) : 0
          return { port: String(port), current: Number(current), previous: Number(previous), yoyPct }
        }
        return null
      })
      .filter((e): e is PortEntry => e !== null && !isNaN(e.current))
      .sort((a, b) => b.current - a.current)

    return { ports, title: String(plot?.title ?? ''), fetchedAt: new Date().toISOString() }
  } catch (e) {
    console.error('[ports] fetch error:', e)
    return empty
  }
}

// ── Trade (EconDB) ───────────────────────────────────────────────

interface TradePoint { date: string; total: number }

async function fetchTrade(): Promise<{ points: TradePoint[]; wowPct: number | null; fetchedAt: string }> {
  const empty = { points: [], wowPct: null, fetchedAt: new Date().toISOString() }
  try {
    const res = await fetch(
      'https://www.econdb.com/widgets/global-trade/data/?type=export&net=0&transform=0',
      {
        headers: {
          'User-Agent': 'MTLLink/1.0',
          Accept:       'application/json',
          Referer:      'https://www.econdb.com',
          Origin:       'https://www.econdb.com',
        },
        signal: AbortSignal.timeout(8000),
      },
    )
    if (!res.ok) { console.error(`[trade] upstream ${res.status}`); return empty }

    const raw = await res.json() as { plots?: Array<{ series?: string[]; data?: unknown[] }> }
    const plot = raw.plots?.[0]
    const series = (plot?.series ?? []) as string[]
    const totalIdx = series.findIndex(s => /^total$/i.test(s))

    const points: TradePoint[] = ((plot?.data ?? []) as Array<unknown[]>)
      .map(row => {
        const date  = String(row[0])
        const total = totalIdx >= 0
          ? Number(row[totalIdx + 1])
          : (row.slice(1) as number[]).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0)
        return { date, total }
      })
      .filter(p => p.date && !isNaN(p.total) && p.total > 0)
      .slice(-52)

    const latest = points[points.length - 1]
    const prev   = points[points.length - 2]
    const wowPct = (latest && prev && prev.total)
      ? +((latest.total - prev.total) / prev.total * 100).toFixed(2)
      : null

    return { points, wowPct, fetchedAt: new Date().toISOString() }
  } catch (e) {
    console.error('[trade] fetch error:', e)
    return empty
  }
}

// ── Disasters (GDACS) ────────────────────────────────────────────

interface DisasterEvent {
  id: string; type: string; name: string; country: string
  alertLevel: string; fromDate: string; severity: string | null
}

async function fetchDisasters(): Promise<{ events: DisasterEvent[]; fetchedAt: string }> {
  const res = await fetch(
    'https://www.gdacs.org/gdacsapi/api/events/geteventlist/ARCHIVE?eventlist=EQ;TC;FL;VO;WF',
    {
      headers: { 'User-Agent': 'MTLLink/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    },
  )
  if (!res.ok) throw new Error(`upstream ${res.status}`)

  const raw = await res.json() as { features?: Array<{ properties: Record<string, unknown> }> }

  const events: DisasterEvent[] = (raw.features ?? [])
    .filter(f => ['TC', 'EQ'].includes(String(f.properties.eventtype ?? '')))
    .slice(0, 4)
    .map(f => {
      const p   = f.properties
      const sev = p.severitydata as { severity?: number; severityunit?: string } | null
      return {
        id:         String(p.eventid ?? p.episodeid ?? ''),
        type:       String(p.eventtype ?? ''),
        name:       String(p.name ?? p.eventname ?? ''),
        country:    String(p.country ?? ''),
        alertLevel: String(p.alertlevel ?? ''),
        fromDate:   String(p.fromdate ?? '').slice(0, 10),
        severity:   sev?.severity != null ? `${sev.severity}${sev.severityunit ?? ''}` : null,
      }
    })

  return { events, fetchedAt: new Date().toISOString() }
}

// ── Router ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  let type = 'indices'
  try {
    const body = await req.json() as { type?: string }
    type = body.type ?? 'indices'
  } catch { /* GET or no body */ }

  try {
    if (type === 'indices')   return json(await fetchIndices())
    if (type === 'news')      return json(await fetchNews(10))
    if (type === 'ports')     return json(await fetchPorts())
    if (type === 'trade')     return json(await fetchTrade())
    if (type === 'disasters') return json(await fetchDisasters())
    return json({ error: 'unknown type' }, 400)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[dashboard-data/${type}]`, msg)
    return json({ error: msg }, 500)
  }
})
