import type { ReactNode } from 'react'

interface Props {
  sidebar: ReactNode
  children: ReactNode
  /** 모바일에서 채팅창 보기 여부 (true=채팅 / false=사이드바) */
  showChat?: boolean
}

export function AppLayout({ sidebar, children, showChat = false }: Props) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* 좌측 사이드바 — always dark navy */}
      <aside
        className={`
          w-full md:w-80 flex-shrink-0 flex flex-col
          border-r
          ${showChat ? 'hidden md:flex' : 'flex'}
        `}
        style={{ background: 'var(--side-bg)', borderColor: 'var(--side-line)' }}
      >
        {sidebar}
      </aside>

      {/* 우측 채팅창 */}
      <main
        className={`
          flex-1 flex flex-col min-w-0
          ${showChat ? 'flex' : 'hidden md:flex'}
        `}
        style={{ background: 'var(--chat-bg)' }}
      >
        {children}
      </main>
    </div>
  )
}
