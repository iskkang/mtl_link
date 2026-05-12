import { type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { useSidebarStore } from '../../stores/sidebarStore'

interface Props {
  id:       string
  label:    string
  onAdd?:   () => void
  children: ReactNode
}

export function CollapsibleSection({ id, label, onAdd, children }: Props) {
  const collapsed = useSidebarStore(s => s.collapsed[id] ?? false)
  const toggle    = useSidebarStore(s => s.toggle)

  return (
    <div>
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ color: 'var(--side-mute)' }}
      >
        <button
          type="button"
          onClick={() => toggle(id)}
          className="flex items-center gap-1 hover:text-[var(--side-text)] transition-colors flex-1 text-left"
        >
          {collapsed
            ? <ChevronRight size={13} />
            : <ChevronDown size={13} />
          }
          <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
        </button>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="p-0.5 rounded hover:text-[var(--side-text)] transition-colors"
            aria-label={`Add to ${label}`}
          >
            <Plus size={14} />
          </button>
        )}
      </div>
      {!collapsed && children}
    </div>
  )
}
