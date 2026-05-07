import { useState, useEffect, useRef } from 'react'
import { Send, Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { aiEvents } from '../../lib/aiEvents'
import { AiQuickActions } from './AiQuickActions'
import { AiQuickBar } from './AiQuickBar'

interface AiMessage {
  id:      string
  role:    'user' | 'assistant'
  content: string
}

interface Props {
  sessionId:      string | null
  onNewSession:   (id: string) => void
  onNavigate?:    (view: 'quotation' | 'message') => void
  onDelete?:      () => void
  onTitleChange?: () => void
}

export function AiChatWindow({ sessionId, onNewSession, onNavigate, onDelete, onTitleChange }: Props) {
  const { t, i18n } = useTranslation()
  const { user, profile } = useAuth()
  const [messages,      setMessages]      = useState<AiMessage[]>([])
  const [sessionTitle,  setSessionTitle]  = useState('')
  const [draft,         setDraft]         = useState('')
  const [loading,       setLoading]       = useState(false)
  const [fetching,      setFetching]      = useState(false)
  const [menuOpen,      setMenuOpen]      = useState(false)
  const [editing,       setEditing]       = useState(false)
  const [editValue,     setEditValue]     = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const menuRef   = useRef<HTMLDivElement>(null)

  // Reflect title renames made from the sidebar
  useEffect(() => {
    return aiEvents.onTitleChange((sid, newTitle) => {
      if (sid === sessionId) setSessionTitle(newTitle)
    })
  }, [sessionId])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Load session messages when sessionId changes
  useEffect(() => {
    if (!sessionId || !user) { setMessages([]); setSessionTitle(''); return }
    setFetching(true)
    void supabase
      .from('ai_conversations')
      .select('id, question, answer, session_title, created_at')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        const rows = data ?? []
        const first = rows.find(r => r.session_title)
        setSessionTitle(first?.session_title ?? (rows[0]?.question ?? '').slice(0, 30))
        const msgs: AiMessage[] = []
        for (const row of rows) {
          if (row.question) msgs.push({ id: row.id + '-q', role: 'user',      content: row.question })
          if (row.answer)   msgs.push({ id: row.id + '-a', role: 'assistant', content: row.answer   })
        }
        setMessages(msgs)
        setFetching(false)
      })
  }, [sessionId, user])

  // Scroll to bottom on new messages / loading change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async (text: string) => {
    const content = text.trim()
    if (!content || loading || !user) return

    const sid = sessionId ?? crypto.randomUUID()
    if (!sessionId) onNewSession(sid)

    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content }])
    setDraft('')
    setLoading(true)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-chat', {
        body: {
          sessionId:    sid,
          message:      content,
          userLanguage: profile?.preferred_language ?? i18n.language ?? 'ko',
          userId:       user.id,
        },
      })
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: data.answer }])
      // Set title from first message
      if (!sessionTitle) {
        setSessionTitle(content.slice(0, 30))
        onTitleChange?.()
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id:      crypto.randomUUID(),
        role:    'assistant',
        content: err instanceof Error ? err.message : 'Error',
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend(draft)
    }
  }

  const handleRenameClick = () => {
    setEditValue(sessionTitle)
    setEditing(true)
    setMenuOpen(false)
  }

  const handleSaveTitle = async () => {
    const newTitle = editValue.trim()
    setEditing(false)
    if (!newTitle || newTitle === sessionTitle || !sessionId || !user) return
    setSessionTitle(newTitle)
    await supabase
      .from('ai_conversations')
      .update({ session_title: newTitle })
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
    onTitleChange?.()
  }

  const handleDelete = async () => {
    setMenuOpen(false)
    if (!sessionId || !user) return
    await supabase
      .from('ai_conversations')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
    onDelete?.()
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--chat-bg)' }}>

      {/* Header — only when session has messages */}
      {hasMessages && sessionId && (
        <div
          className="flex items-center justify-between px-4 h-14 border-b flex-shrink-0"
          style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
        >
          {editing ? (
            <input
              autoFocus
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={() => void handleSaveTitle()}
              onKeyDown={e => { if (e.key === 'Enter') void handleSaveTitle() }}
              className="flex-1 text-sm font-medium outline-none bg-transparent border-b mr-4"
              style={{ color: 'var(--ink)', borderColor: 'var(--brand)' }}
            />
          ) : (
            <span className="text-sm font-medium truncate flex-1 mr-2" style={{ color: 'var(--ink)' }}>
              {sessionTitle}
            </span>
          )}

          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(v => !v)}
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--ink-3)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <MoreHorizontal size={16} />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-40 rounded-xl border shadow-lg z-50 overflow-hidden"
                style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
              >
                <button
                  type="button"
                  onClick={handleRenameClick}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left"
                  style={{ color: 'var(--ink)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Pencil size={13} />
                  {t('aiRename')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left"
                  style={{ color: '#EF4444' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Trash2 size={13} />
                  {t('aiDelete')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Message area */}
      <div className="flex-1 overflow-y-auto">
        {fetching ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--ink-4)' }} />
          </div>
        ) : !hasMessages ? (
          <AiQuickActions
            onSelect={text => void handleSend(text)}
            onNavigate={onNavigate}
          />
        ) : (
          <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto w-full">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 text-sm"
                    style={{ background: 'var(--blue-soft)', color: 'var(--brand)' }}
                  >
                    🤖
                  </div>
                )}
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'
                  }`}
                  style={{
                    background: msg.role === 'user' ? 'var(--brand)' : 'var(--card)',
                    color:      msg.role === 'user' ? 'white'        : 'var(--ink)',
                    border:     msg.role === 'assistant' ? '1px solid var(--line)' : 'none',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex justify-start">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mr-2 text-sm"
                  style={{ background: 'var(--blue-soft)', color: 'var(--brand)' }}
                >
                  🤖
                </div>
                <div
                  className="px-4 py-3 rounded-2xl rounded-tl-sm border"
                  style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
                >
                  <div className="flex gap-1 items-center h-4">
                    {[0, 150, 300].map(delay => (
                      <span
                        key={delay}
                        className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{ background: 'var(--ink-4)', animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Quick bar — only when messages exist */}
      {hasMessages && (
        <AiQuickBar onSelect={text => void handleSend(text)} onNavigate={onNavigate} />
      )}

      {/* Input */}
      <div
        className="flex-shrink-0 p-3 border-t"
        style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
      >
        <div
          className="flex items-end gap-2 px-3 py-2 rounded-2xl border"
          style={{ background: 'var(--chat-bg)', borderColor: 'var(--line)' }}
        >
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('aiTypeMessage')}
            rows={1}
            className="flex-1 bg-transparent text-sm outline-none resize-none max-h-32"
            style={{ color: 'var(--ink)' }}
          />
          <button
            type="button"
            onClick={() => void handleSend(draft)}
            disabled={!draft.trim() || loading}
            className="p-1.5 rounded-xl flex-shrink-0 disabled:opacity-40 transition-all"
            style={{ background: 'var(--brand)', color: 'white' }}
            onMouseEnter={e => { if (!(e.currentTarget as HTMLButtonElement).disabled) e.currentTarget.style.filter = 'brightness(1.1)' }}
            onMouseLeave={e => (e.currentTarget.style.filter = '')}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
