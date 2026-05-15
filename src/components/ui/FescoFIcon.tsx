import type { LucideProps } from 'lucide-react'

/**
 * Bold italic "F" mark for FESCO container tracking.
 * Fill-based rects with a forward skew (-8°) to suggest motion/transit.
 * Inherits currentColor — works with RailBtn's active/muted color logic.
 */
export function FescoFIcon({ size = 18, ...props }: LucideProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      {/* skew around center (12,12) → top shifts right, bottom shifts left → italic/forward lean */}
      <g transform="translate(12,12) skewX(-8) translate(-12,-12)">
        {/* Stem */}
        <rect x="5" y="3" width="4" height="18" rx="1" />
        {/* Top bar */}
        <rect x="9" y="3" width="10" height="4" rx="1" />
        {/* Middle bar (shorter — classic F proportion) */}
        <rect x="9" y="11" width="7" height="4" rx="1" />
      </g>
    </svg>
  )
}
