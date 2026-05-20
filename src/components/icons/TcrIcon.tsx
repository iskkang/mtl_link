import type { SVGProps } from 'react'

export function TcrIcon({ size = 24, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      {...props}
    >
      {/* 하단이 열린 원형 링 (레일 휠 모티프) */}
      <circle
        cx="16" cy="14" r="11"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="56 14"
        transform="rotate(125 16 14)"
      />
      {/* 레일 단면 (I-beam): 헤드 / 웹 / 베이스 */}
      <rect x="11.5" y="9" width="9" height="5" rx="1.5" fill="currentColor" stroke="none" />
      <rect x="14.5" y="13" width="3" height="9" fill="currentColor" stroke="none" />
      <rect x="11" y="21" width="10" height="3.5" rx="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}
