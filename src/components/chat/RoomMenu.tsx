import { useEffect, useRef, useState } from 'react'
import { MoreVertical, LogOut, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  isOwner:   boolean
  onLeave:   () => void
  onDelete:  () => void
}

export function RoomMenu({ isOwner, onLeave, onDelete }: Props) {
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

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="p-2 rounded-full
                   hover:bg-gray-100 dark:hover:bg-surface-hover
                   text-gray-500 dark:text-[#aebac1] transition-colors"
        aria-label="방 메뉴"
      >
        <MoreVertical size={19} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px]
                        bg-white dark:bg-surface-panel
                        border border-gray-200 dark:border-[#374045]
                        rounded-xl shadow-lg dark:shadow-2xl py-1
                        text-sm text-gray-700 dark:text-[#e9edef]">

          <button
            onClick={() => { setOpen(false); onLeave() }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5
                       hover:bg-gray-50 dark:hover:bg-surface-hover
                       text-left transition-colors"
          >
            <LogOut size={15} className="text-gray-400 dark:text-[#8696a0]" />
            {t('roomLeave')}
          </button>

          {isOwner && (
            <button
              onClick={() => { setOpen(false); onDelete() }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5
                         hover:bg-red-50 dark:hover:bg-red-900/20
                         text-red-500 dark:text-red-400
                         text-left transition-colors"
            >
              <Trash2 size={15} />
              {t('roomDelete')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
