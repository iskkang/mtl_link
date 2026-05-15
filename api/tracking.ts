import type { IncomingMessage, ServerResponse } from 'node:http'
import { trackContainer, FescoApiError } from '../src/lib/fesco-tracker'
import type { CommonTracking } from '../src/lib/fesco-tracker'

// Vercel: max execution time 15s
export const config = { maxDuration: 15 }

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const rawUrl = req.url ?? '/'
  const url = new URL(rawUrl, 'http://localhost')

  // Accept ?numbers=A,B or ?numbers=A&numbers=B
  const nums = url.searchParams
    .getAll('numbers')
    .flatMap(n => n.split(','))
    .map(n => n.trim())
    .filter(Boolean)

  if (nums.length === 0) {
    writeJson(res, 400, { error: '`numbers` query param is required' })
    return
  }

  try {
    const results = await Promise.all(nums.map(n => trackContainer(n)))
    const data: CommonTracking[] = results.filter((r): r is CommonTracking => r !== null)

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=600, stale-while-revalidate=1800',
    })
    res.end(JSON.stringify(data))
  } catch (e) {
    const status = e instanceof FescoApiError ? 502 : 500
    const msg = e instanceof Error ? e.message : String(e)
    writeJson(res, status, { error: msg })
  }
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}
