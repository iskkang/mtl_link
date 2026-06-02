import { createClient } from '@supabase/supabase-js'
import type { ReportProfile, CanonicalRow } from './report-profiles.js'

type SupabaseClient = ReturnType<typeof createClient>

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`
}

function daysBetween(since: string | null | undefined): number | null {
  if (!since) return null
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const sinceDate = new Date(since)
  sinceDate.setUTCHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - sinceDate.getTime()) / 86_400_000)
}

function getTcrDisplayValue(
  src:    string,
  row:    Record<string, unknown>,
  cbmMap: Map<string, number>,
): string {
  if (src === 'cbm_total') {
    const v = cbmMap.get(String(row.container_no ?? ''))
    return v != null ? v.toFixed(2) : '—'
  }
  if (src === 'eta_final') return fmtDate(row.eta_final as string | null)
  const v = row[src]
  if (v == null || String(v).trim() === '') return '—'
  return String(v)
}

function getFescoDisplayValue(src: string, row: Record<string, unknown>): string {
  if (src === 'bills') {
    const bills = row.bills
    if (Array.isArray(bills)) return bills.join(', ') || '—'
    return '—'
  }
  if (src === 'planned_destination_date') return fmtDate(row.planned_destination_date as string | null)
  const v = row[src]
  if (v == null || String(v).trim() === '') return '—'
  return String(v)
}

async function loadTcrRows(profile: ReportProfile, supabase: SupabaseClient): Promise<CanonicalRow[]> {
  const { data: ctrs, error } = await supabase
    .from('tcr_containers_current')
    .select(
      'container_no, customer_list, origin, destination, transport_mode, ' +
      'current_location, current_location_raw, current_location_since, eta_final',
    )
    .eq('file_type', profile.fileType!)
    .eq('arrived_yn', false)

  if (error) throw new Error(`TCR load error (${profile.reportKey}): ${error.message}`)

  const rows = (ctrs ?? []) as Record<string, unknown>[]
  const keys = rows.map(r => String(r.container_no ?? '')).filter(Boolean)

  if (keys.length === 0) return []

  // Open alerts (batch)
  const { data: alertRows } = await supabase
    .from('tcr_risk_alerts')
    .select('container_no, severity, alert_type')
    .in('container_no', keys)
    .eq('status', 'Open')
    .order('created_at', { ascending: false })

  type AlertRow = { container_no: string; severity: string; alert_type: string }
  const alertMap = new Map<string, AlertRow>()
  for (const a of (alertRows ?? []) as AlertRow[]) {
    if (!alertMap.has(a.container_no)) alertMap.set(a.container_no, a)
  }

  // CBM totals (only when displayCols includes cbm_total)
  const needsCbm = profile.displayCols.some(c => c.src === 'cbm_total')
  const cbmMap   = new Map<string, number>()
  if (needsCbm) {
    const { data: cbmRows } = await supabase
      .from('tcr_shipment_items')
      .select('container_no, cbm')
      .in('container_no', keys)
    for (const r of (cbmRows ?? []) as { container_no: string; cbm: number | null }[]) {
      if (r.cbm != null) cbmMap.set(r.container_no, (cbmMap.get(r.container_no) ?? 0) + Number(r.cbm))
    }
  }

  return rows
    .filter(r => r.container_no)
    .map(r => {
      const containerNo   = String(r.container_no)
      const currentLocation =
        (r.current_location       ? String(r.current_location)       : null) ??
        (r.current_location_raw   ? String(r.current_location_raw)   : null) ??
        (r.origin                 ? String(r.origin)                 : null) ??
        '—'

      const daysAtLocation = daysBetween(r.current_location_since as string | null)
      const stalled        = daysAtLocation != null && daysAtLocation >= 3

      const display = profile.displayCols.map(col => ({
        label: col.label,
        value: getTcrDisplayValue(col.src, r, cbmMap),
      }))

      const alertRow = alertMap.get(containerNo)
      const alert: CanonicalRow['alert'] = alertRow
        ? {
            level: alertRow.severity === 'Critical' ? 'red' : 'yellow',
            note:  alertRow.alert_type || undefined,
          }
        : undefined

      return { rowKey: containerNo, display, currentLocation, daysAtLocation, stalled, alert }
    })
}

async function loadFescoRows(profile: ReportProfile, supabase: SupabaseClient): Promise<CanonicalRow[]> {
  const { data: ctrs, error } = await supabase
    .from('fesco_container_tracking_current')
    .select(
      'container_number, owner_ship, bills, current_segment_type, ' +
      'current_from, current_to, departure_date, planned_destination_date, ' +
      'status, alert_level, alert_reason, unavailable',
    )
    .neq('status', 'completed')

  if (error) throw new Error(`FESCO load error: ${error.message}`)

  const rows = (ctrs ?? []) as Record<string, unknown>[]
  const keys = rows.map(r => String(r.container_number ?? '')).filter(Boolean)

  if (keys.length === 0) return []

  // Latest open alert per container from fesco_alerts
  const { data: alertRows } = await supabase
    .from('fesco_alerts')
    .select('container_number, severity, message')
    .in('container_number', keys)
    .eq('status', 'open')
    .order('last_seen_at', { ascending: false })

  type FescoAlert = { container_number: string; severity: string; message: string }
  const alertMap = new Map<string, FescoAlert>()
  for (const a of (alertRows ?? []) as FescoAlert[]) {
    if (!alertMap.has(a.container_number)) alertMap.set(a.container_number, a)
  }

  return rows
    .filter(r => r.container_number)
    .map(r => {
      const containerNo = String(r.container_number)
      const unavailable = Boolean(r.unavailable)

      let currentLocation: string
      if (unavailable) {
        currentLocation = '추적불가'
      } else if (r.current_from && r.current_to) {
        const prefix  = r.current_segment_type ? `${r.current_segment_type}: ` : ''
        currentLocation = `${prefix}${r.current_from} → ${r.current_to}`
      } else if (r.current_to) {
        currentLocation = String(r.current_to)
      } else if (r.current_from) {
        currentLocation = String(r.current_from)
      } else {
        currentLocation = '—'
      }

      const daysAtLocation = !unavailable ? daysBetween(r.departure_date as string | null) : null
      const stalled        = daysAtLocation != null && daysAtLocation >= 3

      const display = profile.displayCols.map(col => ({
        label: col.label,
        value: getFescoDisplayValue(col.src, r),
      }))

      // Alert: prefer alert_level from main table, fall back to fesco_alerts
      let alert: CanonicalRow['alert'] | undefined
      const alertLevel = String(r.alert_level ?? '').toLowerCase()
      if (alertLevel === 'red' || alertLevel === 'yellow') {
        const note = alertMap.get(containerNo)?.message ?? (r.alert_reason ? String(r.alert_reason) : undefined)
        alert = { level: alertLevel as 'red' | 'yellow', note }
      } else {
        const fa = alertMap.get(containerNo)
        if (fa) {
          const lvl = fa.severity?.toLowerCase() === 'critical' ? 'red' as const : 'yellow' as const
          alert = { level: lvl, note: fa.message }
        }
      }

      return { rowKey: containerNo, display, currentLocation, daysAtLocation, stalled, alert }
    })
}

export async function loadRows(profile: ReportProfile, supabase: SupabaseClient): Promise<CanonicalRow[]> {
  if (profile.source === 'fesco') return loadFescoRows(profile, supabase)
  return loadTcrRows(profile, supabase)
}
