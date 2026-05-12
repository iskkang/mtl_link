import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarState {
  collapsed: Record<string, boolean>
  toggle: (id: string) => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: {},
      toggle: (id) =>
        set((s) => ({
          collapsed: { ...s.collapsed, [id]: !s.collapsed[id] },
        })),
    }),
    { name: 'mtl-sidebar-collapsed' },
  ),
)
