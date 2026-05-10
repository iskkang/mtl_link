export interface TextChunk {
  content: string
  index: number
  total: number
}

const CHUNK_SIZE = 800
const OVERLAP    = 100

export function chunkText(
  text: string,
  chunkSize = CHUNK_SIZE,
  overlap    = OVERLAP,
): TextChunk[] {
  if (!text.trim()) return []

  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0)

  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > chunkSize) {
      if (current.trim()) {
        chunks.push(current.trim())
        current = current.slice(-overlap) + '\n\n' + para
      } else {
        // single paragraph exceeds chunkSize — force-split
        let i = 0
        while (i < para.length) {
          chunks.push(para.slice(i, i + chunkSize))
          i += chunkSize - overlap
        }
        current = ''
      }
    } else {
      current = current ? current + '\n\n' + para : para
    }
  }

  if (current.trim()) chunks.push(current.trim())

  return chunks.map((content, index) => ({
    content,
    index,
    total: chunks.length,
  }))
}

export function previewChunks(text: string): { count: number; preview: string[] } {
  const chunks = chunkText(text)
  return {
    count:   chunks.length,
    preview: chunks.slice(0, 3).map(c => c.content.slice(0, 100) + '...'),
  }
}
