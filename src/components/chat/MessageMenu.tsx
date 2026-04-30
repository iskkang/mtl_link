import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  canEdit:   boolean  // false = 5분 초과
  canDelete: boolean
  onEdit:    () => void
  onDelete:  () => void
}

export function MessageMenu({ canEdit, canDelete, onEdit, onDelete }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!canDelete) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-center w-6 h-6 rounded-full
                   bg-white dark:bg-surface-panel
                   border border-gray-200 dark:border-[#374045]
                   text-gray-400 dark:text-[#8696a0]
                   hover:text-gray-600 dark:hover:text-[#e9edef]
                   shadow-sm transition-colors"
        aria-label="메시지 메뉴"
      >
        <MoreHorizontal size={13} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 right-0 z-50 min-w-[110px]
                        bg-white dark:bg-surface-panel
                        border border-gray-200 dark:border-[#374045]
                        rounded-xl shadow-lg dark:shadow-2xl py-1
                        text-sm text-gray-700 dark:text-[#e9edef]">

          {/* 수정 버튼 */}
          <button
            onClick={() => { if (canEdit) { setOpen(false); onEdit() } }}
            disabled={!canEdit}
            title={canEdit ? undefined : t('msgEditExpired')}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors
              ${canEdit
                ? 'hover:bg-gray-50 dark:hover:bg-surface-hover cursor-pointer'
                : 'opacity-40 cursor-not-allowed'
              }`}
          >
            <Pencil size={13} className="flex-shrink-0" />
            {t('msgEdit')}
          </button>

          {/* 삭제 버튼 */}
          <button
            onClick={() => { setOpen(false); onDelete() }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors
                       text-red-500 dark:text-red-400
                       hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 size={13} className="flex-shrink-0" />
            {t('msgDelete')}
          </button>
        </div>
      )}
    </div>
  )
}
