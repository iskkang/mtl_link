const URL_RE = /https?:\/\/[^\s]+/g

export type LinkPart    = string | { href: string }
export type MentionPart = { userId: string; name: string; isSelf: boolean }
export type TextPart    = string | { href: string } | MentionPart

export function isMentionPart(p: TextPart): p is MentionPart {
  return typeof p === 'object' && 'userId' in p
}

export function linkifyText(text: string): LinkPart[] {
  const result: LinkPart[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  URL_RE.lastIndex = 0
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index))
    }
    result.push({ href: match[0] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex))
  }
  return result
}

/** URL + @mention 통합 파싱. mentions[] 배열과 상관없이 이름이 멤버와 일치하면 하이라이트. */
export function parseMentionsAndLinks(
  text: string,
  _mentions: string[],
  members: { id: string; name: string }[],
  currentUserId: string,
): TextPart[] {
  if (!text) return []

  // URL과 @mention을 함께 캡처
  const COMBINED_RE = /(@[\w가-힣぀-ゟ゠-ヿ]+)|(https?:\/\/[^\s]+)/g

  const result: TextPart[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  COMBINED_RE.lastIndex = 0
  while ((match = COMBINED_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index))
    }

    if (match[1]) {
      // @mention 토큰
      const name   = match[1].slice(1) // @ 제거
      const member = members.find(m => m.name === name)
      if (member) {
        result.push({ userId: member.id, name: member.name, isSelf: member.id === currentUserId })
      } else {
        result.push(match[1])
      }
    } else if (match[2]) {
      // URL
      result.push({ href: match[2] })
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex))
  }

  return result
}

/** @mention 감지 정규식 (getMentionQuery용) */
export const ACTIVE_MENTION_RE = /@([\w가-힣぀-ゟ゠-ヿ]*)$/
