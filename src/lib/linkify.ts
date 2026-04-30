const URL_RE = /https?:\/\/[^\s]+/g

export type LinkPart = string | { href: string }

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
