export type LanguageCode = 'ko' | 'en' | 'zh' | 'ja' | 'ru' | 'uz' | 'und'

/**
 * Unicode-range-first language detection that works on texts as short as 1 char.
 *
 * Priority:
 * 1. Hangul → ko
 * 2. Hiragana/Katakana → ja
 * 3. Cyrillic → ru
 * 4. CJK Han only (no kana) → zh  ← key: 好的, 谢谢, 你好
 * 5. Latin → en  (uz is Latin too; left for future refinement)
 * 6. Otherwise → 'und'
 */
export function detectLanguage(text: string): LanguageCode | null {
  if (!text) return null
  const trimmed = text.trim()
  if (trimmed.length === 0) return null

  let hangul = 0
  let hiragana = 0
  let katakana = 0
  let cjkHan = 0
  let cyrillic = 0
  let latin = 0

  for (const ch of trimmed) {
    const code = ch.codePointAt(0)
    if (code === undefined) continue

    if ((code >= 0xAC00 && code <= 0xD7A3) ||
        (code >= 0x1100 && code <= 0x11FF) ||
        (code >= 0x3130 && code <= 0x318F)) {
      hangul++
    } else if (code >= 0x3040 && code <= 0x309F) {
      hiragana++
    } else if (code >= 0x30A0 && code <= 0x30FF) {
      katakana++
    } else if ((code >= 0x4E00 && code <= 0x9FFF) ||
               (code >= 0x3400 && code <= 0x4DBF)) {
      cjkHan++
    } else if (code >= 0x0400 && code <= 0x04FF) {
      cyrillic++
    } else if ((code >= 0x0041 && code <= 0x005A) ||
               (code >= 0x0061 && code <= 0x007A)) {
      latin++
    }
  }

  if (hangul > 0)              return 'ko'
  if (hiragana > 0 || katakana > 0) return 'ja'
  if (cyrillic > 0)            return 'ru'
  if (cjkHan > 0)              return 'zh'
  if (latin > 0)               return 'en'

  return null
}
