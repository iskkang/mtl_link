import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, Loader2, MoreHorizontal, Pencil, Trash2, BookmarkPlus, X, ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useIsMobile } from '../../hooks/useIsMobile'
import { supabase } from '../../lib/supabase'
import { aiEvents } from '../../lib/aiEvents'
import { AiQuickActions } from './AiQuickActions'
import { AiQuickBar } from './AiQuickBar'
import { MintExamplePrompts } from './MintExamplePrompts'
import MintIntroCard from './MintIntroCard'
import { isMintIntroQuery, isMintIntroResponse } from '../../utils/mintIntro'

// ── MINT 로고 컴포넌트 ──────────────────────────────────────────────────────
const MintLogo = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <polygon points="100,30 60,100 100,100" fill="#5eead4"/>
    <polygon points="100,30 140,100 100,100" fill="#14b8a6"/>
    <polygon points="60,100 100,170 100,100" fill="#0d9488"/>
    <polygon points="140,100 100,170 100,100" fill="#134e4a"/>
    <line x1="100" y1="30" x2="100" y2="170" stroke="#ffffff" strokeWidth="3" strokeLinecap="round"/>
  </svg>
)

interface MintEmailSource {
  index:      number
  date:       string | null
  from:       string
  subject:    string
  similarity: number
}

interface AiMessage {
  id:      string
  role:    'user' | 'assistant'
  content: string
  sources?: MintEmailSource[]
}

interface Props {
  sessionId:      string | null
  onNewSession:   (id: string) => void
  onNavigate?:    (view: 'quotation' | 'message' | 'transport' | 'customs' | 'hscode' | 'tracking') => void
  onDelete?:      () => void
  onTitleChange?: () => void
}

