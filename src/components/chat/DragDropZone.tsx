import { useRef, useState, type ReactNode, type DragEvent } from 'react'
import { Upload } from 'lucide-react'

interface Props {
  children:        ReactNode
  disabled?:       boolean
  onError:         (msg: string) => void
  onFilesSelected: (files: File[]) => void
}

export function DragDropZone({ children, disabled, onError: _onError, onFilesSelected }: Props) {
  const dragCountRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault()
    if (disabled) return
    if (!e.dataTransfer.types.includes('Files')) return
    dragCountRef.current++
    if (dragCountRef.current === 1) setIsDragging(true)
  }

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault()
    dragCountRef.current = Math.max(0, dragCountRef.current - 1)
    if (dragCountRef.current === 0) setIsDragging(false)
  }

  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    dragCountRef.current = 0
    setIsDragging(false)
    if (disabled) return

    const files = Array.from(e.dataTransfer.files)
    if (!files.length) return
    onFilesSelected(files)
  }

  return (
    <div
      className="relative flex-1 flex flex-col min-h-0"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {children}

      {/* 드래그 오버레이 */}
      {isDragging && !disabled && (
        <div className="absolute inset-0 z-30 flex items-center justify-center
                        bg-mtl-cyan/10 dark:bg-accent/10
                        backdrop-blur-sm pointer-events-none
                        border-2 border-dashed border-mtl-cyan dark:border-accent
                        rounded-lg m-1">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-full bg-mtl-cyan/20 dark:bg-accent/20
                            flex items-center justify-center">
              <Upload size={28} className="text-mtl-cyan dark:text-accent" />
            </div>
            <p className="text-base font-semibold text-mtl-navy dark:text-[#e9edef]">
              파일을 여기에 놓으세요
            </p>
            <p className="text-xs text-gray-500 dark:text-[#8696a0]">
              이미지·동영상·문서·기타 모든 파일 (최대 5개, 50MB)
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
