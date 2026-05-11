import { useState, useEffect, useRef } from 'react'
import { Plus, MessageSquare, MoreHorizontal, Star, Pencil, Trash2, Bell, BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useAiSessions, type AiSession } from '../../hooks/useAiSessions'
import { aiEvents } from '../../lib/aiEvents'

interface Props {
  activeSessionId: string | null
  onSelectSession: (id: string) => void
}

interface MenuPos {
  left:    number
  top?:    number
  bottom?: number
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function AiSidebar({ activeSessionId, onSelectSession }: Props) {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const { sessions: fetched, loading } = useAiSessions()
  const isAdmin = profile?.role === 'admin'

  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!isAdmin) return
    void (async () => {
      const [hsRes, kbRes] = await Promise.all([
        supabase.from('hs_code_notes').select('id', { count: 'exact', head: true }).in('approval_status', ['pending_review', 'draft']),
        supabase.from('knowledge_base').select('id', { count: 'exact', head: true }).in('status', ['pending_review', 'draft']),
      ])
      setPendingCount((hsRes.count ?? 0) + (kbRes.count ?? 0))
    })()
  }, [isAdmin])

  // Local copy for optimistic updates
  const [sessions, setSessions] = useState<AiSession[]>([])
  useEffect(() => { setSessions(fetched) }, [fetched])

  // ⋯ dropdown state
  const [menuId,  setMenuId]  = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<MenuPos>({ left: 0, top: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  // Inline rename state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // Close menu on outside click
  useEffect(() => {
    if (!menuId) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuId])

  const openMenu = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const above = rect.bottom + 112 > window.innerHeight
    setMenuPos({
      left: rect.right - 176,
      ...(above
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    })
    setMenuId(prev => (prev === sessionId ? null : sessionId))
  }

  const handleStar = async (session: AiSession) => {
    setMenuId(null)
    const newVal = !session.isStarred
    setSessions(prev => prev.map(s => s.sessionId === session.sessionId ? { ...s, isStarred: newVal } : s))
    if (!user) return
    await supabase
      .from('ai_conversations')
      .update({ is_starred: newVal })
      .eq('session_id', session.sessionId)
      .eq('user_id', user.id)
  }

  const handleRenameClick = (session: AiSession) => {
    setMenuId(null)
    setEditingId(session.sessionId)
    setEditValue(session.title)
  }

  const handleSaveRename = async (sessionId: string) => {
    const newTitle = editValue.trim()
    setEditingId(null)
    if (!newTitle || !user) return
    setSessions(prev => prev.map(s => s.sessionId === sessionId ? { ...s, title: newTitle } : s))
    await supabase
      .from('ai_conversations')
      .update({ session_title: newTitle })
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
    aiEvents.emitTitleChange(sessionId, newTitle)
  }

  const handleDelete = async (sessionId: string) => {
    setMenuId(null)
    setSessions(prev => prev.filter(s => s.sessionId !== sessionId))
    if (!user) return
    await supabase
      .from('ai_conversations')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
    aiEvents.emitDeleted(sessionId)
  }

  // Grouping
  const starredSessions   = sessions.filter(s => s.isStarred)
  const unstarredSessions = sessions.filter(s => !s.isStarred)

  const todayMs     = startOfDay(new Date())
  const yesterdayMs = todayMs - 86_400_000
  const prev7Ms     = todayMs - 7  * 86_400_000
  const prev30Ms    = todayMs - 30 * 86_400_000

  const groupKey = (createdAt: string): string | null => {
    const ms = startOfDay(new Date(createdAt))
    if (ms >= todayMs)     return 'today'
    if (ms >= yesterdayMs) return 'yesterday'
    if (ms >= prev7Ms)     return 'prev7'
    if (ms >= prev30Ms)    return 'prev30'
    return null
  }

  const groups: { key: string; label: string }[] = [
    { key: 'today',     label: t('aiToday')     },
    { key: 'yesterday', label: t('aiYesterday') },
    { key: 'prev7',     label: t('aiPrev7Days') },
    { key: 'prev30',    label: t('aiPrev30Days') },
  ]

  const byGroup = unstarredSessions.reduce<Record<string, AiSession[]>>((acc, s) => {
    const k = groupKey(s.createdAt)
    if (!k) return acc
    ;(acc[k] ??= []).push(s)
    return acc
  }, {})

  const renderItem = (session: AiSession) => {
    const isActive  = activeSessionId === session.sessionId
    const isEditing = editingId === session.sessionId

    return (
      <div
        key={session.sessionId}
        className="group relative flex items-center gap-1 px-3 py-2 rounded-lg mx-1 cursor-pointer"
        style={{ background: isActive ? 'var(--side-row)' : 'transparent' }}
        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--side-row)' }}
        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        onClick={() => { if (!isEditing) onSelectSession(session.sessionId) }}
      >
        {session.isStarred && (
          <Star size={11} className="flex-shrink-0" style={{ color: '#F59E0B', fill: '#F59E0B' }} />
        )}

        {isEditing ? (
          <input
            autoFocus
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => void handleSaveRename(session.sessionId)}
            onKeyDown={e => {
              if (e.key === 'Enter')  { e.preventDefault(); void handleSaveRename(session.sessionId) }
              if (e.key === 'Escape') setEditingId(null)
            }}
            onClick={e => e.stopPropagation()}
            className="flex-1 bg-transparent text-sm outline-none border-b"
            style={{ color: 'var(--side-text)', borderColor: 'var(--brand)' }}
          />
        ) : (
          <span className="flex-1 truncate text-sm" style={{ color: 'var(--side-text)' }}>
            {session.title.slice(0, 32) || '…'}
          </span>
        )}

        {!isEditing && (
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-0.5 rounded transition-opacity"
            style={{ color: 'var(--side-mute)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--side-line)'; e.currentTarget.style.opacity = '1' }}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={e => openMenu(e, session.sessionId)}
          >
            <MoreHorizontal size={13} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">

      {/* New chat */}
      <div className="px-3 py-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => onSelectSession(crypto.randomUUID())}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--brand)' }}
          onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
          onMouseLeave={e => (e.currentTarget.style.filter = '')}
        >
          <Plus size={15} />
          {t('aiNewChat')}
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-2 px-3 py-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: 'var(--side-row)' }} />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center gap-3">
            <MessageSquare size={28} style={{ color: 'var(--side-mute)' }} />
            <p className="text-xs" style={{ color: 'var(--side-mute)' }}>{t('aiNoHistory')}</p>
          </div>
        ) : (
          <>
            {/* Starred section */}
            {starredSessions.length > 0 && (
              <div>
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
                  {t('aiStarred')}
                </p>
                {starredSessions.map(renderItem)}
                {unstarredSessions.length > 0 && (
                  <hr className="mx-3 my-2" style={{ borderColor: 'var(--side-line)' }} />
                )}
              </div>
            )}

            {/* Time-grouped */}
            {groups.map(({ key, label }) => {
              const items = byGroup[key]
              if (!items?.length) return null
              return (
                <div key={key}>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
                    {label}
                  </p>
                  {items.map(renderItem)}
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Bottom nav: Knowledge + Admin */}
      <div className="flex-shrink-0 border-t px-2 py-2 flex flex-col gap-1" style={{ borderColor: 'var(--side-line)' }}>
        <button
          type="button"
          onClick={() => aiEvents.emitNavigate('knowledge')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
          style={{ color: 'var(--side-text)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <BookOpen size={13} />
          {t('knowledgeTitle')}
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => aiEvents.emitNavigate('approval')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{ color: 'var(--side-text)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Bell size={13} />
            {t('aiAdminApproval')}
            {pendingCount > 0 && (
              <span
                className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--brand)', color: 'white' }}
              >
                {pendingCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Dropdown menu — fixed position to escape sidebar overflow */}
      {menuId && (
        <div
          ref={menuRef}
          className="fixed w-44 rounded-xl border shadow-lg z-[200] overflow-hidden"
          style={{
            background:  'var(--card)',
            borderColor: 'var(--line)',
            left:        menuPos.left,
            top:         menuPos.top,
            bottom:      menuPos.bottom,
          }}
        >
          {(() => {
            const session = sessions.find(s => s.sessionId === menuId)
            if (!session) return null
            return (
              <>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left"
                  style={{ color: 'var(--ink)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => void handleStar(session)}
                >
                  <Star
                    size={13}
                    style={{
                      color: session.isStarred ? '#F59E0B' : 'var(--ink-3)',
                      fill:  session.isStarred ? '#F59E0B' : 'none',
                    }}
                  />
                  {session.isStarred ? t('aiStarRemove') : t('aiStarAdd')}
                </button>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left"
                  style={{ color: 'var(--ink)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => handleRenameClick(session)}
                >
                  <Pencil size={13} style={{ color: 'var(--ink-3)' }} />
                  {t('aiRename')}
                </button>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left"
                  style={{ color: '#EF4444' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => void handleDelete(menuId)}
                >
                  <Trash2 size={13} />
                  {t('aiDelete')}
                </button>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
