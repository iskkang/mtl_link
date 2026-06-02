export type ReportSource = 'tcr' | 'fesco'

export interface DisplayCol {
  src:   string
  label: string
}

export interface ReportProfile {
  reportKey:     string
  source:        ReportSource
  subject:       string
  greetingLabel: string
  to:            string[]
  fileType?:     string      // TCR only — matches tcr_containers_current.file_type
  displayCols:   DisplayCol[]
}

export interface CanonicalRow {
  rowKey:          string
  display:         { label: string; value: string }[]
  currentLocation: string
  daysAtLocation:  number | null
  stalled:         boolean         // true when daysAtLocation >= 3 and not arrived
  alert?: {
    level: 'red' | 'yellow'
    note?: string
  }
}

const SUBJECT_DATE_SUFFIX = true

export function buildSubject(profile: ReportProfile): string {
  if (!SUBJECT_DATE_SUFFIX) return profile.subject
  const d    = new Date()
  const yyyy = d.getFullYear()
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const dd   = String(d.getDate()).padStart(2, '0')
  return `${profile.subject} - ${yyyy}.${mm}.${dd}`
}

const TCR_COLS: DisplayCol[] = [
  { src: 'customer_list',  label: '화주' },
  { src: 'container_no',   label: 'CNTR NO.' },
  { src: 'transport_mode', label: 'MODE' },
  { src: 'destination',    label: 'F.DEST' },
  { src: 'eta_final',      label: 'ETA' },
]

export const PROFILES: ReportProfile[] = [
  {
    reportKey:     'kr-eu',
    source:        'tcr',
    fileType:      'KR_EU',
    subject:       '한국발 유럽향 트래이싱',
    greetingLabel: '한국발 유럽향 트래이싱',
    to:            ['mtlrus@mtlb.co.kr'],
    displayCols:   TCR_COLS,
  },
  {
    reportKey:     'kr-bishkek',
    source:        'tcr',
    fileType:      'KR_KG',
    subject:       '한국발 비슈켁향 트래이싱',
    greetingLabel: '한국발 비슈켁향 트래이싱',
    to:            ['mtlrus@mtlb.co.kr'],
    displayCols:   TCR_COLS,
  },
  {
    reportKey:     'kr-almaty',
    source:        'tcr',
    fileType:      'KR_KZ_TRUCK',
    subject:       '한국발 알마티향 트래이싱',
    greetingLabel: '한국발 알마티향 트래이싱',
    to:            ['mtlrus@mtlb.co.kr'],
    displayCols:   TCR_COLS,
  },
  {
    reportKey:     'cn-lcl',
    source:        'tcr',
    fileType:      'CN_UZ',
    subject:       '중국발 TTL LCL 트래이싱',
    greetingLabel: '중국발 TTL LCL 트래이싱',
    to:            ['mtlrus@mtlb.co.kr'],
    displayCols: [
      { src: 'customer_list', label: '화주' },
      { src: 'container_no',  label: 'CNTR NO.' },
      { src: 'destination',   label: 'F.DEST' },
      { src: 'cbm_total',     label: 'CBM' },
      { src: 'eta_final',     label: 'ETA' },
    ],
  },
  {
    reportKey:     'kr-uz',
    source:        'tcr',
    fileType:      'KR_UZ',
    subject:       '한국발 우즈벡향 트래이싱',
    greetingLabel: '한국발 우즈벡향 트래이싱',
    to:            ['mtlrus@mtlb.co.kr'],
    displayCols:   TCR_COLS,
  },
  {
    reportKey:     'fesco',
    source:        'fesco',
    subject:       'FESCO 컨테이너 트래이싱',
    greetingLabel: 'FESCO 컨테이너 트래이싱',
    to:            ['mtlrus@mtlb.co.kr'],
    displayCols: [
      { src: 'owner_ship',               label: '화주' },
      { src: 'bills',                    label: 'B/L' },
      { src: 'container_number',         label: 'CNTR NO.' },
      { src: 'current_segment_type',     label: 'MODE' },
      { src: 'planned_destination_date', label: 'ETA' },
    ],
  },
]
