import { useState } from 'react'
import { FileText, FileSpreadsheet, Archive, File, Film, Download, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { ImageModal } from './ImageModal'
import { PdfPreview } from './FilePreview'
import type { Attachment } from '../../types/chat'

interface Props {
  attachments: Attachment[]
}

// chat-attachments (public bucket) → 동기 공개 URL
function publicUrl(filePath: string): string {
  const { data } = supabase.storage.from('chat-attachments').getPublicUrl(filePath)
  return data.publicUrl
}

export function AttachmentPreview({ attachments }: Props) {
  if (!attachments.length) return null

  const images = attachments.filter(a => a.attachment_type === 'image')
  const videos = attachments.filter(a => a.attachment_type === 'video')
  const others = attachments.filter(a => a.attachment_type !== 'image' && a.attachment_type !== 'video')

  const imageUrls  = images.map(a => publicUrl(a.file_path))
  const imageNames = images.map(a => a.file_name)

  const [modalIndex, setModalIndex] = useState<number | null>(null)

  return (
    <div className="mt-1.5 space-y-1.5">

      {/* ── 이미지 그리드 ─────────────────────────── */}
      {images.length > 0 && (
        <div className={`grid gap-1 ${images.length >= 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {images.map((att, idx) => (
            <ImageThumbnail
              key={att.id}
              url={imageUrls[idx]}
              name={att.file_name}
              onClick={() => setModalIndex(idx)}
            />
          ))}
        </div>
      )}

      {/* ── 동영상 인라인 플레이어 ───────────────── */}
      {videos.map(att => (
        <video
          key={att.id}
          src={publicUrl(att.file_path)}
          controls
          preload="metadata"
          className="w-full rounded-lg"
          style={{ maxWidth: '280px', maxHeight: '200px' }}
        />
      ))}

      {/* ── 문서 / 기타 파일 카드 ───────────────── */}
      {others.map(att => <FileCard key={att.id} attachment={att} />)}

      {/* ── 이미지 라이트박스 ────────────────────── */}
      {modalIndex !== null && imageUrls.length > 0 && (
        <ImageModal
          urls={imageUrls}
          names={imageNames}
          currentIndex={modalIndex}
          onClose={() => setModalIndex(null)}
          onChange={setModalIndex}
        />
      )}
    </div>
  )
}

/* ── 이미지 썸네일 ───────────────────────────────── */
function ImageThumbnail({ url, name, onClick }: { url: string; name: string; onClick: () => void }) {
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
  const url   = publicUrl(attachment.file_path)
  const isPdf = attachment.mime_type === 'application/pdf'

  const handleDownload = () => {
    const a   = document.createElement('a')
    a.href     = url
    a.download = attachment.file_name
    a.target   = '_blank'
    a.click()
  }

  return (
    <div
      className="px-3 py-2.5 rounded-xl border"
      style={{ background: 'var(--bg-primary)', borderColor: 'var(--line)' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--card)', color: 'var(--ink-3)' }}
        >
          <FileTypeIcon mime={attachment.mime_type} className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: 'var(--ink)' }}>
            {attachment.file_name}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--ink-3)' }}>
            {formatBytes(attachment.file_size)}
          </p>
        </div>
        <button
          onClick={handleDownload}
          className="p-1.5 rounded-lg flex-shrink-0 transition-colors"
          style={{ color: 'var(--ink-3)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.background = 'transparent' }}
          aria-label="다운로드"
        >
          <Download size={15} />
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg flex-shrink-0 transition-colors"
          style={{ color: 'var(--ink-3)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.background = 'transparent' }}
          aria-label="새 탭에서 열기"
        >
          <ExternalLink size={13} />
        </a>
      </div>

      {isPdf && <PdfPreview url={url} fileName={attachment.file_name} />}
    </div>
  )
}

/* ── 파일 타입 아이콘 ────────────────────────────── */
function FileTypeIcon({ mime, className }: { mime: string; className?: string }) {
  if (mime.startsWith('image/'))  return <File        className={className} />
  if (mime.startsWith('video/'))  return <Film        className={className} />
  if (mime === 'application/pdf' || mime.includes('word')) return <FileText className={className} />
  if (mime.includes('excel') || mime.includes('spreadsheet') || mime === 'text/csv')
    return <FileSpreadsheet className={className} />
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z'))
    return <Archive className={className} />
  return <File className={className} />
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
