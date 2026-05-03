import type { LucideIcon } from 'lucide-react'

interface MenuItem {
  icon:         LucideIcon
  label:        string
  onClick:      () => void
  destructive?: boolean
}

interface PopUpMenuProps {
  items:           MenuItem[]
  open:            boolean
  onClose:         () => void
  anchorPosition?: { x: number; y: number }
}

export function PopUpMenu({ items, open, onClose, anchorPosition }: PopUpMenuProps) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 min-w-[200px] py-2 rounded-xl bg-surfaceLight-elevated dark:bg-surface-elevated shadow-dialog border border-stroke-light dark:border-stroke-dark"
        style={anchorPosition ? { top: anchorPosition.y, left: anchorPosition.x } : undefined}
      >
        {items.map((item, i) => {
          const Ico = item.icon
          return (
            <button
              key={i}
              onClick={() => { item.onClick(); onClose() }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-headline transition-colors duration-150 hover:bg-surfaceLight-hover dark:hover:bg-surface-hover ${item.destructive ? 'text-status-danger' : 'text-contentLight-primary dark:text-content-primary'}`}
            >
              <Ico size={20} className={item.destructive ? 'text-status-danger' : ''} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}
