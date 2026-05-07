import type { ReactNode } from 'react'

/**
 * Splits `text` at occurrences of any keyword (case-insensitive) and returns
 * an array of plain strings and highlighted <mark> spans.
 */
export function highlightKeywords(text: string, keywords: string[]): ReactNode[] {
  if (!keywords.length) return [text]

  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts   = text.split(pattern)

  return parts.map((part, i) =>
    pattern.test(part)
      ? (
        <mark
          key={i}
          style={{
            background:    'rgba(234,179,8,0.35)',
            color:         'inherit',
            borderRadius:  '2px',
            padding:       '0 1px',
          }}
        >
          {part}
        </mark>
      )
      : part,
  )
}
