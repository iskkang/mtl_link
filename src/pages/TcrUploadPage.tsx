import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, ArrowLeft, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useIsMobile } from '../hooks/useIsMobile'

/* ── Types ──────────────────────────────────────────────────────────── */
type FileType = 'KR_UZ' | 'CN_UZ' | 'KR_KZ_TRUCK' | 'KR_KG' | 'KR_EU' | 'UNKNOWN'

interface ContainerRow {
  container_no: string
  origin: string | null
  destination: string | null
  transport_mode: string | null
  current_location: string | null
  current_location_raw: string | null
  eta_final: string | null
  ata_final: string | null
  arrived_yn: boolean
  transit_time_days: number | null
}

interface SegmentRow {
  segment_id: string
  container_no: string
  segment_no: number
  segment_name: string | null
  from_location: string | null
  to_location: string | null
  etd: string | null
  atd: string | null
  eta: string | null
  ata: string | null
  is_current_segment: boolean
}

interface ParsedFile {
  file: File
  fileType: FileType
  fileTypeLabel: string
  containers: ContainerRow[]
  segments: SegmentRow[]
  error?: string
}

type SubmitResult = { updated_containers: number; updated_segments: number; errors: string[] }

interface ServerLog {
  id:               number
  uploaded_at:      string
  uploader_ip:      string | null
  file_name:        string
  file_type:        string
  containers_count: number
  segments_count:   number
}

/* ── Helpers ────────────────────────────────────────────────────────── */
const FILE_TYPE_LABELS: Record<FileType, string> = {
  KR_UZ:       'KR→UZ (우즈동흥 한국발)',
  CN_UZ:       'CN→UZ (중국발)',
  KR_KZ_TRUCK: 'KR→KZ Truck',
  KR_KG:       'KR→KG (키르기스스탄)',
  KR_EU:       'KR→EU (폴란드)',
  UNKNOWN:     '알 수 없음',
}

const LOC_MAP: Record<string, string | null> = {
  'JIAYUGUAN,CN':           'Jiayuguan',
  'Jiayuguan,CN':           'Jiayuguan',
  'HAMIDONG,CN':            'Hami',
  'HAMIDONG.CN':            'Hami',
  'hamidong':               'Hami',
  'Kartaly I, YuUR':        'Kartaly',
  'Kartaly I,YuUR':         'Kartaly',
  'Nildy,KZH':              'Nildy',
  'Nildy,KZ':               'Nildy',
  'Xian':                   "Xi'an",
  'XIAN':                   "Xi'an",
  'MALA':                   'Małaszewicze',
  'mala':                   'Małaszewicze',
  'finish':                 'Małaszewicze',
  'Finish':                 'Małaszewicze',
  'FINISH':                 'Małaszewicze',
  'Brest':                  'Brest',
  'BREST':                  'Brest',
  'Dostyk':                 'Dostyk',
  'DOSTYK':                 'Dostyk',
  'DOSTUK':                 'Dostyk',
  'Unloaded':               null,
  'Arived':                 null,
  '3142 km to Brest':       'Brest',
  '4190 km to Brest':       'Brest',
  'waiting for reloading':  'Dostyk',
  'liushuquan':             'Kashgar',
  'linqing':                'Kashgar',
  'shijiazhuangxi':         'Kashgar',
  'ANDIJON':                'Andijan',
  'GANSU':                  'Gansu',
  'Gansu':                  'Gansu',
  'LINHE':                  'Linhe',
  'Linhe':                  'Linhe',
  'linhe':                  'Linhe',
  'YINGSHUIQIAO':           'Yingshuiqiao',
  'Yingshuiqiao':           'Yingshuiqiao',
  'yINGSHUIQIAO':           'Yingshuiqiao',
  'yingshuiqiao':           'Yingshuiqiao',
  'SPIRIDONOVKA':           'Spiridonovka',
  'Spiridonovka':           'Spiridonovka',
  'spiridonovka':           'Spiridonovka',
  'NEGORELOYE':             'Negoreloye',
  'Negoreloye':             'Negoreloye',
  'negoreloye':             'Negoreloye',
  'NIEHARELAYE':            'Nieharelaye',
  'Nieharelaye':            'Nieharelaye',
  'nieharelaye':            'Nieharelaye',
  'ALASHANKOU':             'Alashankou',
  'Alashankou':             'Alashankou',
  'ALASHAN KOU':            'Alashankou',
  'KHORGOS':                'Khorgos',
  'Khorgos':                'Khorgos',
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function normalizeLoc(raw: unknown): string | null {
  const s = str(raw)
  if (!s) return null
  if (Object.prototype.hasOwnProperty.call(LOC_MAP, s)) return LOC_MAP[s]
  return s
}

function xlDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') {
    if (v < 1) return null
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    return d.toISOString().slice(0, 10)
  }
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return null
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    // DD.MM.YYYY
    const m1 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
    if (m1) {
      const y = m1[3].length === 2 ? `20${m1[3]}` : m1[3]
      return `${y}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`
    }
    // MM/DD/YYYY
    const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
    if (m2) {
      const y = m2[3].length === 2 ? `20${m2[3]}` : m2[3]
      return `${y}-${m2[1].padStart(2, '0')}-${m2[2].padStart(2, '0')}`
    }
    return null
  }
  return null
}

function parseTT(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = parseInt(String(v).trim().replace(/[^0-9]/g, ''), 10)
  return !isNaN(n) && n > 0 ? n : null
}

// Returns true when cur_raw indicates the container has been delivered/unloaded
// even if no formal ATA date is recorded (e.g. "Unloaded", "Arived" in status column).
function isTerminalStatus(raw: string): boolean {
  const s = raw.trim().toLowerCase()
  return s === 'unloaded' || s === 'arived' || s === 'arrived'
}

function readSheetRows(wb: XLSX.WorkBook, hint?: string): unknown[][] {
  let name: string | undefined
  if (hint) {
    name = wb.SheetNames.find(n => n.toLowerCase().includes(hint.toLowerCase()))
  }
  if (!name) name = wb.SheetNames[0]
  if (!name) return []
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' }) as unknown[][]
}

function fixCurrentSegments(segments: SegmentRow[]) {
  const byCno = new Map<string, SegmentRow[]>()
  for (const s of segments) {
    const arr = byCno.get(s.container_no) ?? []
    arr.push(s)
    byCno.set(s.container_no, arr)
  }
  for (const segs of byCno.values()) {
    // Reset all — we recalculate from scratch
    for (const s of segs) s.is_current_segment = false

    const sorted = segs.slice().sort((a, b) => a.segment_no - b.segment_no)

    // 1st choice: last segment that has started (atd) but not finished (no ata)
    const inProgress = [...sorted].reverse().find(s => !!s.atd && !s.ata)
    if (inProgress) { inProgress.is_current_segment = true; continue }

    // 2nd choice (all complete or all not started): last segment with any atd
    const lastStarted = [...sorted].reverse().find(s => !!s.atd)
    if (lastStarted) lastStarted.is_current_segment = true
  }
}

