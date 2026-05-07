import { Fragment } from 'react'
import type { ReactNode } from 'react'

/**
 * 텍스트에서 키워드를 찾아 <mark>로 강조한다.
 * split(captureGroup) 후 홀수 인덱스(1,3,5…)가 매칭된 부분.
 * 긴 키워드를 먼저 매칭해 부분 매칭 우선순위를 보장.
 */
export function highlightKeywords(text: string, keywords: string[]): ReactNode {
  if (!text || !keywords.length) return text

  const active = keywords.filter(Boolean).sort((a, b) => b.length - a.length)
  if (!active.length) return text

  const escaped = active.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts   = text.split(pattern)

  return parts.map((part, i) =>
    // split(captureGroup): 홀수 인덱스 = 매칭 부분
    i % 2 === 1
      ? (
        <mark
          key={i}
          style={{
            background:   'rgba(234,179,8,0.35)',
            color:        'inherit',
            borderRadius: '2px',
            padding:      '0 1px',
          }}
        >
          {part}
        </mark>
      )
      : <Fragment key={i}>{part}</Fragment>,
  )
}
