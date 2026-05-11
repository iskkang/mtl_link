export function MarvisIcon({ size = 18 }: { size?: number }) {
  // Three interlocking arcs (MTL brand colors) on circle r=32, center (50,50)
  // Junctions at SVG angles 0°/120°/240°:
  //   A=(82,50) right  B=(34,78) lower-left  C=(34,22) upper-left
  // Each arc sweeps 240° CW (large-arc=1, sweep=1)
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Cyan — bottom arc (A → C) */}
      <path d="M 82 50 A 32 32 0 1 1 34 22"
        stroke="#21ADE3" strokeWidth="15" strokeLinecap="round" />
      {/* Red — right arc (C → B) */}
      <path d="M 34 22 A 32 32 0 1 1 34 78"
        stroke="#EF4023" strokeWidth="15" strokeLinecap="round" />
      {/* Navy — left arc (B → A) */}
      <path d="M 34 78 A 32 32 0 1 1 82 50"
        stroke="#1A134A" strokeWidth="15" strokeLinecap="round" />
    </svg>
  )
}