/* ── File type detection ────────────────────────────────────────────── */
function detectFileType(wb: XLSX.WorkBook): FileType {
  const sheetNames = wb.SheetNames
  const sheetStr   = sheetNames.join(' ')

  // 1. Sheet structure (most reliable — determined by sheet names)
  if (sheetNames.length === 1 && sheetNames[0] === 'Лист1') return 'KR_UZ'
  if (sheetNames.includes('TCR') && sheetNames.includes('LCL')) return 'CN_UZ'
  if (sheetNames.some(n => n === 'Bishkek' || n === 'ALMATY')) return 'KR_KG'
  if (sheetStr.includes('Bishkek') || sheetStr.includes('ALMATY')) return 'KR_KG'

  // 2. Scan all sheets' header rows as fallback (avoids per-sheet false positives)
  const allText: string[] = []
  for (const sn of sheetNames) {
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sn], { header: 1, raw: false, defval: '' }) as string[][]
    allText.push(...rows.slice(0, 5).flat())
  }
  const h = allText.join(' ')

  if (h.includes('ATA Kashgar'))                               return 'KR_UZ'
  if (h.includes('Dispatching st') || h.includes('ATA kashi')) return 'CN_UZ'
  if (h.includes('STOP BY') && h.includes('ETA F.DEST'))       return 'KR_EU'
  if (h.includes('ATA KHORGOS') && sheetStr.includes('List 1')) return 'KR_KZ_TRUCK'
  if (h.includes('ATA KHORGOS'))                               return 'KR_KZ_TRUCK'
  if (h.includes('ETA BORDER') || h.includes('ATD KZ BORDER')) return 'KR_KG'

  return 'UNKNOWN'
}

/* ── Parsers ────────────────────────────────────────────────────────── */

// KR→UZ: headerRow=0, skipRows=[1], data from row 2
function parseKrUz(wb: XLSX.WorkBook): { containers: ContainerRow[]; segments: SegmentRow[] } {
  const rows = readSheetRows(wb)
  const containers: ContainerRow[] = []
  const segments: SegmentRow[] = []

  for (let ri = 2; ri < rows.length; ri++) {
    const r = rows[ri] as unknown[]
    const cno = str(r[15]).toUpperCase()
    if (!cno) continue

    const origin      = normalizeLoc(r[8])
    const destination = normalizeLoc(r[9])
    const ata_final   = xlDate(r[25])
    const cur_raw     = str(r[28])
    const cur_loc     = normalizeLoc(cur_raw) ?? (ata_final ? destination : null)

    // 컨테이너 번호만 있고 나머지가 모두 비어있으면 진행 전 예정 건 → 스킵
    const hasData = !!(origin || destination || xlDate(r[18]) || xlDate(r[19]) || xlDate(r[20]) || xlDate(r[21]) || xlDate(r[22]) || xlDate(r[23]) || xlDate(r[24]) || ata_final || cur_raw)
    if (!hasData) continue

    containers.push({
      container_no:      cno,
      origin,
      destination,
      transport_mode:    'Rail',
      current_location:  cur_loc,
      current_location_raw: cur_raw || null,
      eta_final:         xlDate(r[24]),
      ata_final,
      arrived_yn:        !!ata_final || isTerminalStatus(cur_raw),
      transit_time_days: parseTT(r[26]),
    })

    const s1atd = xlDate(r[18]); const s1ata = xlDate(r[19])
    const s2atd = xlDate(r[20]); const s2ata = xlDate(r[21])
    const s3etd = xlDate(r[22]); const s3ata = xlDate(r[23])

    segments.push(
      { segment_id: `${cno}-S1`, container_no: cno, segment_no: 1,
        segment_name: `${origin ?? '?'} → Qingdao`, from_location: origin, to_location: 'Qingdao',
        etd: null, atd: s1atd, eta: null, ata: s1ata,
        is_current_segment: !!s1atd && !s1ata },
      { segment_id: `${cno}-S2`, container_no: cno, segment_no: 2,
        segment_name: 'Qingdao → Kashgar', from_location: 'Qingdao', to_location: 'Kashgar',
        etd: null, atd: s2atd, eta: null, ata: s2ata,
        is_current_segment: !!s2atd && !s2ata },
      { segment_id: `${cno}-S3`, container_no: cno, segment_no: 3,
        segment_name: `Kashgar → ${destination ?? '?'}`, from_location: 'Kashgar', to_location: destination,
        etd: s3etd, atd: null, eta: null, ata: s3ata,
        is_current_segment: !!s3etd && !s3ata },
    )
  }

  fixCurrentSegments(segments)
  return { containers, segments }
}

