import { useState, useEffect, useCallback, useRef } from 'react'
import { MessageCircle, X, ClipboardCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../hooks/useAuth'
import { useMessages } from '../../hooks/useMessages'
import { useMessageSearch } from '../../hooks/useMessageSearch'
import { useRoomStore } from '../../stores/roomStore'
import { getRoomDisplayName, getRoomAvatarInfo, leaveRoom, deleteRoom } from '../../services/roomService'
import { sendFileMessage } from '../../services/messageService'
import { getLangName } from '../../lib/langFlags'
import { validateFiles } from '../../lib/fileValidation'
import { getUserFriendlyMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { MessageList } from '../chat/MessageList'
import { MessageInput } from '../chat/MessageInput'
import { MessageActionBar } from '../chat/MessageActionBar'
import { DragDropZone } from '../chat/DragDropZone'
import { PendingFilesPreview } from '../chat/PendingFilesPreview'
import { TranslationLanguageModal } from '../chat/TranslationLanguageModal'
import { ChatHeader } from '../chat/ChatHeader'
import { LeaveRoomModal } from '../chat/LeaveRoomModal'
import { DeleteRoomModal } from '../chat/DeleteRoomModal'
import { ReplyPreview } from '../chat/ReplyPreview'
import { MessageSearchBar } from '../chat/MessageSearchBar'
import { GlobalSearchPanel } from '../chat/GlobalSearchPanel'
import type { MessageWithSender, ReplyRef } from '../../types/chat'

interface Props {
  roomId:              string | null
  onBack?:             () => void
  onLeaveOrDelete?:    (toast: string) => void
  onRoomSelect?:       (roomId: string) => void
  highlightMessageId?: string | null
  notifEnabled:        boolean
  onToggleNotif:       () => void
}

export function ChatWindow({ roomId, onBack, onLeaveOrDelete, onRoomSelect, highlightMessageId, notifEnabled, onToggleNotif }: Props) {
  const { t } = useTranslation()
  const { mode } = useTheme()
  const { user } = useAuth()
  const room = useRoomStore(s => s.rooms.find(r => r.id === roomId) ?? null)
  const { removeRoom } = useRoomStore()
  const { messages, loading, hasMore, send, loadMore } = useMessages(roomId)

  const [draft,           setDraft]           = useState('')
  const [fileError,       setFileError]       = useState<string | null>(null)
  const [targetLanguage,  setTargetLanguage]  = useState<string | null>(null)
  const [translationOpen, setTranslationOpen] = useState(false)
  const [leaveOpen,       setLeaveOpen]       = useState(false)
  const [deleteOpen,      setDeleteOpen]      = useState(false)
  const [replyTo,         setReplyTo]         = useState<MessageWithSender | null>(null)
  const [freshPeerLang,   setFreshPeerLang]   = useState<string | null>(null)
  const [pendingFiles,    setPendingFiles]    = useState<File[]>([])
  const [fileUploading,   setFileUploading]  = useState(false)
  const [isRequest,       setIsRequest]       = useState(false)

  // 검색 상태
  const [searchOpen,   setSearchOpen]   = useState(false)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [globalOpen,   setGlobalOpen]   = useState(false)
  const {
    currentIdx: searchIdx,
    total: searchTotal,
    current: searchCurrent,
    goNext: searchGoNext,
    goPrev: searchGoPrev,
    canGoNext: searchCanGoNext,
    canGoPrev: searchCanGoPrev,
    forceSearch: searchForce,
  } = useMessageSearch(messages, searchOpen ? searchQuery : '')

  // 검색 결과 변경 시 자동 스크롤 — searchIdx 변경(이동)도 포함
  useEffect(() => {
    if (!searchCurrent) return
    const el = document.querySelector<HTMLElement>(`[data-message-id="${searchCurrent.id}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'center' })
  }, [searchCurrent, searchIdx])

  // 방이 바뀌면 초기화 (processedHighlightRef는 scrollToMessage 선언 후 정의)
  useEffect(() => {
    setDraft('')
    setReplyTo(null)
    setTargetLanguage(null)
    setPendingFiles([])
    setIsRequest(false)
    setSearchOpen(false)
    setSearchQuery('')
    setGlobalOpen(false)
    if (!roomId) return

    Promise.resolve(
      supabase.rpc('get_target_language', { p_room_id: roomId }),
    )
      .then(({ data }) => setTargetLanguage(data ?? 'none'))
      .catch(() => setTargetLanguage('none'))
  }, [roomId])

  const currentUserId = user?.id ?? ''
  const displayName   = room ? getRoomDisplayName(room, currentUserId) : null
  const avatarInfo    = room ? getRoomAvatarInfo(room, currentUserId) : null
  const isGroup       = room?.room_type === 'group'
  const isDirect      = !!room && room.room_type === 'direct'
  const memberCount   = room?.members.length ?? 0
  const isOwner       = !!room && room.created_by === currentUserId

  const peer = room && !isGroup
    ? room.members.find(m => m.id !== currentUserId) ?? null
    : null

  // DM 피어 프로필을 fresh하게 가져와서 최신 언어 표시
  useEffect(() => {
    if (!peer?.id) { setFreshPeerLang(null); return }
    void supabase
      .from('profiles')
      .select('preferred_language')
      .eq('id', peer.id)
      .single()
      .then(({ data }) => { if (data?.preferred_language) setFreshPeerLang(data.preferred_language) })
  }, [peer?.id])

  const effectivePeerLang = freshPeerLang ?? peer?.preferred_language

  const groupLangNames = isGroup
    ? [...new Set(room!.members.map(m => getLangName(m.preferred_language ?? 'ko')))].join(', ')
    : ''

  const headerSubtitle = isGroup
    ? `${t('memberCount', { count: memberCount })} · ${groupLangNames}`
    : effectivePeerLang
      ? getLangName(effectivePeerLang)
      : ''

  // 파일 선택/드롭 → 검증 후 pendingFiles에 추가
  const handleFilesSelected = useCallback((newFiles: File[]) => {
    const combined = [...pendingFiles, ...newFiles]
    if (combined.length > 5) {
      setFileError('한 번에 최대 5개까지 첨부할 수 있습니다')
      return
    }
    const v = validateFiles(newFiles)
    if (!v.ok) { setFileError(v.error ?? '파일 검증 실패'); return }
    setPendingFiles(combined)
  }, [pendingFiles])

  const handleRemoveFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  // 전송: 파일이 있으면 sendFileMessage, 없으면 텍스트 전송
  const handleSend = useCallback(async (content: string) => {
    if (!roomId) return
    const current = replyTo
    const reqFlag = isRequest
    setReplyTo(null)
    setIsRequest(false)
    const ref: ReplyRef | null = current
      ? { id: current.id, content: current.content, message_type: current.message_type, deleted_at: current.deleted_at, sender: current.sender }
      : null

    if (pendingFiles.length > 0) {
      const files = [...pendingFiles]
      setPendingFiles([])
      setFileUploading(true)
      try {
        await sendFileMessage(roomId, files, content.trim() || undefined, current?.id ?? null, ref)
      } catch (err) {
        setFileError(getUserFriendlyMessage(err))
      } finally {
        setFileUploading(false)
      }
    } else {
      await send(content, current?.id ?? null, ref, reqFlag)
    }
  }, [replyTo, isRequest, send, pendingFiles, roomId])

  const scrollToMessage = useCallback((messageId: string) => {
    const el = document.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('highlight-pulse')
    setTimeout(() => el.classList.remove('highlight-pulse'), 1500)
  }, [])

  // highlightMessageId 변경 시 처리 완료 ref 초기화
  const processedHighlightRef = useRef<string | null>(null)
  useEffect(() => {
    processedHighlightRef.current = null
  }, [highlightMessageId])

  // 메시지 로드 후 해당 메시지로 스크롤 + 자동 답장 설정
  useEffect(() => {
    if (!highlightMessageId || loading || messages.length === 0) return
    if (processedHighlightRef.current === highlightMessageId) return

    const msg = messages.find(m => m.id === highlightMessageId)
    if (!msg) return

    processedHighlightRef.current = highlightMessageId
    setReplyTo(msg)
    setTimeout(() => scrollToMessage(highlightMessageId), 150)
  }, [highlightMessageId, messages, loading, scrollToMessage])

  const handleLeave = async () => {
    if (!roomId) return
    await leaveRoom(roomId)
    removeRoom(roomId)
    onLeaveOrDelete?.(isDirect ? t('directLeaveToast') : t('leaveRoomToast'))
  }

  const handleDelete = async () => {
    if (!roomId) return
    await deleteRoom(roomId)
    removeRoom(roomId)
    onLeaveOrDelete?.(t('deleteRoomToast'))
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── 채팅창 헤더 ──────────────────────────────── */}
      <ChatHeader
        hasRoom={!!room}
        displayName={displayName}
        avatarInfo={avatarInfo}
        isGroup={isGroup}
        isDirect={isDirect}
        isOwner={isOwner}
        headerSubtitle={headerSubtitle}
        onBack={onBack}
        effectivePeerLang={effectivePeerLang ?? null}
        onOpenTranslation={() => setTranslationOpen(true)}
        searchOpen={searchOpen}
        onToggleSearch={() => { setSearchOpen(v => !v); setGlobalOpen(false) }}
        notifEnabled={notifEnabled}
        onToggleNotif={onToggleNotif}
        onLeave={() => setLeaveOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />

      {/* ── 검색 바 ──────────────────────────────────── */}
      {searchOpen && room && (
        <MessageSearchBar
          query={searchQuery}
          onChange={q => { setSearchQuery(q) }}
          onClose={() => { setSearchOpen(false); setSearchQuery(''); setGlobalOpen(false) }}
          total={searchTotal}
          currentIdx={searchIdx}
          onNext={searchGoNext}
          onPrev={searchGoPrev}
          canNext={searchCanGoNext}
          canPrev={searchCanGoPrev}
          onGlobal={() => setGlobalOpen(v => !v)}
          onEnter={() => searchForce(searchQuery)}
          placeholder="메시지 검색"
          labelGlobal="통합검색"
        />
      )}

      {/* ── 메시지 영역 ──────────────────────────────── */}
      {roomId && room ? (
        <DragDropZone
          onError={setFileError}
          onFilesSelected={handleFilesSelected}
          disabled={fileUploading}
        >
          {/* 파일/에러 토스트 */}
          {fileError && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40
                            flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg
                            bg-red-500 text-white text-xs font-medium max-w-xs text-center">
              {fileError}
              <button onClick={() => setFileError(null)} className="flex-shrink-0 hover:opacity-75">
                <X size={13} />
              </button>
            </div>
          )}

          <div className="flex-1 flex flex-col overflow-hidden relative">
            {/* 번역 안내 배너 */}
            {targetLanguage && targetLanguage !== 'none' && (
              <div
                className="mx-4 mt-3 mb-1 px-4 py-2.5 rounded-xl text-[12px] text-center leading-relaxed flex-shrink-0"
                style={{
                  background: mode === 'dark' ? 'rgba(51,144,236,0.10)' : 'var(--blue-soft)',
                  color:      mode === 'dark' ? '#3F9FFF' : 'var(--ink-2)',
                  border: '1px solid rgba(51,144,236,0.15)',
                }}
              >
                {t('autoTranslateBanner')}
              </div>
            )}
            <MessageList
              messages={messages}
              loading={loading}
              hasMore={hasMore}
              currentUserId={currentUserId}
              isGroupRoom={isGroup}
              members={room.members}
              onLoadMore={loadMore}
              onReply={setReplyTo}
              onScrollToMessage={scrollToMessage}
              searchQuery={searchOpen ? searchQuery : ''}
              currentResultId={searchCurrent?.id ?? null}
              targetLanguage={targetLanguage ?? undefined}
            />
            {globalOpen && (
              <GlobalSearchPanel
                query={searchQuery}
                onClose={() => setGlobalOpen(false)}
                onRoomSelect={(rid, msgId) => {
                  setGlobalOpen(false)
                  setSearchOpen(false)
                  setSearchQuery('')
                  if (rid !== roomId) {
                    onRoomSelect?.(rid)
                  } else {
                    scrollToMessage(msgId)
                  }
                }}
              />
            )}
          </div>

          <MessageActionBar
            roomId={roomId}
            onEmojiSelect={emoji => setDraft(prev => prev + emoji)}
            onError={setFileError}
            onFilesSelected={handleFilesSelected}
            uploading={fileUploading}
            targetLanguage={targetLanguage}
            peerLanguage={effectivePeerLang ?? null}
            onOpenTranslationModal={() => setTranslationOpen(true)}
            isRequest={isRequest}
            onToggleRequest={() => setIsRequest(v => !v)}
          />

          {/* 요청 활성 배너 */}
          {isRequest && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0 border-t text-xs"
              style={{
                background: 'rgba(234,179,8,0.08)',
                borderColor: 'rgba(234,179,8,0.3)',
                color: '#CA8A04',
              }}
            >
              <ClipboardCheck size={13} className="flex-shrink-0" />
              <span>{t('inputRequestActive')}</span>
              <button
                onClick={() => setIsRequest(false)}
                className="ml-auto flex-shrink-0"
                style={{ color: 'var(--ink-4)' }}
                aria-label="요청 취소"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* 전송 전 파일 미리보기 */}
          {pendingFiles.length > 0 && (
            <PendingFilesPreview files={pendingFiles} onRemove={handleRemoveFile} />
          )}

          {replyTo && (
            <ReplyPreview
              replyTo={replyTo}
              onCancel={() => setReplyTo(null)}
            />
          )}

          <MessageInput
            value={draft}
            onChange={setDraft}
            onSend={handleSend}
            hasPendingFiles={pendingFiles.length > 0}
            targetLanguage={targetLanguage}
            roomName={displayName ?? undefined}
          />
        </DragDropZone>
      ) : (
        // NOTE: This empty state is no longer reached in normal flow.
        // Dashboard renders at ChatPage level when selectedRoomId is null.
        // Kept as defensive fallback in case roomId is unexpectedly null.
        <EmptyState t={t} />
      )}

      {/* ── 번역 언어 설정 모달 ─────────────────────── */}
      {translationOpen && room && (
        <TranslationLanguageModal
          toUserId={peer?.id ?? null}
          toUserName={peer?.name ?? displayName ?? ''}
          currentLanguage={targetLanguage ?? 'none'}
          onSaved={lang => setTargetLanguage(lang)}
          onClose={() => setTranslationOpen(false)}
        />
      )}

      {leaveOpen && (
        <LeaveRoomModal
          isDirect={isDirect}
          onConfirm={handleLeave}
          onClose={() => setLeaveOpen(false)}
        />
      )}

      {deleteOpen && (
        <DeleteRoomModal
          onConfirm={handleDelete}
          onClose={() => setDeleteOpen(false)}
        />
      )}
    </div>
  )
}

/* ── 방 미선택 빈 상태 ──────────────────────────── */
function EmptyState({ t }: { t: (k: string) => string }) {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-8 select-none"
      style={{ background: 'var(--chat-bg)' }}
    >
      <div className="flex flex-col items-center text-center">
        <div
          className="mb-6 rounded-2xl p-5"
          style={{ background: 'var(--card)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--line)' }}
        >
          <img src="/mtl-logo.png" alt="MTL Shipping Agency" className="h-20 w-auto object-contain" />
        </div>
        <h2 className="text-2xl font-bold tracking-wide mb-2" style={{ color: 'var(--ink)' }}>
          MTL LINK
        </h2>
        <p className="text-sm mb-1" style={{ color: 'var(--ink-3)' }}>
          MTL Shipping Agency {t('companySubtitle')}
        </p>
        <p className="text-xs mt-2 leading-relaxed whitespace-pre-line" style={{ color: 'var(--ink-4)' }}>
          {t('welcomeDesc')}
        </p>
        <div className="mt-8 flex items-center gap-3" style={{ color: 'var(--line)' }}>
          <span className="h-px w-16 bg-current" />
          <MessageCircle size={14} style={{ color: 'var(--ink-4)' }} />
          <span className="h-px w-16 bg-current" />
        </div>
        <p className="mt-4 text-[11px]" style={{ color: 'var(--ink-4)' }}>
          {t('encryptedNotice')}
        </p>
      </div>
    </div>
  )
}
