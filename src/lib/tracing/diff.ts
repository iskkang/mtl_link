import { createHash } from 'crypto'
import type { CanonicalRow } from './report-profiles.js'

export function rowHash(row: CanonicalRow): string {
  // Only stable, meaningful fields — exclude polling timestamps.
  const stable = {
    display:         row.display.map(d => `${d.label}=${d.value}`).join('|'),
    currentLocation: row.currentLocation,
    stalled:         row.stalled,
    alertLevel:      row.alert?.level ?? '',
  }
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex')
}
