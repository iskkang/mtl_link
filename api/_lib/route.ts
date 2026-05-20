export interface ParsedRoute {
  origin:      string | null
  destination: string | null
}

export function parseRoute(routeLatin: string | null | undefined): ParsedRoute {
  if (!routeLatin?.trim()) return { origin: null, destination: null }
  const segments = routeLatin.split(/\s*-\s*/).map(s => s.trim()).filter(Boolean)
  if (segments.length === 0) return { origin: null, destination: null }
  if (segments.length === 1) return { origin: segments[0], destination: null }
  return { origin: segments[0], destination: segments[segments.length - 1] }
}
