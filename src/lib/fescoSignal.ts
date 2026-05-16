/**
 * FESCO booking signal computation (v1).
 *
 * Rule:
 *   - gray:   status REJECTED / COMPLETE / COMPLETED
 *   - blue:   status ACTIVE + external_1c_status = "В работе" (any spacing/case)
 *             → known holding, no time-based escalation
 *   - green:  status ACTIVE + Выполняется + elapsedDays <= greenUntilDays
 *   - yellow: status ACTIVE + Выполняется + greenUntilDays < elapsedDays <= redAfterDays
 *   - red:    status ACTIVE + Выполняется + elapsedDays > redAfterDays
 *
 * elapsedDays = days since fesco_created_at (floor).
 * region      = country extracted from last segment's locAdditionalNameLatinTo.
 *
 * Computed UI-side. Does NOT mutate DB or API response.
 */

export type FescoSignal = 'green' | 'yellow' | 'red' | 'blue' | 'gray'

export interface FescoSignalResult {
  signal: FescoSignal
  region: string
  elapsedDays: number | null
}

export const FESCO_REGION_THRESHOLDS = {
  Russia:     { greenUntilDays: 25, redAfterDays: 32 },
  Belarus:    { greenUntilDays: 27, redAfterDays: 34 },
  Kazakhstan: { greenUntilDays: 32, redAfterDays: 42 },
  Uzbekistan: { greenUntilDays: 35, redAfterDays: 45 },
  Other:      { greenUntilDays: 35, redAfterDays: 45 },
} as const

export type FescoRegion = keyof typeof FESCO_REGION_THRESHOLDS

/**
 * Extract destination region from segments.
 * Uses the segment with the largest segmentOrder.
 */
export function getFescoRegion(segments: unknown): FescoRegion {
  if (!Array.isArray(segments) || segments.length === 0) return 'Other'

  const sorted = [...segments].sort(
    (a, b) => (b?.segmentOrder ?? 0) - (a?.segmentOrder ?? 0)
  )
  const last = sorted[0]
  const raw: string = last?.locAdditionalNameLatinTo ?? ''
  const country = raw.split(',').pop()?.trim().toLowerCase() ?? ''

  if (country.includes('belarus')) return 'Belarus'
  if (country.includes('uzbekistan')) return 'Uzbekistan'
  if (country.includes('kazakhstan')) return 'Kazakhstan'
  if (country.includes('russian federation') || country === 'russia') return 'Russia'
  return 'Other'
}

/**
 * Normalize Russian status text for tolerant matching.
 *   "В работе"  → "вработе"
 *   "ВРаботе"   → "вработе"
 *   "в работе"  → "вработе"
 *   "Выполняется" → "выполняется"
 */
function normalizeStatusText(s?: string | null): string {
  return (s ?? '').replace(/\s+/g, '').toLowerCase()
}

function daysSince(iso?: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (isNaN(t)) return null
  // Defensive: future timestamps or timezone artifacts can produce negatives.
  // Clamp them to 0 days elapsed to avoid displaying negative elapsed days.
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}

export interface FescoSignalInput {
  status?: string | null
  external_1c_status?: string | null
  segments?: unknown
  fesco_created_at?: string | null
}

export function getFescoSignal(order: FescoSignalInput): FescoSignalResult {
  const status = (order.status ?? '').toUpperCase()
  if (status === 'REJECTED' || status === 'COMPLETE' || status === 'COMPLETED') {
    return { signal: 'gray', region: 'Other', elapsedDays: null }
  }

  const norm = normalizeStatusText(order.external_1c_status)
  const region = getFescoRegion(order.segments)

  // Known holding — independent of time.
  if (norm === 'вработе') {
    return { signal: 'blue', region, elapsedDays: daysSince(order.fesco_created_at) }
  }

  // Anything other than Выполняется is treated as gray (safety net).
  if (norm !== 'выполняется') {
    return { signal: 'gray', region, elapsedDays: null }
  }

  const elapsedDays = daysSince(order.fesco_created_at)
  if (elapsedDays === null) {
    return { signal: 'gray', region, elapsedDays: null }
  }

  const t = FESCO_REGION_THRESHOLDS[region]
  if (elapsedDays <= t.greenUntilDays) return { signal: 'green',  region, elapsedDays }
  if (elapsedDays <= t.redAfterDays)   return { signal: 'yellow', region, elapsedDays }
  return { signal: 'red', region, elapsedDays }
}

/**
 * UI-side translation of FESCO Russian display status.
 * Uses the same normalization as getFescoSignal() to ensure consistent
 * matching even when source values have spacing or casing variations
 * (e.g. "В работе ", "В   работе", "вработе").
 * DB / API values are NOT touched.
 */
export function translateFescoStatusText(value?: string | null): string {
  if (!value) return '—'

  const normalized = normalizeStatusText(value)

  const normalizedMap: Record<string, string> = {
    'выполняется': 'In progress',
    'выполнено': 'Completed',
    'завершено': 'Completed',
    'отклонено': 'Rejected',
    'отклонена': 'Rejected',
    'отменено': 'Cancelled',
    'отменена': 'Cancelled',
    'черновик': 'Draft',
    'новый': 'New',
    'вработе': 'On hold (in review)',
  }

  return normalizedMap[normalized] || value
}

/**
 * Inline-style color tokens for the FESCO signal dot + label.
 * Uses hex literals (not Tailwind classes) so the styles cannot be
 * purged at build time and there is zero dynamic class composition.
 */
export const SIGNAL_COLOR: Record<FescoSignal, {
  dotBg:   string
  dotRing: string
  text:    string
  pulse:   boolean
  label:   string
}> = {
  green:  { dotBg: '#0d9488', dotRing: '#ecfdf5', text: '#0d9488', pulse: false, label: 'On track'   },
  yellow: { dotBg: '#d97706', dotRing: '#fef3c7', text: '#d97706', pulse: false, label: 'Watch'      },
  red:    { dotBg: '#dc2626', dotRing: '#fee2e2', text: '#dc2626', pulse: true,  label: 'Delay risk' },
  blue:   { dotBg: '#0284c7', dotRing: '#e0f2fe', text: '#0284c7', pulse: false, label: 'On hold'    },
  gray:   { dotBg: '#94a3b8', dotRing: '#f1f5f9', text: '#64748b', pulse: false, label: '—'          },
}
