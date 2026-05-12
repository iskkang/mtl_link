export function MintIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="16,4 4,16 16,16" fill="#5eead4"/>
      <polygon points="16,4 28,16 16,16" fill="#14b8a6"/>
      <polygon points="4,16 16,28 16,16" fill="#0d9488"/>
      <polygon points="28,16 16,28 16,16" fill="#134e4a"/>
    </svg>
  )
}

export { MintIcon as MarvisIcon }
