/**
 * 날짜 파싱/계산 유틸리티
 *
 * FESCO는 날짜를 두 가지 형식으로 보냄:
 * - "2026-02-13 09:01:00" (이벤트)
 * - "2026-02-13" (세그먼트)
 *
 * 모두 안전하게 Date로 변환하고, null도 우아하게 처리.
 */

/** FESCO 날짜 문자열을 Date로 변환 */
export function parseFescoDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  // "YYYY-MM-DD" 또는 "YYYY-MM-DD HH:mm:ss"
  const isoLike = s.includes('T') ? s : s.replace(' ', 'T');
  // 시간 부분이 없으면 UTC 자정으로 가정
  const withTz = isoLike.includes(':') ? `${isoLike}Z` : `${isoLike}T00:00:00Z`;
  const d = new Date(withTz);
  return isNaN(d.getTime()) ? null : d;
}

/** 두 날짜 사이의 일수 차이 (자연일 기준) */
export function daysBetween(from: Date | null, to: Date | null): number | null {
  if (!from || !to) return null;
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** 오늘 자정(UTC) 기준 Date 반환 */
export function todayUTC(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Date를 "YYYY-MM-DD"로 포맷 */
export function formatDate(d: Date | null): string | null {
  if (!d) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** 한국어 친화적 날짜 표시 ("5월 19일") */
export function formatDateKR(d: Date | null): string | null {
  if (!d) return null;
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}
