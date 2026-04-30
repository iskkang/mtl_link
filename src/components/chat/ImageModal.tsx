import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react'

interface Props {
  urls:         string[]
  names:        string[]
  currentIndex: number
  onClose:      () => void
  onChange:     (i: number) => void
}

export function ImageModal({ urls, names, currentIndex, onClose, onChange }: Props) {
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < urls.length - 1

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape')                onClose()
    if (e.key === 'ArrowLeft'  && hasPrev) onChange(currentIndex - 1)
    if (e.key === 'ArrowRight' && hasNext) onChange(currentIndex + 1)
  }, [onClose, onChange, currentIndex, hasPrev, hasNext])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prev
    }
  }, [handleKey])

  const handleDownload = () => {
    const a   = document.createElement('a')
    a.href     = urls[currentIndex]
    a.download = names[currentIndex] ?? 'image'
    a.target   = '_blank'
    a.click()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/92"
      onClick={onClose}
    >
      {/* 상단 바 */}
      <div
        className="absolute top-0 inset-x-0 flex items-center justify-between
                   px-4 py-3 bg-gradient-to-b from-black/70 to-transparent"
        onClick={e => e.stopPropagation()}
      >
        <span className="text-white/60 text-sm font-medium">
          {urls.length > 1 && `${currentIndex + 1} / ${urls.length}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg hover:bg-white/15 text-white/80 hover:text-white transition-colors"
            aria-label="다운로드"
          >
            <Download size={18} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/15 text-white/80 hover:text-white transition-colors"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* 이미지 */}
      <img
        src={urls[currentIndex]}
        alt={names[currentIndex]}
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg select-none"
        onClick={e => e.stopPropagation()}
        draggable={false}
      />

      {/* 이전 */}
      {hasPrev && (
        <button
          className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full
                     bg-black/50 hover:bg-black/75 text-white transition-colors"
          onClick={e => { e.stopPropagation(); onChange(currentIndex - 1) }}
          aria-label="이전 이미지"
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* 다음 */}
      {hasNext && (
        <button
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full
                     bg-black/50 hover:bg-black/75 text-white transition-colors"
          onClick={e => { e.stopPropagation(); onChange(currentIndex + 1) }}
          aria-label="다음 이미지"
        >
          <ChevronRight size={22} />
        </button>
      )}
    </div>,
    document.body,
  )
}
