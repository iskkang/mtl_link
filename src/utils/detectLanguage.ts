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

function detectByUnicode(text: string): string | null {
  const koreanCount  = (text.match(/[가-힣ᄀ-ᇿ㄰-㆏]/g) ?? []).length
  const chineseCount = (text.match(/[一-鿿]/g) ?? []).length
  const japaneseCount = (text.match(/[぀-ヿ]/g) ?? []).length
  const cyrillicCount = (text.match(/[Ѐ-ӿ]/g) ?? []).length
  const latinCount   = (text.match(/[A-Za-z]/g) ?? []).length

  const total = koreanCount + chineseCount + japaneseCount + cyrillicCount + latinCount
  if (total === 0) return null

  const threshold = total * 0.3

  if (koreanCount  >= threshold && koreanCount  === Math.max(koreanCount, chineseCount, japaneseCount, cyrillicCount, latinCount)) return 'ko'
  if (japaneseCount >= threshold && japaneseCount === Math.max(koreanCount, chineseCount, japaneseCount, cyrillicCount, latinCount)) return 'ja'
  if (chineseCount >= threshold && chineseCount  === Math.max(koreanCount, chineseCount, japaneseCount, cyrillicCount, latinCount)) return 'zh'
  if (cyrillicCount >= threshold) return 'ru'
  // 라틴 계열(en/uz 등)은 franc에 위임
  return null
}

/**
 * Detects language of text. Returns ISO 639-1 code for supported languages,
 * or null if undetermined / text is too short.
 */
export function detectLanguage(text: string): string | null {
  if (!text || text.trim().length < 2) return null

  // 1. 유니코드 범위로 먼저 판별 (한/중/일/러 오감지 방지)
  const unicodeResult = detectByUnicode(text)
  if (unicodeResult) return unicodeResult

  // 2. 라틴 계열은 franc으로 구분 (en / uz 등)
  if (text.trim().length < 5) return null
  const iso3 = franc(text, { minLength: 5 })
  if (iso3 === 'und') return null
  return ISO3_TO_1[iso3] ?? null
}