// CN→UZ sub-parser: TCR sheet (header auto-detected around row 2)
function parseCnUzTcr(wb: XLSX.WorkBook): { containers: ContainerRow[]; segments: SegmentRow[] } {
  const sheetName = wb.SheetNames.find(n => n.toUpperCase() === 'TCR')
  if (!sheetName || !wb.Sheets[sheetName]) return { containers: [], segments: [] }
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: '' }) as unknown[][]
  const containers: ContainerRow[] = []
  const segments:   SegmentRow[]   = []

  // Use 'CNTR NO' (not just 'CNTR') to avoid matching title rows like "CNTR ARRIVED"
  let headerIdx = 2
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    if ((rows[i] as unknown[]).map(str).join(' ').toUpperCase().includes('CNTR NO')) { headerIdx = i; break }
  }
  const headers = (rows[headerIdx] as unknown[]).map(v => str(v).replace(/\n/g, ' ').trim())
  const col = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))
  // Collect all ATD / ATA indices in order to distinguish 1st vs 2nd occurrence
  const atdIs = headers.reduce<number[]>((a, h, i) => { if (h.toLowerCase().includes('atd')) a.push(i); return a }, [])
  const ataIs = headers.reduce<number[]>((a, h, i) => { if (h.toLowerCase().includes('ata')) a.push(i); return a }, [])

  const iCno    = col('cntr')
  const iOrigin = col('pol')
  const iPodFd  = col('pod')
  const iAtdPol = col('atd pol') !== -1 ? col('atd pol') : (atdIs[0] ?? -1)
  const iAtaTs  = col('ata t/s') !== -1 ? col('ata t/s') : (ataIs[0] ?? -1)
  const iAtdTs  = col('atd/ts')  !== -1 ? col('atd/ts')  : col('atd t/s') !== -1 ? col('atd t/s') : (atdIs[1] ?? -1)
  const iEtaFd  = col('eta f')
  const iAtaFd  = col('ata f/d') !== -1 ? col('ata f/d') : col('ata f') !== -1 ? col('ata f') : (ataIs[1] ?? -1)
  const iCurLoc = col('current')
  const iTT     = headers.findIndex(h => /t\/t|transit.*time/i.test(h))

  for (let ri = headerIdx + 1; ri < rows.length; ri++) {
    const r   = rows[ri] as unknown[]
    if (iCno === -1) continue
    const cno = str(r[iCno]).toUpperCase()
    if (!cno || !/^[A-Z]{4}\d/.test(cno)) continue

    const ata_final = iAtaFd  !== -1 ? xlDate(r[iAtaFd])  : null
    const cur_raw   = iCurLoc !== -1 ? str(r[iCurLoc])    : ''
    const cur_loc   = normalizeLoc(cur_raw)

    containers.push({
      container_no:         cno,
      origin:               iOrigin !== -1 ? normalizeLoc(r[iOrigin]) : null,
      destination:          iPodFd  !== -1 ? normalizeLoc(r[iPodFd])  : null,
      transport_mode:       'Rail',
      current_location:     cur_loc,
      current_location_raw: cur_raw || null,
      eta_final:            iEtaFd !== -1 ? xlDate(r[iEtaFd]) : null,
      ata_final,
      arrived_yn:           !!ata_final || isTerminalStatus(cur_raw),
      transit_time_days:    iTT !== -1 ? parseTT(r[iTT]) : null,
    })

    segments.push(
      { segment_id: `${cno}-S1`, container_no: cno, segment_no: 1,
        segment_name: 'China → T/S Border', from_location: 'China', to_location: 'T/S Border',
        etd: null, atd: iAtdPol !== -1 ? xlDate(r[iAtdPol]) : null,
        eta: null, ata: iAtaTs  !== -1 ? xlDate(r[iAtaTs])  : null,
        is_current_segment: false },
      { segment_id: `${cno}-S2`, container_no: cno, segment_no: 2,
        segment_name: 'T/S Border → Destination', from_location: 'T/S Border', to_location: null,
        etd: null, atd: iAtdTs  !== -1 ? xlDate(r[iAtdTs])  : null,
        eta: null, ata: ata_final,
        is_current_segment: false },
    )
  }
  return { containers, segments }
}

// CN→UZ sub-parser: LCL sheet (header auto-detected)
function parseCnUzLcl(wb: XLSX.WorkBook): { containers: ContainerRow[]; segments: SegmentRow[] } {
  const sheetName = wb.SheetNames.find(n => n.toUpperCase() === 'LCL')
  if (!sheetName || !wb.Sheets[sheetName]) return { containers: [], segments: [] }
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: '' }) as unknown[][]
  const containers: ContainerRow[] = []
  const segments:   SegmentRow[]   = []

  let headerIdx = 0
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    if ((rows[i] as unknown[]).map(str).join(' ').toUpperCase().includes('CNTR')) { headerIdx = i; break }
  }
  const headers = (rows[headerIdx] as unknown[]).map(v => str(v).replace(/\n/g, ' ').trim())
  const col = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))

  const iCno    = col('cntr')
  const iPol    = col('pol')
  const iPodFd  = col('pod')
  const iAtdPol = col('etd/atd pol') !== -1 ? col('etd/atd pol') : col('dispatching')
  const iAtaTs  = col('ata t/s')     !== -1 ? col('ata t/s')     : col('ata border')
  const iAtdTs  = col('atd/ts')
  const iAtaWh  = col('ata w/h')     !== -1 ? col('ata w/h')     : col('ata wh')
  const iTT     = headers.findIndex(h => /t\/t|transit.*time/i.test(h))

  for (let ri = headerIdx + 1; ri < rows.length; ri++) {
    const r   = rows[ri] as unknown[]
    if (iCno === -1) continue
    const cno = str(r[iCno]).toUpperCase()
    if (!cno || !/^[A-Z]{4}\d/.test(cno)) continue

    const ata_final = iAtaWh !== -1 ? xlDate(r[iAtaWh]) : null
    const dest      = iPodFd !== -1 ? normalizeLoc(r[iPodFd]) : null

    containers.push({
      container_no:         cno,
      origin:               iPol !== -1 ? str(r[iPol]) || null : null,
      destination:          dest,
      transport_mode:       'Rail',
      current_location:     null,
      current_location_raw: null,
      eta_final:            null,
      ata_final,
      arrived_yn:           !!ata_final,
      transit_time_days:    iTT !== -1 ? parseTT(r[iTT]) : null,
    })

    segments.push(
      { segment_id: `${cno}-S1`, container_no: cno, segment_no: 1,
        segment_name: 'China → T/S Border',
        from_location: iPol !== -1 ? str(r[iPol]) || 'China' : 'China', to_location: 'T/S Border',
        etd: null, atd: iAtdPol !== -1 ? xlDate(r[iAtdPol]) : null,
        eta: null, ata: iAtaTs  !== -1 ? xlDate(r[iAtaTs])  : null,
        is_current_segment: false },
      { segment_id: `${cno}-S2`, container_no: cno, segment_no: 2,
        segment_name: 'T/S Border → Destination', from_location: 'T/S Border', to_location: dest,
        etd: null, atd: iAtdTs  !== -1 ? xlDate(r[iAtdTs])  : null,
        eta: null, ata: ata_final,
        is_current_segment: false },
    )
  }
  return { containers, segments }
}

