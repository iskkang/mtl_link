import { MessageSquare, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type SidebarTab = 'chat' | 'friends'

interface Props {
  active:   SidebarTab
  onChange: (tab: SidebarTab) => void
}

export function SidebarTabs({ active, onChange }: Props) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-shrink-0 bg-white dark:bg-surface-panel
                    border-b border-gray-200 dark:border-[#374045]">
      {(['chat', 'friends'] as const).map(tab => {
        const isActive = active === tab
        const Icon     = tab === 'chat' ? MessageSquare : Users
        const label    = tab === 'chat' ? t('tabChat') : t('tabFriends')
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5
                        text-sm font-semibold border-b-2 transition-colors
                        ${isActive
                          ? 'border-mtl-cyan text-mtl-navy dark:text-[#e9edef]'
                          : 'border-transparent text-gray-400 dark:text-[#8696a0] hover:text-gray-600 dark:hover:text-[#aebac1]'
                        }`}
          >
            <Icon size={15} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
