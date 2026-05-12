/**
 * Maps profile.department codes to inline flag SVGs.
 * MTL offices only; anything else falls back to a globe icon.
 *
 * Usage: <CountryFlag code={profile.department ?? ''} size={14} />
 */

import { createElement } from 'react'
import type { ReactElement } from 'react'

/** Department codes used by MTL offices */
export type OfficeDept = 'HQ' | 'UZ' | 'RU' | 'JP' | 'CN' | 'KG' | 'VN'

export function CountryFlag({ code, size = 14 }: { code: string; size?: number }): ReactElement {
  const key = (code ?? '').toUpperCase() as OfficeDept

  switch (key) {
    case 'HQ': // South Korea — simplified Taegeukgi
      return createElement('svg', { width: size, height: size, viewBox: '0 0 24 24' },
        createElement('rect', { width: 24, height: 24, fill: 'white' }),
        createElement('circle', { cx: 12, cy: 12, r: 5, fill: '#CD2E3A' }),
        createElement('path', { d: 'M12,7 A5,5 0 0,1 12,17 A2.5,2.5 0 0,0 12,12 A2.5,2.5 0 0,1 12,7', fill: '#0047A0' }),
      )
    case 'UZ': // Uzbekistan — blue / white / green stripes
      return createElement('svg', { width: size, height: size, viewBox: '0 0 24 24' },
        createElement('rect', { width: 24, height: 8,  fill: '#0099B5' }),
        createElement('rect', { y: 8,  width: 24, height: 8, fill: 'white' }),
        createElement('rect', { y: 16, width: 24, height: 8, fill: '#1EB53A' }),
      )
    case 'RU': // Russia — white / blue / red
      return createElement('svg', { width: size, height: size, viewBox: '0 0 24 24' },
        createElement('rect', { width: 24, height: 8,  fill: 'white' }),
        createElement('rect', { y: 8,  width: 24, height: 8, fill: '#0039A6' }),
        createElement('rect', { y: 16, width: 24, height: 8, fill: '#D52B1E' }),
      )
    case 'JP': // Japan — white + red circle
      return createElement('svg', { width: size, height: size, viewBox: '0 0 24 24' },
        createElement('rect', { width: 24, height: 24, fill: 'white' }),
        createElement('circle', { cx: 12, cy: 12, r: 6, fill: '#BC002D' }),
      )
    case 'CN': // China — red + yellow star
      return createElement('svg', { width: size, height: size, viewBox: '0 0 24 24' },
        createElement('rect', { width: 24, height: 24, fill: '#DE2910' }),
        createElement('polygon', {
          points: '8,5 9.5,9.5 14,9.5 10.5,12 12,16.5 8,14 4,16.5 5.5,12 2,9.5 6.5,9.5',
          fill: '#FFDE00',
        }),
      )
    case 'KG': // Kyrgyzstan — red + yellow sun
      return createElement('svg', { width: size, height: size, viewBox: '0 0 24 24' },
        createElement('rect', { width: 24, height: 24, fill: '#E8112D' }),
        createElement('circle', { cx: 12, cy: 12, r: 4, fill: '#FFEF00' }),
      )
    case 'VN': // Vietnam — red + yellow star
      return createElement('svg', { width: size, height: size, viewBox: '0 0 24 24' },
        createElement('rect', { width: 24, height: 24, fill: '#DA251D' }),
        createElement('polygon', {
          points: '12,5 13.5,9.5 18,9.5 14.5,12 16,16.5 12,14 8,16.5 9.5,12 6,9.5 10.5,9.5',
          fill: '#FFFF00',
        }),
      )
    default: // Globe
      return createElement('svg', {
        width: size, height: size, viewBox: '0 0 24 24',
        fill: 'none', stroke: '#6B6B6B', strokeWidth: 2,
      },
        createElement('circle', { cx: 12, cy: 12, r: 9 }),
        createElement('path', { d: 'M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18' }),
      )
  }
}

export function getOfficeLabel(dept: string | null | undefined): string {
  switch ((dept ?? '').toUpperCase()) {
    case 'HQ': return '본사 (HQ)'
    case 'UZ': return 'UZ'
    case 'RU': return 'RU'
    case 'JP': return 'JP'
    case 'CN': return 'CN'
    case 'KG': return 'KG'
    case 'VN': return 'VN'
    default:   return dept || 'MTL'
  }
}
