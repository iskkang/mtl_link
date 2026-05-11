import { useState, useRef } from 'react'
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { embedDocumentFile, type EmbedProgress } from '../../services/embedKnowledgeService'
import { getSupportedFileType } from '../../services/documentParser'

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.xls', '.txt', '.csv']
const ACCEPT = SUPPORTED_EXTENSIONS.join(',')

interface Props {
  onComplete?: () => void
}

export function DocumentUploadPanel({ onComplete }: Props) {
  const { t } = useTranslation()
  const { profile } = useAuth()

  const CATEGORIES = [
    { label: t('categoryQa'),        value: 'qa' },
    { label: t('categoryCustoms'),   value: 'customs' },
    { label: t('categoryMessage'),   value: 'message' },
    { label: t('categoryQuotation'), value: 'quotation' },
    { label: t('categoryTracking'),  value: 'tracking' },
    { label: t('categoryClaim'),     value: 'claim' },
    { label: t('categoryGeneral'),   value: 'general' },
  ]

  const [file,     setFile]     = useState<File | null>(null)
  const [title,    setTitle]    = useState('')
  const [category, setCategory] = useState('qa')
  const [progress, setProgress] = useState<EmbedProgress | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [done,     setDone]     = useState(false)
  const [dragging, setDragging] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    const fileType = getSupportedFileType(f)
    if (!fileType) {
      setError(`지원하지 않는 파일 형식입니다.\n지원 형식: ${SUPPORTED_EXTENSIONS.join(', ')}`)
      return
    }
    setFile(f)
    setTitle(f.name.replace(/\.[^/.]+$/, ''))
    setError(null)
    setDone(false)
    setProgress(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleSubmit = async () => {
    if (!file || !title.trim() || !profile?.id) return
    setError(null)
    setDone(false)

    const result = await embedDocumentFile({
      file,
      title:    title.trim(),
      category,
      userId:   profile.id,
      onProgress: setProgress,
    })

    if (result.success) {
      setDone(true)
      setFile(null)
      setTitle('')
      setProgress(null)
      onComplete?.()
    } else {
      const msg = result.error?.includes('SCAN_PDF')
        ? 'PDF에서 텍스트를 추출할 수 없습니다.\n스캔(이미지) PDF는 지원하지 않습니다.\n텍스트로 저장된 PDF만 업로드 가능합니다.'
        : (result.error ?? '업로드 중 오류가 발생했습니다')
      setError(msg)
    }
  }

  const isUploading = progress?.status === 'parsing' || progress?.status === 'embedding'

  return (
    <div className="flex flex-col gap-4 p-4">

      {/* Drop zone */}
      <div
        className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 transition-colors"
        style={{
          borderColor: dragging ? 'var(--brand)' : 'var(--line)',
          background:  dragging ? 'rgba(99,102,241,0.06)' : 'var(--bg)',
          cursor:      file ? 'default' : 'pointer',
        }}
        onClick={() => { if (!file) inputRef.current?.click() }}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {file ? (
          <div className="flex items-center gap-2 w-full">
            <FileText size={20} style={{ color: 'var(--brand)', flexShrink: 0 }} />
            <span className="flex-1 text-sm truncate" style={{ color: 'var(--ink-1)' }}>
              {file.name}
            </span>
            <button
              onClick={e => { e.stopPropagation(); setFile(null); setTitle(''); setError(null) }}
              className="p-1 rounded"
              style={{ color: 'var(--ink-3)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <Upload size={28} style={{ color: 'var(--ink-3)' }} />
            <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
              파일을 드래그하거나 클릭해서 선택
            </p>
            <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
              PDF · DOCX · XLSX · TXT 지원
            </p>
            <p className="text-xs" style={{ color: 'var(--ink-4)' }}>
              ※ 스캔된 PDF(이미지)는 지원하지 않습니다
            </p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        className="hidden"
      />

      {/* Title + category */}
      {file && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--ink-3)' }}>제목 *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="지식 제목 입력"
              maxLength={100}
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: 'var(--bg)',
                border:     '1px solid var(--line)',
                color:      'var(--ink-1)',
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--ink-3)' }}>카테고리</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: 'var(--bg)',
                border:     '1px solid var(--line)',
                color:      'var(--ink-1)',
              }}
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </>
      )}

      {/* Error */}
      {error && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-lg"
          style={{ background: '#fee2e2', color: '#dc2626' }}
        >
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <p className="text-xs whitespace-pre-line">{error}</p>
        </div>
      )}

      {/* Progress */}
      {progress && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {progress.status === 'done'
              ? <CheckCircle size={16} style={{ color: '#22c55e' }} />
              : <Loader2 size={16} className="animate-spin" style={{ color: 'var(--brand)' }} />
            }
            <span className="text-xs" style={{ color: 'var(--ink-2)' }}>
              {progress.message}
            </span>
          </div>
          {progress.total > 0 && progress.status === 'embedding' && (
            <div
              className="w-full h-1.5 rounded-full overflow-hidden"
              style={{ background: 'var(--line)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width:      `${(progress.current / progress.total) * 100}%`,
                  background: 'var(--brand)',
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Done */}
      {done && (
        <div
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: '#dcfce7', color: '#16a34a' }}
        >
          업로드 완료! 관리자 승인 후 AI가 참조합니다.
        </div>
      )}

      {/* Submit button */}
      {file && !done && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!title.trim() || isUploading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            background:  title.trim() && !isUploading ? 'var(--brand)' : 'transparent',
            color:       title.trim() && !isUploading ? 'white' : 'var(--ink-3)',
            border:      `1px solid ${title.trim() && !isUploading ? 'var(--brand)' : 'var(--line)'}`,
            cursor:      title.trim() && !isUploading ? 'pointer' : 'not-allowed',
          }}
        >
          {isUploading
            ? <><Loader2 size={16} className="animate-spin" /> 처리 중...</>
            : <><Upload size={16} /> 업로드</>
          }
        </button>
      )}
    </div>
  )
}
