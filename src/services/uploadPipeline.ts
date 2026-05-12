import { useUploadStore } from '../stores/uploadStore'
import { parseDocument } from './documentParser'
import { chunkText } from '../lib/textChunker'
import { supabase } from '../lib/supabase'

class UploadCancelledError extends Error {
  constructor() {
    super('Upload cancelled')
    this.name = 'UploadCancelledError'
  }
}

function isCancelled(err: unknown, signal: AbortSignal): boolean {
  if (err instanceof UploadCancelledError) return true
  if ((err as { name?: string })?.name === 'AbortError') return true
  return signal.aborted
}

function checkAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new UploadCancelledError()
}

async function rollbackUpload(uploadId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('knowledge_base').delete() as any).eq('upload_id', uploadId)
  if (error) console.error('[upload] rollback error:', error)
}

export async function startKnowledgeUpload(params: {
  file:     File
  title:    string
  category: string
  userId:   string
}): Promise<void> {
  const { file, title, category, userId } = params

  if (useUploadStore.getState().active) {
    throw new Error('UPLOAD_IN_PROGRESS')
  }

  const uploadId   = crypto.randomUUID()
  const controller = new AbortController()
  const { signal } = controller

  useUploadStore.getState().start({ uploadId, fileName: file.name, title, controller })

  try {
    // ─── Phase 1: Parse ───────────────────────────────────────────────────
    const parsed = await parseDocument(file, {
      signal,
      onProgress: (p) =>
        useUploadStore.getState().updateProgress({
          phase:   'parsing',
          current: p.current,
          total:   p.total,
          message: p.message,
        }),
    })

    if (!parsed) {
      throw new Error('지원하지 않는 파일 형식입니다')
    }

    checkAborted(signal)

    const chunks: { content: string; index: number; total: number }[] = (() => {
      if (parsed.chunks && parsed.chunks.length > 0) {
        return parsed.chunks.map((content, index) => ({
          content,
          index,
          total: parsed.chunks!.length,
        }))
      }
      if (!parsed.text) return []
      return chunkText(parsed.text)
    })()

    if (chunks.length === 0) {
      throw new Error('파일에서 텍스트를 추출할 수 없습니다')
    }

    // ─── Phase 2: Embed + Insert (per chunk via Edge Function) ────────────
    useUploadStore.getState().updateProgress({
      phase:   'embedding',
      current: 0,
      total:   chunks.length,
      message: `처리 중... 0/${chunks.length}`,
    })

    for (const chunk of chunks) {
      checkAborted(signal)

      const { error } = await supabase.functions.invoke('embed-knowledge', {
        body: {
          title,
          category,
          content:     chunk.content,
          source_file: file.name,
          chunk_index: chunk.index,
          chunk_total: chunk.total,
          created_by:  userId,
          upload_id:   uploadId,
        },
      })

      if (error) throw error

      useUploadStore.getState().updateProgress({
        phase:   'embedding',
        current: chunk.index + 1,
        total:   chunks.length,
        message: `처리 중... (${chunk.index + 1}/${chunks.length})`,
      })
    }

    useUploadStore.getState().updateProgress({
      phase:   'embedding',
      current: chunks.length,
      total:   chunks.length,
      message: '완료!',
    })

    useUploadStore.getState().finish('done')
  } catch (err) {
    const cancelled = isCancelled(err, signal)
    await rollbackUpload(uploadId)
    useUploadStore.getState().finish(cancelled ? 'cancelled' : 'failed')
    if (!cancelled) console.error('[upload] failed:', err)
  }
}
