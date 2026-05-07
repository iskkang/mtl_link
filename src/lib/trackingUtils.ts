export type TrackingType = 'ocean_container' | 'air_awb' | 'bl' | 'booking' | 'unknown'

export interface Carrier {
  code:   string
  name:   string
  type:   'ocean' | 'air'
  prefix: string
  url:    string
}

export const CARRIERS: Carrier[] = [
  // ── 해상 ──────────────────────────────────────────────────────────────
  { code: 'FESCO',    name: 'FESCO',            type: 'ocean', prefix: 'FESU', url: 'https://www.fesco.ru/en/clients/cargo-tracking/' },
  { code: 'HMM',      name: 'HMM (현대상선)',   type: 'ocean', prefix: 'HDMU', url: 'https://www.hmm21.com/cms/business/ebiz/track/trackingInfo/index.jsp' },
  { code: 'SINOKOR',  name: 'Sinokor (한진)',   type: 'ocean', prefix: 'SJKU', url: 'https://www.sinokor.co.kr/Tracking' },
  { code: 'KMTC',     name: 'KMTC',             type: 'ocean', prefix: 'KMTU', url: 'https://www.kmtc.co.kr/main' },
  { code: 'MSC',      name: 'MSC',              type: 'ocean', prefix: 'MSCU', url: 'https://www.msc.com/track-a-shipment' },
  { code: 'CMA',      name: 'CMA CGM',          type: 'ocean', prefix: 'CMAU', url: 'https://www.cma-cgm.com/ebusiness/tracking' },
  { code: 'EVERGREEN',name: 'Evergreen',        type: 'ocean', prefix: 'EISU', url: 'https://www.evergreen-line.com/service/tracing/index.jsp' },
  { code: 'YANGMING', name: 'Yang Ming',        type: 'ocean', prefix: 'YMLU', url: 'https://www.yangming.com/e-service/Track_Trace/track_trace_cargo_tracking.aspx' },
  { code: 'PANCON',   name: 'Pan Con',          type: 'ocean', prefix: 'PCCU', url: 'https://www.pancon.co.kr' },
  // ── 항공 ──────────────────────────────────────────────────────────────
  { code: 'KE', name: 'Korean Air Cargo',       type: 'air',   prefix: '180', url: 'https://cargo.koreanair.com/en/track' },
  { code: 'OZ', name: 'Asiana Cargo',           type: 'air',   prefix: '988', url: 'https://asianacargo.com/cargo/track' },
  { code: 'SU', name: 'Aeroflot Cargo',         type: 'air',   prefix: '555', url: 'https://www.aeroflot.ru/ru-en/cargo' },
  { code: 'HY', name: 'Uzbekistan Airways',     type: 'air',   prefix: '250', url: 'https://www.uzairways.com/en' },
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
    return CARRIERS.find(c => c.prefix === prefix) ?? null
  }

  if (type === 'air_awb') {
    const airlinePrefix = clean.replace('-', '').substring(0, 3)
    return CARRIERS.find(c => c.prefix === airlinePrefix) ?? null
  }

  return null
}
