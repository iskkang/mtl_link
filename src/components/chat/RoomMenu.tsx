import { useEffect, useRef, useState } from 'react'
import { MoreVertical, LogOut, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  isOwner:   boolean
  isDirect:  boolean
  onLeave:   () => void
  onDelete:  () => void
}

export function RoomMenu({ isOwner, isDirect, onLeave, onDelete }: Props) {
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
        className="p-2 rounded-lg transition-colors"
        style={{ color: 'var(--ink-3)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        aria-label="방 메뉴"
      >
        <MoreVertical size={18} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-xl py-1 text-sm border"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--line)',
            boxShadow: 'var(--shadow-lg)',
            color: 'var(--ink)',
          }}
        >
          <button
            onClick={() => { setOpen(false); onLeave() }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors"
            style={{ color: 'var(--ink)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
          >
            <LogOut size={15} style={{ color: 'var(--ink-3)' }} />
            {t('roomLeave')}
          </button>

          {!isDirect && isOwner && (
            <button
              onClick={() => { setOpen(false); onDelete() }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors text-red-500 dark:text-red-400"
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,63,26,0.05)')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
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