// CN→UZ sub-parser: RAIL+TRUCK sheet (header auto-detected around row 2)
function parseCnUzRailTruck(wb: XLSX.WorkBook): { containers: ContainerRow[]; segments: SegmentRow[] } {
  const sheetName = wb.SheetNames.find(n =>
    n.toUpperCase().includes('RAIL') || n.toUpperCase().includes('TRUCK')
  )
  if (!sheetName || !wb.Sheets[sheetName]) return { containers: [], segments: [] }
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: '' }) as unknown[][]
  const containers: ContainerRow[] = []
  const segments:   SegmentRow[]   = []

  let headerIdx = 2
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    if ((rows[i] as unknown[]).map(str).join(' ').toUpperCase().includes('CNTR')) { headerIdx = i; break }
  }
  const headers = (rows[headerIdx] as unknown[]).map(v => str(v).replace(/\n/g, ' ').trim())
  const col = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))

  const iCno      = col('cntr')
  const iPol      = col('pol')
  const iPodFd    = col('pod')
  const iPickup   = col('pick up')
  const iEtdTao   = col('etd')
  const iAtaKashi = col('kash')
  const iAtaTsBrd = col('ata t/s')  !== -1 ? col('ata t/s')  : col('ata border')
  const iAtdTs    = col('atd/ts')   !== -1 ? col('atd/ts')   : col('atd t/s')
  const iTT       = headers.findIndex(h => /t\/t|transit.*time/i.test(h))

  for (let ri = headerIdx + 1; ri < rows.length; ri++) {
    const r   = rows[ri] as unknown[]
    if (iCno === -1) continue
    const cno = str(r[iCno]).toUpperCase()
    if (!cno || !/^[A-Z]{4}\d/.test(cno)) continue

    const dest  = iPodFd !== -1 ? normalizeLoc(r[iPodFd]) : null
    const s1etd = iEtdTao   !== -1 ? xlDate(r[iEtdTao])   : null
    const s1atd = iPickup   !== -1 ? xlDate(r[iPickup])   : s1etd
    const s1ata = iAtaKashi !== -1 ? xlDate(r[iAtaKashi]) : null
    const s2ata = iAtaTsBrd !== -1 ? xlDate(r[iAtaTsBrd]) : null
    const s3atd = iAtdTs    !== -1 ? xlDate(r[iAtdTs])    : null

    containers.push({
      container_no:         cno,
      origin:               iPol !== -1 ? str(r[iPol]) || null : null,
      destination:          dest,
      transport_mode:       'Truck',
      current_location:     null,
      current_location_raw: null,
      eta_final:            null,
      ata_final:            null,
      arrived_yn:           false,
      transit_time_days:    iTT !== -1 ? parseTT(r[iTT]) : null,
    })

    segments.push(
      { segment_id: `${cno}-S1`, container_no: cno, segment_no: 1,
        segment_name: 'China → Kashgar',
        from_location: iPol !== -1 ? str(r[iPol]) || 'China' : 'China', to_location: 'Kashgar',
        etd: s1etd, atd: s1atd, eta: null, ata: s1ata,
        is_current_segment: false },
      { segment_id: `${cno}-S2`, container_no: cno, segment_no: 2,
        segment_name: 'Kashgar → T/S Border', from_location: 'Kashgar', to_location: 'T/S Border',
        etd: null, atd: null, eta: null, ata: s2ata,
        is_current_segment: false },
      { segment_id: `${cno}-S3`, container_no: cno, segment_no: 3,
        segment_name: 'T/S Border → Destination', from_location: 'T/S Border', to_location: dest,
        etd: null, atd: s3atd, eta: null, ata: null,
        is_current_segment: false },
    )
  }
  return { containers, segments }
}

// CN→UZ: combine TCR + LCL + RAIL+TRUCK sheets
function parseCnUz(wb: XLSX.WorkBook): { containers: ContainerRow[]; segments: SegmentRow[] } {
  const { containers: tcrC, segments: tcrS } = parseCnUzTcr(wb)
  const { containers: lclC, segments: lclS } = parseCnUzLcl(wb)
  const { containers: rtC,  segments: rtS  } = parseCnUzRailTruck(wb)

  console.log(`[parseCnUz] TCR=${tcrC.length}, LCL=${lclC.length}, RAIL+TRUCK=${rtC.length}`)

  const containers = [...tcrC, ...lclC, ...rtC]
  const segments   = [...tcrS, ...lclS, ...rtS]

  fixCurrentSegments(segments)
  return { containers, segments }
}

// KR→KZ Truck: headerRow=4, data from row 5
function parseKrKzTruck(wb: XLSX.WorkBook): { containers: ContainerRow[]; segments: SegmentRow[] } {
  const rows = readSheetRows(wb)
  const containers: ContainerRow[] = []
  const segments: SegmentRow[] = []

  for (let ri = 5; ri < rows.length; ri++) {
    const r = rows[ri] as unknown[]
    const cno = str(r[0]).toUpperCase()
    if (!cno) continue

    const ata_almaty = xlDate(r[13])
    const cur_raw    = str(r[14])
    const cur_loc    = normalizeLoc(cur_raw)

    containers.push({
      container_no:      cno,
      origin:            null,
      destination:       'Almaty',
      transport_mode:    'Truck',
      current_location:  cur_loc,
      current_location_raw: cur_raw || null,
      eta_final:         xlDate(r[13]),
      ata_final:         ata_almaty,
      arrived_yn:        !!ata_almaty,
      transit_time_days: null,
    })

    const s1etd = xlDate(r[4]); const s1atd = xlDate(r[5])
    const s1eta = xlDate(r[7]); const s1ata = xlDate(r[8])
    const s2ata = xlDate(r[11])
    const s3atd = xlDate(r[12])

    segments.push(
      { segment_id: `${cno}-S1`, container_no: cno, segment_no: 1,
        segment_name: 'Korea → Qingdao', from_location: null, to_location: 'Qingdao',
        etd: s1etd, atd: s1atd, eta: s1eta, ata: s1ata,
        is_current_segment: !!s1atd && !s1ata },
      { segment_id: `${cno}-S2`, container_no: cno, segment_no: 2,
        segment_name: 'Qingdao → Khorgos', from_location: 'Qingdao', to_location: 'Khorgos',
        etd: null, atd: null, eta: null, ata: s2ata,
        is_current_segment: !!s1ata && !s2ata },
      { segment_id: `${cno}-S3`, container_no: cno, segment_no: 3,
        segment_name: 'Noorul → Almaty', from_location: 'Noorul', to_location: 'Almaty',
        etd: null, atd: s3atd, eta: null, ata: ata_almaty,
        is_current_segment: !!s3atd && !ata_almaty },
    )
  }

  fixCurrentSegments(segments)
  return { containers, segments }
}

