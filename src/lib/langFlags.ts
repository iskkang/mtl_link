export const LANG_FLAGS: Record<string, string> = {
  ko: '🇰🇷',
  en: '🇬🇧',
  ru: '🇷🇺',
  uz: '🇺🇿',
  zh: '🇨🇳',
  ja: '🇯🇵',
}

export const LANG_NAMES: Record<string, string> = {
  ko: '한국어',
  en: 'English',
  ru: 'Русский',
  uz: "O'zbek",
  zh: '中文',
  ja: '日本語',
}

export const getLangFlag = (lang: string): string => LANG_FLAGS[lang] ?? '🌐'
export const getLangName = (lang: string): string => LANG_NAMES[lang] ?? lang.toUpperCase()

export const getTranslationBadge = (sourceLang: string, targetLang: string): string => {
  if (sourceLang === targetLang) return ''
  return `${LANG_FLAGS[sourceLang] ?? '🌐'} → ${LANG_FLAGS[targetLang] ?? '🌐'}`
}
