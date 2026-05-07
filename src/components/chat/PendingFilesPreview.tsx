import { useEffect, useState } from 'react'
import { X, FileText, FileSpreadsheet, Archive, Film, File } from 'lucide-react'

interface Props {
  files:    File[]
  onRemove: (index: number) => void
}

export function PendingFilesPreview({ files, onRemove }: Props) {
  if (!files.length) return null

  return (
    <div
      className="flex gap-2 px-3 py-2 overflow-x-auto flex-shrink-0 border-t scrollbar-thin"
      style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
    >
      {files.map((file, idx) => (
        <PendingItem key={`${file.name}-${idx}`} file={file} onRemove={() => onRemove(idx)} />
      ))}
    </div>
  )
}

function PendingItem({ file, onRemove }: { file: File; onRemove: () => void }) {
  const isImage = file.type.startsWith('image/')
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!isImage) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file, isImage])

  return (
    <div className="relative flex-shrink-0 group">
      <div
        className="w-[60px] h-[60px] rounded-xl overflow-hidden border flex flex-col items-center justify-center"
        style={{ borderColor: 'var(--line)', background: 'var(--bg)', color: 'var(--ink-3)' }}
      >
        {isImage && preview ? (
          <img src={preview} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <>
            <MimeIcon mime={file.type} size={22} className="" />
            <span className="mt-0.5 text-[8px] max-w-[52px] truncate px-1 text-center leading-tight">
              {file.name}
            </span>
          </>
        )}
      </div>

      {/* X 버튼 — 터치 타겟 28×28px */}
      <button
        onClick={onRemove}
        className="absolute -top-2 -right-2
                   w-7 h-7 rounded-full flex items-center justify-center
                   text-white shadow-md transition-colors"
        style={{ background: 'var(--ink-3)' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#EF4444')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--ink-3)')}
        aria-label={`${file.name} 제거`}
      >
        <X size={12} />
      </button>

      {/* 파일명 툴팁 (이미지는 hover 시) */}
      {isImage && (
        <div
          className="absolute -bottom-6 left-1/2 -translate-x-1/2
                     opacity-0 group-hover:opacity-100 transition-opacity
                     text-[9px] px-1.5 py-0.5
                     rounded whitespace-nowrap max-w-[80px] truncate pointer-events-none z-10"
          style={{ background: 'var(--ink)', color: 'var(--bg)' }}
        >
          {file.name}
        </div>
      )}
    </div>
  )
}

function MimeIcon({ mime, size, className }: { mime: string; size: number; className?: string }) {
  if (mime.startsWith('video/'))  return <Film        size={size} className={className} />
  if (mime === 'application/pdf' || mime.includes('word')) return <FileText size={size} className={className} />
  if (mime.includes('excel') || mime.includes('spreadsheet') || mime === 'text/csv')
    return <FileSpreadsheet size={size} className={className} />
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z'))
    return <Archive size={size} className={className} />
  return <File size={size} className={className} />
}
