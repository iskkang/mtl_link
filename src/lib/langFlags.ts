export const LANG_FLAGS: Record<string, string> = {
  ko: '🇰🇷',
  en: '🇬🇧',
  ru: '🇷🇺',
  uz: '🇺🇿',
  zh: '🇨🇳',
  ja: '🇯🇵',
}

export const getLangFlag = (lang: string): string => LANG_FLAGS[lang] ?? '🌐'

export const getTranslationBadge = (sourceLang: string, targetLang: string): string => {
  if (sourceLang === targetLang) return ''
  return `${LANG_FLAGS[sourceLang] ?? '🌐'} → ${LANG_FLAGS[targetLang] ?? '🌐'}`
}
