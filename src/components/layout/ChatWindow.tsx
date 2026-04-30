import { useState, useEffect } from 'react'
import { Sun, Moon, MessageCircle, ArrowLeft, Users, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../hooks/useAuth'
import { useMessages } from '../../hooks/useMessages'
import { useRoomStore } from '../../stores/roomStore'
import { getRoomDisplayName, getRoomAvatarInfo, leaveRoom, deleteRoom } from '../../services/roomService'
import { supabase } from '../../lib/supabase'
import { Avatar } from '../ui/Avatar'
import { MessageList } from '../chat/MessageList'
import { MessageInput } from '../chat/MessageInput'
import { MessageActionBar } from '../chat/MessageActionBar'
import { DragDropZone } from '../chat/DragDropZone'
import { TranslationLanguageModal } from '../chat/TranslationLanguageModal'
import { RoomMenu } from '../chat/RoomMenu'
import { LeaveRoomModal } from '../chat/LeaveRoomModal'
import { DeleteRoomModal } from '../chat/DeleteRoomModal'

interface Props {
  roomId:          string | null
  onBack?:         () => void
  onLeaveOrDelete?: (toast: string) => void
}

export function ChatWindow({ roomId, onBack, onLeaveOrDelete }: Props) {
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

  // 방이 바뀌면 draft 초기화 + 번역 언어 재조회
  useEffect(() => {
    setDraft('')
    setTargetLanguage(null)
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
  const memberCount   = room?.members.length ?? 0
  const isOwner       = !!room && room.created_by === currentUserId

  // 1:1 방에서 상대방 정보 (번역 모달용)
  const peer = room && !isGroup
    ? room.members.find(m => m.id !== currentUserId) ?? null
    : null

  const handleLeave = async () => {
    if (!roomId) return
    await leaveRoom(roomId)
    removeRoom(roomId)
    onLeaveOrDelete?.(t('leaveRoomToast'))
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
          {/* 모바일 뒤로가기 */}
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
            /* 방 선택됨 */
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
            /* 방 미선택 */
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
          {/* 테마 토글 */}
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

          {/* 방 메뉴 (방 선택 시만) */}
          {room && (
            <RoomMenu
              isOwner={isOwner}
              onLeave={() => setLeaveOpen(true)}
              onDelete={() => setDeleteOpen(true)}
            />
          )}
        </div>
      </header>

      {/* ── 메시지 영역 ──────────────────────────────── */}
      {roomId && room ? (
        <DragDropZone roomId={roomId} onError={setFileError}>
          {/* 에러 토스트 */}
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

          <MessageList
            messages={messages}
            loading={loading}
            hasMore={hasMore}
            currentUserId={currentUserId}
            isGroupRoom={isGroup}
            onLoadMore={loadMore}
          />
          <MessageActionBar
            roomId={roomId}
            onEmojiSelect={emoji => setDraft(prev => prev + emoji)}
            onError={setFileError}
            targetLanguage={targetLanguage}
            onOpenTranslationModal={() => setTranslationOpen(true)}
          />
          <MessageInput
            value={draft}
            onChange={setDraft}
            onSend={send}
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

      {/* ── 방 나가기 모달 ───────────────────────────── */}
      {leaveOpen && (
        <LeaveRoomModal
          onConfirm={handleLeave}
          onClose={() => setLeaveOpen(false)}
        />
      )}

      {/* ── 방 삭제 모달 ────────────────────────────── */}
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