// KR→KG: Bishkek sheet parser (3-segment route: Korea → Border → KZ Border → Bishkek)
function parseKrKgBishkekSheet(
  rows: unknown[][],
  headerIdx: number,
  sheetName: string,
): { containers: ContainerRow[]; segments: SegmentRow[] } {
  const containers: ContainerRow[] = []
  const segments:   SegmentRow[]   = []

  const headers = (rows[headerIdx] as unknown[]).map(v => str(v).replace(/\n/g, ' ').trim())
  const col = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))

  const iCno       = col('CNTR NO')
  const iAtdTao    = col('ETD/ATD TAO')
  const iAtaPod    = col('ETA/ATA POD')
  const iEtaBorder = col('ETA BORDER')
  const iAtaBorder = col('ATA BORDER')
  const iEtdKz     = col('ETD KZ')
  const iAtdKz     = col('ATD KZ')
  const iAtaDest   = col('ATA Destination')
  const iCurLoc    = col('Current station') !== -1 ? col('Current station') : col('CURRENT LOCATION')

  for (let ri = headerIdx + 1; ri < rows.length; ri++) {
    const r = rows[ri] as unknown[]
    if (iCno === -1) continue
    const cno = str(r[iCno]).toUpperCase()
    if (!cno) continue

    const ata_dest = iAtaDest !== -1 ? xlDate(r[iAtaDest]) : null
    const cur_raw  = iCurLoc  !== -1 ? str(r[iCurLoc])    : ''
    const cur_loc  = normalizeLoc(cur_raw)

    containers.push({
      container_no:         cno,
      origin:               'Incheon',
      destination:          sheetName,
      transport_mode:       'Rail',
      current_location:     cur_loc,
      current_location_raw: cur_raw || null,
      eta_final:            null,
      ata_final:            ata_dest,
      arrived_yn:           !!ata_dest || isTerminalStatus(cur_raw),
      transit_time_days:    null,
    })

    segments.push(
      { segment_id: `${cno}-S1`, container_no: cno, segment_no: 1,
        segment_name: 'Korea → Border', from_location: null, to_location: 'Border',
        etd: null, atd: iAtdTao    !== -1 ? xlDate(r[iAtdTao])    : null,
        eta: null, ata: iAtaPod    !== -1 ? xlDate(r[iAtaPod])    : null,
        is_current_segment: false },
      { segment_id: `${cno}-S2`, container_no: cno, segment_no: 2,
        segment_name: 'Border → KZ Border', from_location: 'Border', to_location: 'KZ Border',
        etd: null, atd: null,
        eta: iEtaBorder !== -1 ? xlDate(r[iEtaBorder]) : null,
        ata: iAtaBorder !== -1 ? xlDate(r[iAtaBorder]) : null,
        is_current_segment: false },
      { segment_id: `${cno}-S3`, container_no: cno, segment_no: 3,
        segment_name: `KZ Border → ${sheetName}`, from_location: 'KZ Border', to_location: sheetName,
        etd: iEtdKz !== -1 ? xlDate(r[iEtdKz]) : null,
        atd: iAtdKz !== -1 ? xlDate(r[iAtdKz]) : null,
        eta: null, ata: ata_dest,
        is_current_segment: false },
    )
  }
  return { containers, segments }
}

// KR→KG: ALMATY sheet parser (4-segment route via Xi'an: Korea → T/S → Xi'an → Border → Almaty)
function parseKrKgAlmatySheet(
  rows: unknown[][],
  headerIdx: number,
): { containers: ContainerRow[]; segments: SegmentRow[] } {
  const containers: ContainerRow[] = []
  const segments:   SegmentRow[]   = []

  const headers = (rows[headerIdx] as unknown[]).map(v => str(v).replace(/\n/g, ' ').trim())
  const col = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))

  const iCno      = col('cntr')
  const iDest     = col('destination')
  // S1: Korea → T/S  (ATD TAO → ATA POD)
  // "atd tao" ⊂ "etd/atd tao" ✓   "ata pod" ⊂ "eta/ata pod" ✓
  const iAtdTao   = col('atd tao')
  const iAtaPod   = col('ata pod')
  // S2: T/S → Xi'an  (no ATD → ATA XIAN)
  // "ata xian" ⊂ "eta/ata xian" ✓  but NOT ⊂ "etd/atd xian" ✓
  const iAtaXian  = col('ata xian')
  // S3: Xi'an → Border  (ATD XIAN → ATA BORDER)
  // "atd xian" ⊂ "etd/atd xian" ✓  but NOT ⊂ "eta/ata xian" ✓
  const iAtdXian  = col('atd xian')
  // Prefer column whose header starts with "ATA BORDER" over "ETD/ATA BORDER"
  const iAtaBord  = (() => {
    const strict = headers.findIndex(h => /^ata\s+border/i.test(h))
    return strict !== -1 ? strict : col('ata border')
  })()
  // S4: Border → Almaty  (ATD KZ BORDER → ATA Destination)
  // "atd kz border" ⊂ "etd/atd kz border" ✓
  const iAtdKzBrd = col('atd kz border')
  const iAtaDest  = col('ata destination') !== -1 ? col('ata destination') : col('ata dest')
  // Current location: collect ALL "current" columns, take last non-empty value per row
  // (handles sheets where "Current station" appears twice as a duplicate header)
  const curIdxs   = headers.reduce<number[]>((a, h, i) => {
    if (h.toLowerCase().includes('current')) a.push(i)
    return a
  }, [])

  for (let ri = headerIdx + 1; ri < rows.length; ri++) {
    const r   = rows[ri] as unknown[]
    if (iCno === -1) continue
    const cno = str(r[iCno]).toUpperCase()
    if (!cno || !/^[A-Z]{4}\d/.test(cno)) continue

    const ata_final = iAtaDest !== -1 ? xlDate(r[iAtaDest]) : null
    const cur_raw   = curIdxs.reduce((acc, idx) => { const v = str(r[idx]); return v ? v : acc }, '')
    const cur_loc   = normalizeLoc(cur_raw)
    const dest      = iDest !== -1 ? (normalizeLoc(r[iDest]) ?? 'Almaty') : 'Almaty'

    containers.push({
      container_no:         cno,
      origin:               'Incheon',
      destination:          dest,
      transport_mode:       'Rail',
      current_location:     cur_loc,
      current_location_raw: cur_raw || null,
      eta_final:            null,
      ata_final,
      arrived_yn:           !!ata_final || isTerminalStatus(cur_raw),
      transit_time_days:    null,
    })

    segments.push(
      { segment_id: `${cno}-S1`, container_no: cno, segment_no: 1,
        segment_name: 'Korea → T/S', from_location: 'Korea', to_location: 'T/S',
        etd: null, atd: iAtdTao  !== -1 ? xlDate(r[iAtdTao])  : null,
        eta: null, ata: iAtaPod  !== -1 ? xlDate(r[iAtaPod])  : null,
        is_current_segment: false },
      { segment_id: `${cno}-S2`, container_no: cno, segment_no: 2,
        segment_name: "T/S → Xi'an", from_location: 'T/S', to_location: "Xi'an",
        etd: null, atd: null,
        eta: null, ata: iAtaXian !== -1 ? xlDate(r[iAtaXian]) : null,
        is_current_segment: false },
      { segment_id: `${cno}-S3`, container_no: cno, segment_no: 3,
        segment_name: "Xi'an → Border", from_location: "Xi'an", to_location: 'Border',
        etd: null, atd: iAtdXian !== -1 ? xlDate(r[iAtdXian]) : null,
        eta: null, ata: iAtaBord !== -1 ? xlDate(r[iAtaBord]) : null,
        is_current_segment: false },
      { segment_id: `${cno}-S4`, container_no: cno, segment_no: 4,
        segment_name: 'Border → Almaty', from_location: 'Border', to_location: dest,
        etd: null, atd: iAtdKzBrd !== -1 ? xlDate(r[iAtdKzBrd]) : null,
        eta: null, ata: ata_final,
        is_current_segment: false },
    )
  }
  return { containers, segments }
}

