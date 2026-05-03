import { format, isToday, isYesterday, parseISO, isSameDay, differenceInMinutes, isThisWeek } from 'date-fns'
import { ko, enUS, ru, zhCN, ja } from 'date-fns/locale'
import type { Locale } from 'date-fns'

const DATE_LOCALES: Record<string, Locale> = {
  ko, en: enUS, ru, uz: ru, zh: zhCN, ja,
}

const JUST_NOW_TEXT: Record<string, string> = {
  ko: '방금', en: 'Just now', ru: 'Только что', uz: 'Hozirgina', zh: '刚刚', ja: 'たった今',
}

const YESTERDAY_TEXT: Record<string, string> = {
  ko: '어제', en: 'Yesterday', ru: 'Вчера', uz: 'Kecha', zh: '昨天', ja: '昨日',
}

const DATE_FMT: Record<string, string> = {
  ko: 'M월d일', en: 'MMM d', ru: 'd MMM', uz: 'd MMM', zh: 'M月d日', ja: 'M月d日',
}

export function formatMessageTime(dateStr: string): string {
  return format(parseISO(dateStr), 'HH:mm')
}

export function formatRoomTime(dateStr: string | null, lang = 'ko'): string {
  if (!dateStr) return ''
  const date = parseISO(dateStr)
  const now = new Date()
  if (differenceInMinutes(now, date) < 1) return JUST_NOW_TEXT[lang] ?? JUST_NOW_TEXT.ko
  if (isToday(date)) return format(date, 'HH:mm')
  if (isYesterday(date)) return YESTERDAY_TEXT[lang] ?? YESTERDAY_TEXT.ko
  const locale = DATE_LOCALES[lang] ?? DATE_LOCALES.ko
  if (isThisWeek(date, { weekStartsOn: 1 })) return format(date, 'EEEE', { locale })
  return format(date, DATE_FMT[lang] ?? DATE_FMT.ko, { locale })
}

export function formatFullDateTime(dateStr: string): string {
  return format(parseISO(dateStr), 'yyyy년 M월 d일 HH:mm', { locale: ko })
}

export function formatDateSeparator(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return '오늘'
  if (isYesterday(date)) return '어제'
  return format(date, 'yyyy년 M월 d일 EEEE', { locale: ko })
}

export function isSameDayStr(a: string, b: string): boolean {
  return isSameDay(parseISO(a), parseISO(b))
}
