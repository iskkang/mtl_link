import { format, isToday, isYesterday, parseISO, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'

export function formatMessageTime(dateStr: string): string {
  return format(parseISO(dateStr), 'HH:mm')
}

export function formatRoomTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = parseISO(dateStr)
  if (isToday(date)) return format(date, 'HH:mm')
  if (isYesterday(date)) return '어제'
  return format(date, 'M/d')
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
