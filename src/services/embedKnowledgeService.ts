import { supabase } from '../lib/supabase'
import { parseDocument } from './documentParser'
import { chunkText } from '../lib/textChunker'

const EMBED_FUNCTION = 'embed-knowledge'

export interface EmbedProgress {
  total:   number
  current: number
  status:  'parsing' | 'embedding' | 'done' | 'error'
  message: string
}

export async function embedDocumentFile(params: {
  file:        File
  title:       string
  category:    string | null
  userId:      string
  onProgress?: (progress: EmbedProgress) => void
}): Promise<{ success: boolean; chunkCount: number; error?: string }> {
  const { file, title, category, userId, onProgress } = params

  onProgress?.({ total: 0, current: 0, status: 'parsing', message: '파일 읽는 중...' })

  const parsed = await parseDocument(file)
  if (!parsed) {
    return { success: false, chunkCount: 0, error: '지원하지 않는 파일 형식입니다 (DOCX, XLSX, TXT만 가능)' }
  }
  if (!parsed.text) {
    return { success: false, chunkCount: 0, error: '파일에서 텍스트를 추출할 수 없습니다' }
  }

  const chunks = chunkText(parsed.text)
  if (chunks.length === 0) {
    return { success: false, chunkCount: 0, error: '내용이 비어있습니다' }
  }

  let success = true
  for (const chunk of chunks) {
    onProgress?.({
      total:   chunk.total,
      current: chunk.index + 1,
      status:  'embedding',
      message: `임베딩 중... (${chunk.index + 1}/${chunk.total})`,
    })

    const { error } = await supabase.functions.invoke(EMBED_FUNCTION, {
      body: {
        title,
        category,
        content:     chunk.content,
        source_file: file.name,
        chunk_index: chunk.index,
        chunk_total: chunk.total,
        created_by:  userId,
      },
    })

    if (error) {
      console.error('[embedDocument] chunk error:', error)
      success = false
      break
    }

    if (chunk.index < chunk.total - 1) {
      await new Promise(r => setTimeout(r, 200))
    }
  }

  onProgress?.({
    total:   chunks.length,
    current: chunks.length,
    status:  success ? 'done' : 'error',
    message: success
      ? `완료! ${chunks.length}개 청크가 검토 대기 중입니다.`
      : '일부 청크 처리 중 오류가 발생했습니다.',
  })

  return { success, chunkCount: chunks.length }
}
