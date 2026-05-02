import { useState, useEffect, useCallback } from 'react'
import { Sun, Moon, MessageCircle, ArrowLeft, X, Search, Phone, Video, Globe, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../hooks/useAuth'
import { useMessages } from '../../hooks/useMessages'
import { useMessageSearch } from '../../hooks/useMessageSearch'
import { useRoomStore } from '../../stores/roomStore'
import { getRoomDisplayName, getRoomAvatarInfo, leaveRoom, deleteRoom } from '../../services/roomService'
import { sendFileMessage } from '../../services/messageService'
import { validateFiles } from '../../lib/fileValidation'
import { getUserFriendlyMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { Avatar } from '../ui/Avatar'
import { MessageList } from '../chat/MessageList'
import { MessageInput } from '../chat/MessageInput'
import { MessageActionBar } from '../chat/MessageActionBar'
import { DragDropZone } from '../chat/DragDropZone'
import { PendingFilesPreview } from '../chat/PendingFilesPreview'
import { TranslationLanguageModal } from '../chat/TranslationLanguageModal'
import { RoomMenu } from '../chat/RoomMenu'
import { LeaveRoomModal } from '../chat/LeaveRoomModal'
import { DeleteRoomModal } from '../chat/DeleteRoomModal'
import { ReplyPreview } from '../chat/ReplyPreview'
import { MessageSearchBar } from '../chat/MessageSearchBar'
import { GlobalSearchPanel } from '../chat/GlobalSearchPanel'
import type { MessageWithSender, ReplyRef } from '../../types/chat'

interface Props {
  roomId:           string | null
  onBack?:          () => void
  onLeaveOrDelete?: (toast: string) => void
  onRoomSelect?:    (roomId: string) => void
}

export function ChatWindow({ roomId, onBack, onLeaveOrDelete, onRoomSelect }: Props) {
  const { t } = useTranslation()
  const { mode, toggle } = useTheme()
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
  const [pendingFiles,    setPendingFiles]    = useState<File[]>([])
  const [fileUploading,   setFileUploading]  = useState(false)

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

  // 방이 바뀌면 초기화
  useEffect(() => {
    setDraft('')
    setReplyTo(null)
    setTargetLanguage(null)
    setPendingFiles([])
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

  const LANG_KO: Record<string, string> = {
    ko: '한국어', en: '영어', ru: '러시아어', zh: '중국어', ja: '일본어', uz: '우즈벡어',
  }

  const peerLang = peer?.preferred_language
  const groupLangs = isGroup
    ? [...new Set(room!.members.map(m => LANG_KO[m.preferred_language] ?? m.preferred_language))].join(', ')
    : ''

  const headerSubtitle = isGroup
    ? `${memberCount}명 · ${groupLangs}`
    : peerLang
      ? `온라인 · ${LANG_KO[peerLang]} 사용`
      : t('onlineStatus')

  const langBtnLabel = isGroup
    ? '각자 모국어로'
    : (targetLanguage && targetLanguage !== 'none')
      ? `내 언어: ${LANG_KO[targetLanguage] ?? targetLanguage.toUpperCase()}`
      : '내 언어 설정'

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
    setReplyTo(null)
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
      await send(content, current?.id ?? null, ref)
    }
  }, [replyTo, send, pendingFiles, roomId])

  const scrollToMessage = useCallback((messageId: string) => {
    const el = document.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('highlight-pulse')
    setTimeout(() => el.classList.remove('highlight-pulse'), 1500)
  }, [])

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
      <header className="flex items-center justify-between px-4 py-2.5 flex-shrink-0 chat-header"
              style={{
                background: 'var(--card)',
                borderBottom: '1px solid var(--line)',
                boxShadow: 'var(--shadow-header)',
              }}>

        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-1.5 rounded-full flex-shrink-0 transition-colors
                         hover:bg-gray-100 dark:hover:bg-[#1E293B]
                         text-gray-500 dark:text-[#94A3B8]"
              aria-label={t('backBtn')}
            >
              <ArrowLeft size={20} />
            </button>
          )}

          {room && displayName && avatarInfo ? (
            <div className="flex items-center gap-3 min-w-0">
              {isGroup ? (
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold"
                     style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                  {(displayName ?? '그룹').slice(0, 2)}
                </div>
              ) : (
                <div className="relative flex-shrink-0">
                  <Avatar name={avatarInfo.name} avatarUrl={avatarInfo.avatarUrl} size="sm" />
                  <span
                    className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                    style={{ background: 'var(--green)', borderColor: 'var(--card)' }}
                  />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate leading-tight" style={{ color: 'var(--ink)' }}>
                  {displayName}
                </p>
                <p className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--ink-3)' }}>
                  {headerSubtitle}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <img src="/mtl-logo.png" alt="MTL" className="h-8 w-auto object-contain" />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  MTL Shipping Agency
                </p>
                <p className="text-xs" style={{ color: 'var(--ink-3)' }}>{t('companySubtitle')}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {/* 번역 언어 버튼 */}
          {room && (
            <button
              onClick={() => !isGroup && setTranslationOpen(true)}
              disabled={isGroup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium
                         transition-colors border"
              style={{
                borderColor: 'rgba(37,99,235,0.3)',
                color: 'var(--blue)',
                background: 'rgba(37,99,235,0.05)',
                cursor: isGroup ? 'default' : 'pointer',
              }}
              title={isGroup ? '' : t('translationSetting')}
            >
              <Globe size={13} />
              {langBtnLabel}
              {!isGroup && <ChevronDown size={11} />}
            </button>
          )}

          {/* 통화 버튼들 */}
          {room && (
            <>
              <button
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--ink-3)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                title="음성 통화"
              >
                <Phone size={17} />
              </button>
              <button
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--ink-3)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                title="영상 통화"
              >
                <Video size={17} />
              </button>
            </>
          )}

          {/* Light / Dark 토글 */}
          <div className="flex items-center rounded-full border overflow-hidden ml-1"
               style={{ borderColor: 'var(--line)' }}>
            <button
              onClick={() => mode === 'dark' && toggle()}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-colors"
              style={{
                color: mode === 'light' ? 'var(--card)' : 'var(--ink-3)',
                background: mode === 'light' ? 'var(--ink-2)' : 'transparent',
              }}
              title="라이트 모드"
            >
              <Sun size={12} />
              Light
            </button>
            <button
              onClick={() => mode === 'light' && toggle()}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-colors"
              style={{
                color: mode === 'dark' ? 'var(--card)' : 'var(--ink-3)',
                background: mode === 'dark' ? 'var(--ink-2)' : 'transparent',
              }}
              title="다크 모드"
            >
              <Moon size={12} />
              Dark
            </button>
          </div>

          {/* 검색 + 방 메뉴 */}
          {room && (
            <>
              <button
                onClick={() => { setSearchOpen(v => !v); setGlobalOpen(false) }}
                className="p-2 rounded-lg transition-colors"
                style={{ color: searchOpen ? 'var(--blue)' : 'var(--ink-3)' }}
                onMouseEnter={e => { if (!searchOpen) (e.currentTarget.style.background = 'var(--bg)') }}
                onMouseLeave={e => { if (!searchOpen) (e.currentTarget.style.background = 'transparent') }}
                title="메시지 검색"
              >
                <Search size={17} />
              </button>
              <RoomMenu
                isOwner={isOwner}
                isDirect={isDirect}
                onLeave={() => setLeaveOpen(true)}
                onDelete={() => setDeleteOpen(true)}
              />
            </>
          )}
        </div>
      </header>

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
                  background: 'var(--blue-soft)',
                  color: 'var(--ink-2)',
                  border: '1px solid rgba(37,99,235,0.12)',
                }}
              >
                ✦ <strong style={{ color: 'var(--blue)' }}>MTL Link</strong>이 자동으로 메시지를 번역하고 있어요.
                메시지를 클릭하면 원문을 볼 수 있습니다.
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
            onOpenTranslationModal={() => setTranslationOpen(true)}
          />

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
