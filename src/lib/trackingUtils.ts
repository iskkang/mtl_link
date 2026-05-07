export type TrackingType = 'ocean_container' | 'air_awb' | 'bl' | 'booking' | 'unknown'

export interface Carrier {
  code:        string
  name:        string
  type:        'ocean' | 'air'
  prefixes:    string[]
  trackingUrl: (no: string) => string
}

export const CARRIERS: Carrier[] = [
  // ── 해상 ──────────────────────────────────────────────────────────────
  {
    code: 'FESCO',
    name: 'FESCO',
    type: 'ocean' as const,
    prefixes: ['FESU', 'FESO'],
    trackingUrl: (no) => `https://my.fesco.com/tracking?tab=${no}`,
  },
  {
    code: 'HMM',
    name: 'HMM (현대상선)',
    type: 'ocean' as const,
    prefixes: ['HDMU', 'HMMU', 'SELE'],
    trackingUrl: (no) => `https://hmm21.com/e-service/search/index.do?query=${no}`,
  },
  {
    code: 'MSC',
    name: 'MSC',
    type: 'ocean' as const,
    prefixes: ['MSCU', 'MEDU', 'MSDU'],
    trackingUrl: (no) => `https://www.msc.com/en/track-a-shipment?trackingNumber=${no}`,
  },
  {
    code: 'MAERSK',
    name: 'Maersk',
    type: 'ocean' as const,
    prefixes: ['MSKU', 'MRKU', 'MRSU'],
    trackingUrl: (no) => `https://www.maersk.com/tracking/${no}`,
  },
  {
    code: 'SINOKOR',
    name: 'Sinokor (한진)',
    type: 'ocean' as const,
    prefixes: ['SJKU', 'HBLU'],
    trackingUrl: (no) => `https://www.sinokor.co.kr/Tracking?blNo=${no}`,
  },
  {
    code: 'KMTC',
    name: 'KMTC',
    type: 'ocean' as const,
    prefixes: ['KMTU'],
    trackingUrl: (no) => `https://www.kmtc.co.kr/main?searchType=CNT&searchValue=${no}`,
  },
  {
    code: 'CMA',
    name: 'CMA CGM',
    type: 'ocean' as const,
    prefixes: ['CMAU', 'CGMU', 'APLU'],
    trackingUrl: (no) => `https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=Container&Reference=${no}`,
  },
  {
    code: 'EVERGREEN',
    name: 'Evergreen',
    type: 'ocean' as const,
    prefixes: ['EISU', 'EMCU', 'EGHU'],
    trackingUrl: (no) => `https://www.evergreen-line.com/service/tracing/index.jsp?cntr_no=${no}`,
  },
  {
    code: 'YANGMING',
    name: 'Yang Ming',
    type: 'ocean' as const,
    prefixes: ['YMLU', 'YMJA'],
    trackingUrl: (no) => `https://www.yangming.com/e-service/Track_Trace/track_trace_cargo_tracking.aspx?cntr=${no}`,
  },
  {
    code: 'PANCON',
    name: 'Pan Con',
    type: 'ocean' as const,
    prefixes: ['PCCU'],
    trackingUrl: (no) => `https://www.pancon.co.kr/tracking?cntNo=${no}`,
  },
  {
    code: 'COSCO',
    name: 'COSCO',
    type: 'ocean' as const,
    prefixes: ['COSU', 'CSNU'],
    trackingUrl: (no) => `https://elines.coscoshipping.com/ebusiness/cargoTracking?trackingType=CONTAINER&number=${no}`,
  },
  {
    code: 'OOCL',
    name: 'OOCL',
    type: 'ocean' as const,
    prefixes: ['OOLU', 'OOCU'],
    trackingUrl: (no) => `https://www.oocl.com/eng/ourservices/eservices/cargotracking/Pages/cargotracking.aspx?ContainerNo=${no}`,
  },
  // ── 항공 ──────────────────────────────────────────────────────────────
  {
    code: 'KE',
    name: 'Korean Air Cargo',
    type: 'air' as const,
    prefixes: ['180'],
    trackingUrl: (no) => `https://cargo.koreanair.com/en/track?awb=${no.replace('-', '')}`,
  },
  {
    code: 'OZ',
    name: 'Asiana Cargo',
    type: 'air' as const,
    prefixes: ['988'],
    trackingUrl: (no) => `https://asianacargo.com/cargo/track?awbNo=${no.replace('-', '')}`,
  },
  {
    code: 'SU',
    name: 'Aeroflot Cargo',
    type: 'air' as const,
    prefixes: ['555'],
    trackingUrl: (no) => `https://www.aeroflot.ru/ru-en/cargo/tracking?awb=${no}`,
  },
  {
    code: 'HY',
    name: 'Uzbekistan Airways',
    type: 'air' as const,
    prefixes: ['250'],
    trackingUrl: (no) => `https://www.uzairways.com/en/cargo/tracking?awb=${no}`,
  },
]

export function detectTrackingType(input: string): TrackingType {
  const clean = input.replace(/\s/g, '').toUpperCase()

  // Container: 4 alpha + 7 digits = 11 chars (ISO 6346)
  if (/^[A-Z]{4}[0-9]{7}$/.test(clean)) return 'ocean_container'

  // AWB: 000-0000000(0) or 00000000000
  if (/^[0-9]{3}-[0-9]{7,8}$/.test(clean)) return 'air_awb'
  if (/^[0-9]{11}$/.test(clean)) return 'air_awb'

  return 'unknown'
}

export function guessCarrier(input: string, type: TrackingType): Carrier | null {
  const clean = input.replace(/\s/g, '').toUpperCase()

  if (type === 'ocean_container') {
    const prefix = clean.substring(0, 4)
    return CARRIERS.find(c => c.prefixes.includes(prefix)) ?? null
  }

  if (type === 'air_awb') {
    const airlinePrefix = clean.replace('-', '').substring(0, 3)
    return CARRIERS.find(c => c.prefixes.includes(airlinePrefix)) ?? null
  }

  return null
}
