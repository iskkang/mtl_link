import { useState } from 'react'
import { ChevronDown, ChevronUp, FileText } from 'lucide-react'

interface Props {
  url:      string
  fileName: string
}

export function PdfPreview({ url, fileName }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-[11px] font-medium
                   text-blue-500 dark:text-blue-400 hover:underline transition-colors"
      >
        <FileText size={11} />
        {open ? '미리보기 닫기' : 'PDF 미리보기'}
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {open && (
        <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 dark:border-[#374045] shadow-sm">
          <iframe
            src={url}
            title={fileName}
            className="w-full bg-white"
            style={{ height: '420px' }}
          />
        </div>
      )}
    </div>
  )
}