// KR→KG: column-name based, multiple sheets; dispatches to Bishkek or Almaty parser
function parseKrKg(wb: XLSX.WorkBook): { containers: ContainerRow[]; segments: SegmentRow[] } {
  const containers: ContainerRow[] = []
  const segments:   SegmentRow[]   = []
  const sheetsToParse = wb.SheetNames.filter(n =>
    n.toLowerCase().includes('bishkek') || n.toLowerCase().includes('almaty') ||
    n.toLowerCase().includes('ош') || n.toLowerCase().includes('osh')
  )
  const targetSheets = sheetsToParse.length > 0 ? sheetsToParse : [wb.SheetNames[0]]

  for (const sheetName of targetSheets) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: '' }) as unknown[][]
    if (rows.length < 2) continue

    // Find header row (row with CNTR NO. or similar)
    let headerIdx = 0
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const joined = (rows[i] as unknown[]).map(str).join(' ')
      if (joined.includes('CNTR') || joined.includes('CONT')) { headerIdx = i; break }
    }

    if (sheetName.toUpperCase() === 'ALMATY') {
      const { containers: c, segments: s } = parseKrKgAlmatySheet(rows, headerIdx)
      containers.push(...c)
      segments.push(...s)
    } else {
      const { containers: c, segments: s } = parseKrKgBishkekSheet(rows, headerIdx, sheetName)
      containers.push(...c)
      segments.push(...s)
    }
  }

  fixCurrentSegments(segments)
  return { containers, segments }
}

// KR→EU: MTL TCR sheet, headerRow=0, skipRows=[1]
function parseKrEu(wb: XLSX.WorkBook): { containers: ContainerRow[]; segments: SegmentRow[] } {
  const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('mtl') || n.toLowerCase().includes('tcr')) ?? wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' }) as unknown[][]

  const containers: ContainerRow[] = []
  const segments: SegmentRow[] = []
  if (rows.length < 2) return { containers, segments }

  const headers = (rows[0] as unknown[]).map(v => str(v).replace(/\n/g, ' ').trim())
  const col = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))

  const iCno     = col('CONT NO')
  const iAtdPol  = col('ATD') !== -1 ? col('ATD') : col('INC/BUS')
  const iAtaTao  = headers.findIndex(h => /ETA.*TAO|ETA.*WEI/i.test(h))
  const iAtdTao  = headers.findIndex(h => /ATD.*TAO|ATD.*WEI/i.test(h))
  const iAtaXian = headers.findIndex(h => /ATA.*CKG|ATA.*xian/i.test(h))
  const iEtdXian = headers.findIndex(h => /ETD.*CKG|ETD.*xian/i.test(h))
  const iAtdXian = headers.findIndex(h => /ATD.*CKG|ATD.*xian/i.test(h))
  const iEtaMala = headers.findIndex(h => /ETA.*DEST|ETA.*MALA/i.test(h))
  const iAtaMala = headers.findIndex(h => /^ATA$/i.test(h))
  const iStopBy  = col('STOP BY')

  // Start from row 1 (not 2) — row 0 is the header, row 1 is the first data row
  for (let ri = 1; ri < rows.length; ri++) {
    const r = rows[ri] as unknown[]
    if (iCno === -1) continue
    const cno = str(r[iCno]).toUpperCase()
    if (!cno) continue

    const ata_final = iAtaMala !== -1 ? xlDate(r[iAtaMala]) : null
    const cur_raw   = iStopBy !== -1 ? str(r[iStopBy]) : ''
    const cur_loc   = normalizeLoc(cur_raw)

    containers.push({
      container_no:      cno,
      origin:            'Incheon',
      destination:       'Małaszewicze',
      transport_mode:    'Rail',
      current_location:  cur_loc,
      current_location_raw: cur_raw || null,
      eta_final:         iEtaMala !== -1 ? xlDate(r[iEtaMala]) : null,
      ata_final,
      arrived_yn:        !!ata_final || isTerminalStatus(cur_raw),
      transit_time_days: null,
    })

    const s1atd  = iAtdPol  !== -1 ? xlDate(r[iAtdPol])  : null
    const s1ata  = iAtaTao  !== -1 ? xlDate(r[iAtaTao])  : null
    const s2atd  = iAtdTao  !== -1 ? xlDate(r[iAtdTao])  : null
    const s2ata  = iAtaXian !== -1 ? xlDate(r[iAtaXian]) : null
    const s3etd  = iEtdXian !== -1 ? xlDate(r[iEtdXian]) : null
    const s3atd  = iAtdXian !== -1 ? xlDate(r[iAtdXian]) : null

    segments.push(
      { segment_id: `${cno}-S1`, container_no: cno, segment_no: 1,
        segment_name: 'Korea → Qingdao', from_location: null, to_location: 'Qingdao',
        etd: null, atd: s1atd, eta: null, ata: s1ata,
        is_current_segment: !!s1atd && !s1ata },
      { segment_id: `${cno}-S2`, container_no: cno, segment_no: 2,
        segment_name: "Qingdao → Xi'an", from_location: 'Qingdao', to_location: "Xi'an",
        etd: null, atd: s2atd, eta: null, ata: s2ata,
        is_current_segment: !!s2atd && !s2ata },
      { segment_id: `${cno}-S3`, container_no: cno, segment_no: 3,
        segment_name: "Xi'an → Małaszewicze", from_location: "Xi'an", to_location: 'Małaszewicze',
        etd: s3etd, atd: s3atd, eta: null, ata: ata_final,
        is_current_segment: !!s3atd && !ata_final },
    )
  }

  fixCurrentSegments(segments)
  return { containers, segments }
}

function parseWorkbook(wb: XLSX.WorkBook, fileType: FileType): { containers: ContainerRow[]; segments: SegmentRow[] } {
  switch (fileType) {
    case 'KR_UZ':       return parseKrUz(wb)
    case 'CN_UZ':       return parseCnUz(wb)
    case 'KR_KZ_TRUCK': return parseKrKzTruck(wb)
    case 'KR_KG':       return parseKrKg(wb)
    case 'KR_EU':       return parseKrEu(wb)
    default:            return { containers: [], segments: [] }
  }
}

/* ── Upload history ─────────────────────────────────────────────────── */
async function fetchServerLog(): Promise<ServerLog[]> {
  try {
    const r = await fetch('/api/tcr?action=upload_log')
    const d = await r.json() as { ok: boolean; logs?: ServerLog[] }
    return d.ok ? (d.logs ?? []) : []
  } catch { return [] }
}

/* ── Preview table ──────────────────────────────────────────────────── */
function fmtDate(d: string | null) {
  if (!d) return '-'
  return d.slice(5).replace('-', '.')
}

