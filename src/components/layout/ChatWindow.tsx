import { useState, useEffect, useCallback } from 'react'
import { Sun, Moon, MessageCircle, ArrowLeft, Users, X, Search } from 'lucide-react'
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
      <header className="flex items-center justify-between px-4 py-3 flex-shrink-0
                          bg-white dark:bg-surface-panel
                          border-b border-gray-200 dark:border-[#374045]
                          shadow-sm dark:shadow-none">

        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-1.5 rounded-full flex-shrink-0
                         hover:bg-gray-100 dark:hover:bg-surface-hover
                         text-gray-500 dark:text-[#aebac1] transition-colors"
              aria-label={t('backBtn')}
            >
              <ArrowLeft size={20} />
            </button>
          )}

          {room && displayName && avatarInfo ? (
            <div className="flex items-center gap-3 min-w-0">
              {isGroup ? (
                <div className="w-9 h-9 rounded-full bg-mtl-slate dark:bg-surface-hover
                                flex items-center justify-center flex-shrink-0">
                  <Users size={17} className="text-gray-400 dark:text-[#8696a0]" />
                </div>
              ) : (
                <Avatar name={avatarInfo.name} avatarUrl={avatarInfo.avatarUrl} size="sm" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate text-gray-900 dark:text-[#e9edef]">
                  {displayName}
                </p>
                <p className="text-xs text-gray-400 dark:text-[#8696a0]">
                  {isGroup ? t('memberCount', { count: memberCount }) : t('onlineStatus')}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="bg-white rounded-lg p-1 shadow-sm border border-gray-100
                              dark:border-0 dark:bg-transparent dark:p-0">
                <img src="/mtl-logo.png" alt="MTL" className="h-8 w-auto object-contain" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-[#e9edef]">
                  MTL Shipping Agency
                </p>
                <p className="text-xs text-gray-400 dark:text-[#8696a0]">{t('companySubtitle')}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {room && (
            <button
              onClick={() => { setSearchOpen(v => !v); setGlobalOpen(false) }}
              className={`p-2 rounded-full transition-colors
                         hover:bg-gray-100 dark:hover:bg-surface-hover
                         ${searchOpen ? 'text-mtl-cyan' : 'text-gray-500 dark:text-[#aebac1]'}`}
              title="메시지 검색"
            >
              <Search size={19} />
            </button>
          )}
          <button
            onClick={toggle}
            className="p-2 rounded-full
                       hover:bg-gray-100 dark:hover:bg-surface-hover
                       text-gray-500 dark:text-[#aebac1]
                       transition-colors"
            aria-label="테마 전환"
            title={t('themeToggle')}
          >
            {mode === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>

          {room && (
            <RoomMenu
              isOwner={isOwner}
              isDirect={isDirect}
              onLeave={() => setLeaveOpen(true)}
              onDelete={() => setDeleteOpen(true)}
            />
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
    <div className="flex-1 flex flex-col items-center justify-center px-8 select-none
                    bg-[#efeae2] dark:bg-surface-chat"
         style={{
           backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
         }}
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-6 bg-white rounded-2xl p-5 shadow-lg dark:shadow-2xl
                        border border-gray-100 dark:border-[#2a3942]">
          <img src="/mtl-logo.png" alt="MTL Shipping Agency" className="h-20 w-auto object-contain" />
        </div>
        <h2 className="font-display text-2xl font-bold tracking-wide mb-2
                       text-gray-600 dark:text-[#e9edef]">
          MTL LINK
        </h2>
        <p className="text-sm text-gray-400 dark:text-[#8696a0] mb-1">
          MTL Shipping Agency {t('companySubtitle')}
        </p>
        <p className="text-xs text-gray-300 dark:text-[#556e78] mt-2 leading-relaxed whitespace-pre-line">
          {t('welcomeDesc')}
        </p>
        <div className="mt-8 flex items-center gap-3 text-gray-200 dark:text-[#2a3942]">
          <span className="h-px w-16 bg-current" />
          <MessageCircle size={14} className="text-gray-300 dark:text-[#374045]" />
          <span className="h-px w-16 bg-current" />
        </div>
        <p className="mt-4 text-[11px] text-gray-300 dark:text-[#374045]">
          {t('encryptedNotice')}
        </p>
      </div>
    </div>
  )
}
