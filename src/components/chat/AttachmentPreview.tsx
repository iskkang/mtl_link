import { useState, useEffect } from 'react'
import { FileText, FileSpreadsheet, Archive, File, Download, ExternalLink } from 'lucide-react'
import { getSignedFileUrl } from '../../hooks/useSignedUrl'
import { ImageModal } from './ImageModal'
import { PdfPreview } from './FilePreview'
import type { Attachment } from '../../types/chat'

interface Props {
  attachments: Attachment[]
}

export function AttachmentPreview({ attachments }: Props) {
  if (!attachments.length) return null

  const images = attachments.filter(a => a.attachment_type === 'image')
  const others = attachments.filter(a => a.attachment_type !== 'image')

  const imageIdKey = images.map(i => i.id).join(',')
  const [imageUrls,  setImageUrls]  = useState<(string | null)[]>([])
  const [modalIndex, setModalIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!images.length) { setImageUrls([]); return }
    let cancelled = false
    Promise.all(images.map(img => getSignedFileUrl(img.file_path).catch(() => null)))
      .then(urls => { if (!cancelled) setImageUrls(urls) })
    return () => { cancelled = true }
  }, [imageIdKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const validUrls  = imageUrls.filter(Boolean) as string[]
  const validNames = images.map(i => i.file_name)

  return (
    <div className="mt-1.5 space-y-1.5">
      {/* 이미지 그리드 */}
      {images.length > 0 && (
        <div className={`grid gap-1 ${images.length >= 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {images.map((att, idx) => (
            <ImageThumbnail
              key={att.id}
              url={imageUrls[idx] ?? null}
              name={att.file_name}
              onClick={() => { if (imageUrls[idx]) setModalIndex(idx) }}
            />
          ))}
        </div>
      )}

      {/* 파일 카드 */}
      {others.map(att => <FileCard key={att.id} attachment={att} />)}

      {/* 이미지 모달 */}
      {modalIndex !== null && validUrls.length > 0 && (
        <ImageModal
          urls={validUrls}
          names={validNames}
          currentIndex={modalIndex}
          onClose={() => setModalIndex(null)}
          onChange={setModalIndex}
        />
      )}
    </div>
  )
}

/* ── 이미지 썸네일 ───────────────────────────────── */
function ImageThumbnail({
  url, name, onClick,
}: {
  url:     string | null
  name:    string
  onClick: () => void
}) {
  if (!url) {
    return (
      <div
        className="rounded-lg overflow-hidden bg-gray-200 dark:bg-surface-hover animate-pulse"
        style={{ aspectRatio: '4/3', maxHeight: '200px' }}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="block group relative rounded-lg overflow-hidden cursor-zoom-in w-full focus:outline-none"
      aria-label={`이미지 크게 보기: ${name}`}
    >
      <img
        src={url}
        alt={name}
        loading="lazy"
        className="w-full object-cover transition-opacity group-hover:opacity-85"
        style={{ maxHeight: '260px' }}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg" />
    </button>
  )
}

/* ── 파일 카드 ───────────────────────────────────── */
function FileCard({ attachment }: { attachment: Attachment }) {
  const [downloading, setDownloading] = useState(false)
  const [pdfUrl,      setPdfUrl]      = useState<string | null>(null)

  const isPdf = attachment.mime_type === 'application/pdf'

  useEffect(() => {
    if (!isPdf) return
    getSignedFileUrl(attachment.file_path).then(setPdfUrl).catch(() => null)
  }, [attachment.file_path, isPdf])

  const handleDownload = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      const url = await getSignedFileUrl(attachment.file_path)
      const a   = document.createElement('a')
      a.href     = url
      a.download = attachment.file_name
      a.target   = '_blank'
      a.click()
    } catch {
      // ignore
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="px-3 py-2.5 rounded-xl
                    bg-black/5 dark:bg-black/20
                    border border-black/5 dark:border-white/5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                        bg-white/60 dark:bg-surface-input">
          <FileTypeIcon mime={attachment.mime_type} className="w-5 h-5 text-gray-500 dark:text-[#8696a0]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate text-gray-800 dark:text-[#e9edef]">
            {attachment.file_name}
          </p>
          <p className="text-[10px] text-gray-400 dark:text-[#8696a0]">
            {formatBytes(attachment.file_size)}
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="p-1.5 rounded-lg flex-shrink-0
                     hover:bg-black/10 dark:hover:bg-white/10
                     text-gray-400 dark:text-[#8696a0]
                     hover:text-gray-700 dark:hover:text-[#e9edef]
                     disabled:opacity-40 transition-colors"
          aria-label="다운로드"
        >
          {downloading
            ? <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin block" />
            : <Download size={15} />
          }
        </button>
        <a
          href="#"
          onClick={async e => {
            e.preventDefault()
            const u = await getSignedFileUrl(attachment.file_path)
            window.open(u, '_blank')
          }}
          className="p-1.5 rounded-lg flex-shrink-0
                     hover:bg-black/10 dark:hover:bg-white/10
                     text-gray-400 dark:text-[#8696a0]
                     hover:text-gray-700 dark:hover:text-[#e9edef]
                     transition-colors"
          aria-label="새 탭에서 열기"
        >
          <ExternalLink size={13} />
        </a>
      </div>

      {isPdf && pdfUrl && (
        <PdfPreview url={pdfUrl} fileName={attachment.file_name} />
      )}
    </div>
  )
}

/* ── 파일 타입 아이콘 ────────────────────────────── */
function FileTypeIcon({ mime, className }: { mime: string; className?: string }) {
  if (mime.startsWith('image/')) return <File className={className} />
  if (mime === 'application/pdf' || mime.includes('word')) return <FileText className={className} />
  if (mime.includes('excel') || mime.includes('spreadsheet') || mime === 'text/csv')
    return <FileSpreadsheet className={className} />
  if (mime.includes('zip')) return <Archive className={className} />
  return <File className={className} />
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
