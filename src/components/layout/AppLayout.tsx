import type { ReactNode } from 'react'

interface Props {
  sidebar: ReactNode
  children: ReactNode
  /** 모바일에서 채팅창 보기 여부 (true=채팅 / false=사이드바) */
  showChat?: boolean
}

export function AppLayout({ sidebar, children, showChat = false }: Props) {
  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-surface-chat">
      {/* 좌측 사이드바 */}
      <aside
        className={`
          w-full md:w-80 flex-shrink-0 flex flex-col
          border-r border-gray-200 dark:border-surface-panel
          bg-[#f9f9f9] dark:bg-surface
          ${showChat ? 'hidden md:flex' : 'flex'}
        `}
      >
        {sidebar}
      </aside>

      {/* 우측 채팅창 */}
      <main
        className={`
          flex-1 flex flex-col min-w-0
          bg-white dark:bg-surface-chat
          ${showChat ? 'flex' : 'hidden md:flex'}
        `}
      >
        {children}
      </main>
    </div>
  )
}