export function AiChatWindow({ sessionId, onNewSession, onNavigate, onDelete, onTitleChange }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { user } = useAuth()

  const [messages,      setMessages]      = useState<AiMessage[]>([])
  const [sessionTitle,  setSessionTitle]  = useState('')
  const [draft,         setDraft]         = useState('')
  const [loading,       setLoading]       = useState(false)
  const [fetching,      setFetching]      = useState(false)
  const [menuOpen,      setMenuOpen]      = useState(false)
  const [editing,       setEditing]       = useState(false)
  const [editValue,     setEditValue]     = useState('')
  const [saveFormId,    setSaveFormId]    = useState<string | null>(null)
  const [saveTitle,     setSaveTitle]     = useState('')
  const [saveCategory,  setSaveCategory]  = useState('general')
  const [savingKb,      setSavingKb]      = useState(false)
  const [kbToast,       setKbToast]       = useState(false)
  const [idleFocused,   setIdleFocused]   = useState(false)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const menuRef    = useRef<HTMLDivElement>(null)
  const idleTextareaRef   = useRef<HTMLTextAreaElement>(null)
  const activeTextareaRef = useRef<HTMLTextAreaElement>(null)
  const justCreatedSessionRef = useRef<string | null>(null)

  // Reflect title renames from sidebar
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

  // Load messages when sessionId changes
  useEffect(() => {
    if (!sessionId || !user) { setMessages([]); setSessionTitle(''); return }

    // 방금 로컬에서 새로 만든 세션이면 DB fetch 스킵
    // (사용자 메시지는 이미 로컬 state에 있고, 응답은 곧 도착할 예정)
    if (justCreatedSessionRef.current === sessionId) {
      justCreatedSessionRef.current = null
      return
    }

    setFetching(true)
    void supabase
      .from('ai_conversations')
      .select('id, question, answer, session_title, created_at')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        const rows  = data ?? []
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

  // Scroll to bottom on new messages / loading
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async (text: string) => {
    const content = text.trim()
    if (!content || loading || !user) return

    const sid = sessionId ?? crypto.randomUUID()
    if (!sessionId) {
      justCreatedSessionRef.current = sid
      onNewSession(sid)
    }

    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content }])
    setDraft('')

    // 자기소개 질문이면 AI 호출 없이 즉시 카드로 응답
    if (isMintIntroQuery(content)) {
      setMessages(prev => [...prev, {
        id:      crypto.randomUUID(),
        role:    'assistant',
        content: 'Maritime Intelligent Navigation Tool',
      }])
      if (!sessionTitle) {
        setSessionTitle(content.slice(0, 30))
        onTitleChange?.()
      }
      return
    }

    setLoading(true)

    try {
      // Supabase access token for /api/mint/ask auth
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token ?? ''

      const resp = await fetch('/api/mint/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: content }),
      })
      const data = await resp.json() as { answer?: string; sources?: MintEmailSource[]; error?: string }
      if (!resp.ok || data.error) throw new Error(data.error ?? '일시적 오류가 발생했습니다. 다시 시도해주세요.')

      const answer  = data.answer  ?? ''
      const sources = data.sources ?? []

      setMessages(prev => [...prev, {
        id:      crypto.randomUUID(),
        role:    'assistant',
        content: answer,
        sources,
      }])

      // 세션 대화 기록 저장 (기존 ai_conversations 호환)
      void supabase.from('ai_conversations').insert({
        session_id:    sid,
        user_id:       user.id,
        question:      content,
        answer,
        session_title: !sessionTitle ? content.slice(0, 30) : sessionTitle,
      })

      if (!sessionTitle) {
        setSessionTitle(content.slice(0, 30))
        onTitleChange?.()
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id:      crypto.randomUUID(),
        role:    'assistant',
        content: err instanceof Error ? err.message : '일시적 오류가 발생했습니다. 다시 시도해주세요.',
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleSaveToKnowledge = async (content: string) => {
    if (!saveTitle.trim() || !user) return
    setSavingKb(true)
    await supabase.from('knowledge_base').insert({
      title:      saveTitle.trim(),
      category:   saveCategory as 'hs' | 'customs' | 'message' | 'quotation' | 'tracking' | 'claim' | 'general',
      content,
      status:     'draft' as const,
      created_by: user.id,
    })
    setSavingKb(false)
    setSaveFormId(null)
    setSaveTitle('')
    setSaveCategory('general')
    setKbToast(true)
    setTimeout(() => setKbToast(false), 3000)
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

  // ── 공유 입력창 렌더러 ───────────────────────────────────────────────────
  const renderInput = (variant: 'centered' | 'bottom') => {
    const isCentered = variant === 'centered'
    return (
      <div
        style={{
          display: 'flex', alignItems: 'flex-end', gap: 10,
          border: `1.5px solid ${isCentered ? (idleFocused ? '#14b8a6' : '#ccfbf1') : 'var(--line)'}`,
          borderRadius: isCentered ? 16 : 14,
          padding: isCentered ? '14px 16px' : '10px 14px',
          background: 'var(--card)',
          boxShadow: isCentered
            ? (idleFocused
                ? '0 4px 24px rgba(20,184,166,.22)'
                : '0 4px 24px rgba(20,184,166,.10)')
            : '0 -4px 16px rgba(0,0,0,.04)',
          transition: 'border-color .2s, box-shadow .2s',
        }}
      >
        <textarea
          ref={isCentered ? idleTextareaRef : activeTextareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => isCentered && setIdleFocused(true)}
          onBlur={() => isCentered && setIdleFocused(false)}
          placeholder={t('aiTypeMessage')}
          rows={1}
          style={{
            flex: 1, background: 'transparent', outline: 'none',
            resize: 'none', maxHeight: 128,
            color: 'var(--ink)', fontSize: 14, lineHeight: 1.6,
            fontFamily: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={() => void handleSend(draft)}
          disabled={!draft.trim() || loading}
          style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: '#14b8a6', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', cursor: 'pointer',
            opacity: draft.trim() && !loading ? 1 : 0.4,
            transition: 'opacity .15s, filter .15s',
          }}
          onMouseEnter={e => { if (!(e.currentTarget as HTMLButtonElement).disabled) e.currentTarget.style.filter = 'brightness(1.1)' }}
          onMouseLeave={e => (e.currentTarget.style.filter = '')}
        >
          <Send size={15} />
        </button>
      </div>
    )
  }

  // ── 타이핑 인디케이터 ─────────────────────────────────────────────────────
  const TypingIndicator = () => (
    <div className="flex justify-start">
      <div
        className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mr-2 text-sm"
        style={{ background: 'var(--blue-soft)', color: 'var(--brand)' }}
      >
        <MintLogo size={16} />
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
  )

  // ── 메시지 목록 ───────────────────────────────────────────────────────────
  const MessageList = () => (
    <div className="flex flex-col gap-7 p-4 max-w-3xl mx-auto w-full">
      {messages.map(msg => (
        <div
          key={msg.id}
          className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
        >
          {/* 사용자 메시지: 버블 */}
          {msg.role === 'user' && (
            <div
              className="max-w-[75%] px-4 py-2.5 leading-relaxed whitespace-pre-wrap rounded-[18px] rounded-tr-[4px]"
              style={{ background: '#14b8a6', color: 'white', fontSize: 15 }}
            >
              {msg.content}
            </div>
          )}

          {/* AI 응답: ChatGPT/Claude 스타일 — 버블 없음, 전체 너비 */}
          {msg.role === 'assistant' && (
            isMintIntroResponse(msg.content) ? (
              <MintIntroCard />
            ) : (
              <div className="w-full">
                {/* MINT 라벨 */}
                <div className="flex items-center gap-1.5 mb-2.5">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--blue-soft)' }}
                  >
                    <MintLogo size={14} />
                  </div>
                  <span className="text-xs font-semibold" style={{ color: '#14b8a6' }}>MINT</span>
                </div>
                {/* 응답 본문 — 버블 없음 */}
                <div
                  className="ai-markdown pl-1"
                  style={{ color: 'var(--ink)', fontSize: 15, lineHeight: 1.75 }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>

                {/* 참고한 메일 (email RAG sources) */}
                {msg.sources && msg.sources.length > 0 && (
                  <div
                    className="mt-3 pl-1 pt-2.5 border-t"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    <p
                      className="text-[11px] font-semibold mb-1.5"
                      style={{ color: 'var(--ink-4)' }}
                    >
                      참고한 메일
                    </p>
                    <div className="flex flex-col gap-1">
                      {msg.sources.map(s => (
                        <div
                          key={s.index}
                          className="text-[11px] leading-relaxed"
                          style={{ color: 'var(--ink-4)' }}
                        >
                          <span className="font-semibold" style={{ color: '#14b8a6' }}>
                            [메일 {s.index}]
                          </span>
                          {' '}{s.date ?? '날짜미상'} · {s.from} · {s.subject}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {/* 지식베이스 저장 버튼 — AI 메시지 전용 (자기소개 카드 제외) */}
          {msg.role === 'assistant' && !isMintIntroResponse(msg.content) && (
            <div className="mt-2 pl-1">
              {saveFormId === msg.id ? (
                <div
                  className="rounded-xl border p-3 flex flex-col gap-2 max-w-xs"
                  style={{ background: 'var(--card)', borderColor: 'var(--brand)' }}
                >
                  <input
                    autoFocus
                    value={saveTitle}
                    onChange={e => setSaveTitle(e.target.value)}
                    placeholder="제목 입력…"
                    className="px-2 py-1.5 rounded-lg text-xs outline-none border"
                    style={{ background: 'var(--chat-bg)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                  />
                  <select
                    value={saveCategory}
                    onChange={e => setSaveCategory(e.target.value)}
                    className="px-2 py-1.5 rounded-lg text-xs outline-none border"
                    style={{ background: 'var(--chat-bg)', borderColor: 'var(--line)', color: 'var(--ink)' }}
                  >
                    {(['general', 'hs', 'customs', 'message', 'quotation', 'tracking', 'claim'] as const).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveToKnowledge(msg.content)}
                      disabled={!saveTitle.trim() || savingKb}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                      style={{ background: 'var(--brand)' }}
                    >
                      {savingKb ? <Loader2 size={11} className="animate-spin mx-auto" /> : '저장'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSaveFormId(null); setSaveTitle('') }}
                      className="p-1.5 rounded-lg"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setSaveFormId(msg.id); setSaveTitle('') }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors"
                  style={{ color: 'var(--ink-4)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--brand)'; e.currentTarget.style.background = 'var(--blue-soft)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-4)'; e.currentTarget.style.background = 'transparent' }}
                >
                  <BookmarkPlus size={11} />
                  {t('knowledgeSave')}
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {loading && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--chat-bg)' }}>

      {/* CSS 애니메이션 */}
      <style>{`
        @keyframes mintFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mint-fade-in  { animation: mintFadeIn .4s ease; }
        .mint-fade-in-fast { animation: mintFadeIn .3s ease; }

        .mint-idle-card {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 16px;
          cursor: pointer;
          text-align: left;
          transition: border-color .2s, box-shadow .2s, transform .15s;
        }
        .mint-idle-card:hover {
          border-color: #14b8a6;
          box-shadow: 0 4px 16px rgba(20,184,166,.12);
          transform: translateY(-1px);
        }
        .mint-idle-card:active { transform: translateY(0); }

        /* .ai-markdown styles → src/index.css (글로벌) */
      `}</style>

      {/* ── 로딩 중 ───────────────────────────────────────────────────────── */}
      {fetching && (
        <div className="flex items-center justify-center flex-1">
          <Loader2 size={20} className="animate-spin" style={{ color: '#14b8a6' }} />
        </div>
      )}

      {/* ── IDLE 상태 ─────────────────────────────────────────────────────── */}
      {!fetching && !hasMessages && (
        <div
          className="mint-fade-in flex flex-col items-center justify-center flex-1 overflow-y-auto"
          style={{ padding: '40px 20px' }}
        >
          {/* 로고 + 인사 */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10, marginBottom: 12,
            }}>
              <MintLogo size={40} />
              <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-.5px' }}>
                MINT+
              </span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: 0 }}>
              {t('aiWelcomeSubtitle')}
            </p>
          </div>

          {/* 중앙 입력창 */}
          <div style={{ width: '100%', maxWidth: 600, marginBottom: 24 }}>
            {renderInput('centered')}
          </div>

          {/* 예시 질문 카드 */}
          <div style={{ marginBottom: 28 }}>
            <MintExamplePrompts onSelect={text => void handleSend(text)} />
          </div>

          {/* 도구 카드 */}
          <AiQuickActions
            onSelect={text => void handleSend(text)}
            onNavigate={onNavigate}
            showHeader={true}
          />
        </div>
      )}

      {/* ── ACTIVE 상태 ───────────────────────────────────────────────────── */}
      {!fetching && hasMessages && (
        <div className="mint-fade-in-fast flex flex-col h-full">

          {/* 작은 헤더 */}
          <div
            style={{
              height: 52, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 16px',
              borderBottom: '1px solid var(--line)',
              background: 'var(--card)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              {isMobile && (
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  style={{ color: 'var(--ink-3)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 4px 4px 0', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  aria-label="뒤로"
                >
                  <ChevronLeft size={22} />
                </button>
              )}
              <MintLogo size={24} />
              {editing ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => void handleSaveTitle()}
                  onKeyDown={e => { if (e.key === 'Enter') void handleSaveTitle() }}
                  style={{
                    flex: 1, fontSize: 15, fontWeight: 600, outline: 'none',
                    background: 'transparent', color: 'var(--ink)',
                    borderBottom: '1.5px solid #14b8a6', marginRight: 8,
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 15, fontWeight: 600, color: 'var(--ink)',
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {sessionTitle || 'MINT'}
                </span>
              )}
            </div>

            {sessionId && (
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
            )}
          </div>

          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto">
            <MessageList />
          </div>

          {/* 빠른 액션 바 */}
          <AiQuickBar
            onSelect={text => void handleSend(text)}
            onNavigate={onNavigate}
          />

          {/* 지식베이스 저장 완료 토스트 */}
          {kbToast && (
            <div
              className="mx-3 mb-2 flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-medium text-center"
              style={{ background: '#22C55E20', color: '#22C55E' }}
            >
              {t('knowledgeSaved')}
            </div>
          )}

          {/* 하단 고정 입력창 */}
          <div
            style={{
              flexShrink: 0,
              padding: '12px 16px',
              borderTop: '1px solid var(--line)',
              background: 'var(--card)',
            }}
          >
            {renderInput('bottom')}
          </div>
        </div>
      )}
    </div>
  )
}
