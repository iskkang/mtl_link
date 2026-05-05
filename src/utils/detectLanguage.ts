import { franc } from 'franc-min'

// ISO 639-3 → ISO 639-1 (supported app languages)
const ISO3_TO_1: Record<string, string> = {
  kor: 'ko',
  eng: 'en',
  rus: 'ru',
  uzb: 'uz',
  cmn: 'zh',
  jpn: 'ja',
}

/**
 * Detects language of text. Returns ISO 639-1 code for supported languages,
 * or null if undetermined / text is too short.
 */
export function detectLanguage(text: string): string | null {
  if (!text || text.trim().length < 5) return null
  const iso3 = franc(text, { minLength: 5 })
  if (iso3 === 'und') return null
  return ISO3_TO_1[iso3] ?? null
}
