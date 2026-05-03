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
    kcciData?: RawSection
    scfiData?: RawSection
    ccfiData?: RawSection
    graphData?: RawPoint[]
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
  const BASE = 'https://www.ksg.co.kr/news/'
  const res = await fetch(`${BASE}main_news.jsp`, {
    headers: { 'User-Agent': 'MTLLink/1.0', Accept: 'text/html' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`upstream ${res.status}`)

  const html = await res.text()
  const seen  = new Set<string>()
  const items: NewsItem[] = []

  // Each <li> block contains 2-3 <a> with the same pNum (img, blank, title)
  const liRe = /<li>([\s\S]*?)<\/li>/g
  let m: RegExpExecArray | null

  while ((m = liRe.exec(html)) !== null && items.length < limit) {
    const block = m[1]

    // Require a pNum link
    const pNumMatch = block.match(/href="main_newsView\.jsp\?pNum=(\d+)"/)
    if (!pNumMatch) continue
    const pNum = pNumMatch[1]
    if (seen.has(pNum)) continue
    seen.add(pNum)

    // Strip thumbnail <a><img ...></a> blocks so we don't pick up empty/img-only tags
    const stripped = block.replace(/<a[^>]*>\s*<img[^>]*>\s*<\/a>/g, '')

    // Find the a tag with real text (not empty, not just whitespace)
    const titleMatch = stripped.match(
      /<a[^>]+href="main_newsView\.jsp\?pNum=\d+"[^>]*>\s*([^\s<][^<]{3,200}?)\s*<\/a>/,
    )
    if (!titleMatch) continue
    const title = titleMatch[1].trim()
    if (title.length < 5) continue

    // Date: <span>YYYY-MM-DD HH:MM</span>
    const dateMatch = block.match(/<span>(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})<\/span>/)
    const date = dateMatch?.[1] ?? null

    items.push({ pNum, title, url: `${BASE}main_newsView.jsp?pNum=${pNum}`, date })
  }

  return { items, fetchedAt: new Date().toISOString() }
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
    if (type === 'indices') return json(await fetchIndices())
    if (type === 'news')    return json(await fetchNews(10))
    return json({ error: 'unknown type' }, 400)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[dashboard-data/${type}]`, msg)
    return json({ error: msg }, 500)
  }
})