function PreviewTable({ parsed }: { parsed: ParsedFile }) {
  const [tab, setTab] = useState<'containers' | 'segments'>('containers')

  return (
    <div style={{ marginTop: 12 }}>
      <div className="flex gap-2 mb-2">
        {(['containers', 'segments'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="px-3 py-1 rounded text-[11px] font-medium transition-colors"
            style={{
              background: tab === t ? 'var(--brand)' : 'var(--card)',
              color: tab === t ? '#fff' : 'var(--ink-600)',
              border: '1px solid',
              borderColor: tab === t ? 'var(--brand)' : 'var(--ink-300)',
            }}
          >
            {t === 'containers' ? `컨테이너 (${parsed.containers.length})` : `세그먼트 (${parsed.segments.length})`}
          </button>
        ))}
      </div>

      <div style={{ overflowX: 'auto', maxHeight: 280, overflowY: 'auto', borderRadius: 6, border: '1px solid var(--ink-200)' }}>
        {tab === 'containers' ? (
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--ink-50)', borderBottom: '1px solid var(--ink-200)' }}>
                {['컨테이너', '출발', '도착', '현재위치', 'ETA', '도착'].map(h => (
                  <th key={h} style={{ padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--ink-500)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.containers.map(c => (
                <tr key={c.container_no} style={{ borderBottom: '1px solid var(--ink-100)' }}>
                  <td style={{ padding: '3px 8px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{c.container_no}</td>
                  <td style={{ padding: '3px 8px', color: 'var(--ink-600)' }}>{c.origin ?? '-'}</td>
                  <td style={{ padding: '3px 8px', color: 'var(--ink-600)' }}>{c.destination ?? '-'}</td>
                  <td style={{ padding: '3px 8px', color: 'var(--ink-600)' }}>{c.current_location ?? '-'}</td>
                  <td style={{ padding: '3px 8px', color: 'var(--ink-600)' }}>{fmtDate(c.eta_final)}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'center' }}>{c.arrived_yn ? '✓' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--ink-50)', borderBottom: '1px solid var(--ink-200)' }}>
                {['구간ID', '구간', 'ETD', 'ATD', 'ETA', 'ATA', '현재'].map(h => (
                  <th key={h} style={{ padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--ink-500)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.segments.map(s => (
                <tr key={s.segment_id} style={{ borderBottom: '1px solid var(--ink-100)', background: s.is_current_segment ? 'rgba(59,130,246,0.05)' : undefined }}>
                  <td style={{ padding: '3px 8px', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{s.segment_id}</td>
                  <td style={{ padding: '3px 8px', color: 'var(--ink-600)' }}>{s.segment_name ?? '-'}</td>
                  <td style={{ padding: '3px 8px', color: 'var(--ink-500)' }}>{fmtDate(s.etd)}</td>
                  <td style={{ padding: '3px 8px', color: 'var(--ink-500)' }}>{fmtDate(s.atd)}</td>
                  <td style={{ padding: '3px 8px', color: 'var(--ink-500)' }}>{fmtDate(s.eta)}</td>
                  <td style={{ padding: '3px 8px', color: 'var(--ink-500)' }}>{fmtDate(s.ata)}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'center', color: '#3b82f6' }}>{s.is_current_segment ? '●' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ── Parsed file card ───────────────────────────────────────────────── */
function ParsedCard({ parsed, onRemove }: { parsed: ParsedFile; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="rounded-lg border"
      style={{ borderColor: parsed.error ? 'rgba(220,38,38,0.4)' : 'var(--ink-200)', background: 'var(--card)', marginBottom: 8 }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <FileSpreadsheet size={16} style={{ color: parsed.error ? '#ef4444' : '#22c55e', flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 13, fontWeight: 600 }} className="truncate">{parsed.file.name}</div>
          {parsed.error ? (
            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{parsed.error}</div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>
              {FILE_TYPE_LABELS[parsed.fileType]} · 컨테이너 {parsed.containers.length}개 · 세그먼트 {parsed.segments.length}개
            </div>
          )}
        </div>
        {!parsed.error && (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors"
            style={{ color: 'var(--ink-500)', background: 'transparent', border: '1px solid var(--ink-300)' }}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            미리보기
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center justify-center w-6 h-6 rounded hover:bg-red-50 transition-colors"
          style={{ color: 'var(--ink-400)', border: 'none', background: 'transparent', cursor: 'pointer' }}
        >
          <XCircle size={14} />
        </button>
      </div>
      {expanded && !parsed.error && (
        <div style={{ padding: '0 16px 12px' }}>
          <PreviewTable parsed={parsed} />
        </div>
      )}
    </div>
  )
}

/* ── Main Page ──────────────────────────────────────────────────────── */
export function TcrUploadPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [serverLog, setServerLog] = useState<ServerLog[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchServerLog().then(setServerLog)
  }, [])

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const newParsed: ParsedFile[] = []
    for (const file of Array.from(files)) {
      if (!file.name.match(/\.(xlsx|xls|xlsm)$/i)) {
        newParsed.push({ file, fileType: 'UNKNOWN', fileTypeLabel: '지원하지 않는 파일', containers: [], segments: [], error: 'Excel 파일(.xlsx/.xls)만 지원합니다.' })
        continue
      }
      try {
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
        const fileType = detectFileType(wb)
        if (fileType === 'UNKNOWN') {
          newParsed.push({ file, fileType, fileTypeLabel: FILE_TYPE_LABELS.UNKNOWN, containers: [], segments: [], error: '파일 형식을 인식할 수 없습니다. 헤더를 확인해주세요.' })
          continue
        }
        const { containers, segments } = parseWorkbook(wb, fileType)
        newParsed.push({ file, fileType, fileTypeLabel: FILE_TYPE_LABELS[fileType], containers, segments })
      } catch (e) {
        newParsed.push({ file, fileType: 'UNKNOWN', fileTypeLabel: '오류', containers: [], segments: [], error: String(e) })
      }
    }
    setParsedFiles(prev => [...prev, ...newParsed])
    setSubmitResult(null)
    setSubmitError(null)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files)
  }, [processFiles])

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files)
      e.target.value = ''
    }
  }, [processFiles])

  const removeFile = useCallback((idx: number) => {
    setParsedFiles(prev => prev.filter((_, i) => i !== idx))
    setSubmitResult(null)
    setSubmitError(null)
  }, [])

  const validFiles = parsedFiles.filter(p => !p.error && p.containers.length > 0)
  const allContainers = validFiles.flatMap(p =>
    p.containers.map(c => ({ ...c, file_type: p.fileType })),
  )
  const allSegments   = validFiles.flatMap(p => p.segments)

  const handleSubmit = useCallback(async () => {
    if (validFiles.length === 0) return
    setIsSubmitting(true)
    setSubmitResult(null)
    setSubmitError(null)
    try {
      const res = await fetch('/api/tcr?action=upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          containers: allContainers,
          segments:   allSegments,
          files_info: validFiles.map(p => ({
            file_name:        p.file.name,
            file_type:        p.fileTypeLabel,
            containers_count: p.containers.length,
            segments_count:   p.segments.length,
          })),
        }),
      })
      const json = await res.json() as { ok: boolean; updated_containers?: number; updated_segments?: number; errors?: string[]; error?: string }
      if (!json.ok) throw new Error(json.error ?? '알 수 없는 오류')
      const result: SubmitResult = { updated_containers: json.updated_containers ?? 0, updated_segments: json.updated_segments ?? 0, errors: json.errors ?? [] }
      setSubmitResult(result)
      // Refresh server log after successful upload
      fetchServerLog().then(setServerLog)
    } catch (e) {
      setSubmitError(String(e))
    } finally {
      setIsSubmitting(false)
    }
  }, [validFiles, allContainers, allSegments])

  return (
    <div className="fesco-bookings-shell flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--chat-bg)' }}>
      {/* Header */}
      <div className="fesco-header flex-shrink-0" style={{ padding: isMobile ? '8px 12px' : '12px 28px 10px' }}>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[12px] transition-colors"
            style={{ borderColor: 'var(--ink-300)', color: 'var(--ink-500)', background: 'transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ink-100)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <ArrowLeft size={13} /> TCR 트래킹
          </button>
          <div className="flex items-center gap-2.5">
            <Upload size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
            <h1 style={{ fontSize: 20, margin: 0 }}>파일 업로드</h1>
          </div>
          <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>
            Excel 파일을 업로드하여 TCR 데이터를 갱신합니다
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto" style={{ padding: isMobile ? '12px' : '16px 28px' }}>

        {/* Drop zone */}
        <div
          className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors"
          style={{
            borderColor: isDragOver ? 'var(--brand)' : 'var(--ink-300)',
            background:  isDragOver ? 'rgba(59,130,246,0.05)' : 'var(--card)',
            minHeight: isMobile ? 120 : 160,
            marginBottom: 20,
          }}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" multiple accept=".xlsx,.xls,.xlsm" onChange={onFileInput} style={{ display: 'none' }} />
          <Upload size={isMobile ? 28 : 32} style={{ color: isDragOver ? 'var(--brand)' : 'var(--ink-300)', marginBottom: isMobile ? 8 : 12 }} />
          {isMobile ? (
            <>
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '80%', height: 48, borderRadius: 10,
                  background: '#3b82f6', color: '#fff',
                  fontSize: 15, fontWeight: 600, gap: 8,
                }}
              >
                <Upload size={16} /> 파일 선택
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 8 }}>
                KR→UZ · CN→UZ · KR→KZ · KR→KG · KR→EU
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-600)' }}>
                Excel 파일을 드래그하거나 클릭하여 선택
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 6 }}>
                KR→UZ · CN→UZ · KR→KZ Truck · KR→KG · KR→EU · 최대 5개 동시 업로드
              </div>
            </>
          )}
        </div>

        {/* Parsed file cards */}
        {parsedFiles.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {parsedFiles.map((p, i) => (
              <ParsedCard key={`${p.file.name}-${i}`} parsed={p} onRemove={() => removeFile(i)} />
            ))}
          </div>
        )}

        {/* Summary + actions */}
        {parsedFiles.length > 0 && (
          <div
            className="rounded-xl border flex items-center gap-6 px-5 py-4"
            style={{ borderColor: 'var(--ink-200)', background: 'var(--card)', marginBottom: 16 }}
          >
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-400)', marginBottom: 2 }}>유효 파일</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#3b82f6' }}>{validFiles.length}</div>
            </div>
            <div style={{ width: 1, height: 36, background: 'var(--ink-200)' }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-400)', marginBottom: 2 }}>컨테이너</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{allContainers.length}</div>
            </div>
            <div style={{ width: 1, height: 36, background: 'var(--ink-200)' }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-400)', marginBottom: 2 }}>세그먼트</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{allSegments.length}</div>
            </div>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => { setParsedFiles([]); setSubmitResult(null); setSubmitError(null) }}
              className="px-4 py-2 rounded-lg border text-[13px] transition-colors"
              style={{ borderColor: 'var(--ink-300)', color: 'var(--ink-500)', background: 'transparent' }}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || validFiles.length === 0}
              className="px-5 py-2 rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50"
              style={{ background: '#3b82f6', color: '#fff', border: 'none', cursor: validFiles.length === 0 ? 'not-allowed' : 'pointer' }}
            >
              {isSubmitting ? '반영 중…' : 'DB에 반영하기'}
            </button>
          </div>
        )}

        {/* Submit result */}
        {submitResult && (
          <div
            className="rounded-lg border px-4 py-3 flex items-center gap-3 mb-4"
            style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.3)', color: '#16a34a' }}
          >
            <CheckCircle size={16} />
            <span style={{ fontSize: 13 }}>
              완료 — 컨테이너 <strong>{submitResult.updated_containers}</strong>개 · 세그먼트 <strong>{submitResult.updated_segments}</strong>개 반영됨
              {submitResult.errors.length > 0 && <span style={{ color: '#dc2626', marginLeft: 8 }}>({submitResult.errors.length}개 오류)</span>}
            </span>
          </div>
        )}
        {submitError && (
          <div
            className="rounded-lg border px-4 py-3 flex items-center gap-3 mb-4"
            style={{ background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.3)', color: '#dc2626' }}
          >
            <AlertCircle size={16} />
            <span style={{ fontSize: 13 }}>{submitError}</span>
          </div>
        )}

        {/* Upload history — server-side, visible to all users */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            전체 업로드 이력 (모든 계정)
          </div>
          {serverLog.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--ink-400)', padding: '12px 0' }}>이력이 없습니다.</div>
          ) : (
            <div style={{ borderRadius: 8, border: '1px solid var(--ink-200)', overflow: 'hidden' }}>
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--ink-50)', borderBottom: '1px solid var(--ink-200)' }}>
                    {['파일명', '종류', '컨테이너', '세그먼트', 'IP', '업로드 시각'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--ink-500)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {serverLog.map(h => (
                    <tr key={h.id} style={{ borderBottom: '1px solid var(--ink-100)' }}>
                      <td style={{ padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{h.file_name}</td>
                      <td style={{ padding: '5px 10px', color: 'var(--ink-600)' }}>{h.file_type}</td>
                      <td style={{ padding: '5px 10px', color: 'var(--ink-600)', textAlign: 'right' }}>{h.containers_count}</td>
                      <td style={{ padding: '5px 10px', color: 'var(--ink-600)', textAlign: 'right' }}>{h.segments_count}</td>
                      <td style={{ padding: '5px 10px', color: 'var(--ink-400)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{h.uploader_ip ?? '-'}</td>
                      <td style={{ padding: '5px 10px', color: 'var(--ink-400)' }}>{new Date(h.uploaded_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
