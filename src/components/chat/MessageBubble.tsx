import { useState, useRef, useCallback } from 'react'
import { FollowupBadge } from './FollowupBadge'
import { MobileMessageSheet } from './MobileMessageSheet'
import { toggleNeedsResponse, markResponseReceived } from '../../services/followupService'
import { useRequestStore } from '../../stores/requestStore'
import { Mic, AlertCircle, Clock, ClipboardCheck, CheckCheck, ChevronDown, ScanText, MessageSquare } from 'lucide-react'
import { getLangName } from '../../lib/langFlags'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../ui/Avatar'
import { AttachmentPreview } from './AttachmentPreview'
import { LinkPreviewCard } from './LinkPreviewCard'
import { MessageMenu } from './MessageMenu'
import { MessageEditInput } from './MessageEditInput'
import { DeleteMessageModal } from './DeleteMessageModal'
import { CreateActionItemModal } from './CreateActionItemModal'
import { QuotedMessage } from './QuotedMessage'
import { ReadReceipt } from './ReadReceipt'
import { useReadStatus } from '../../hooks/useReadStatus'
import { linkifyText } from '../../lib/linkify'
import { formatMessageTime, formatFullDateTime } from '../../lib/date'
import { useAuth } from '../../hooks/useAuth'
import { useMessageTranslation } from '../../hooks/useMessageTranslation'
import { useMessageStore } from '../../stores/messageStore'
import { editMessage, softDeleteMessage } from '../../services/messageService'
import type { MessageWithSender, RoomListItem } from '../../types/chat'

interface Props {
  message:            MessageWithSender
  isOwn:              boolean
  showSenderInfo:     boolean
  prevMessage?:       MessageWithSender | null
  onReply?:           () => void
  onOpenThread?:      () => void
  onScrollToMessage?: (messageId: string) => void
  members:            RoomListItem['members']
  currentUserId:      string
  isGroup:            boolean
  searchQuery?:       string
  isCurrentResult?:   boolean
  targetLanguage?:    string
}

function highlightText(text: string, query: string): React.ReactNode {
  const q = query.trim()
  if (!q) return text
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(re)
  return parts.map((p, i) =>
    re.test(p)
      ? <mark key={i} className="bg-yellow-300 dark:bg-yellow-600/70 text-inherit rounded-sm px-px">{p}</mark>
      : p,
  )
}

function isWithin5Min(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() < 5 * 60 * 1000
}

export function MessageBubble({ message, isOwn, showSenderInfo, prevMessage, onReply, onOpenThread, onScrollToMessage, members, currentUserId, isGroup, searchQuery = '', isCurrentResult = false, targetLanguage }: Props) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { upsertMessage } = useMessageStore()

  const [hovered,       setHovered]       = useState(false)
  const [menuOpen,      setMenuOpen]      = useState(false)
  const [editing,       setEditing]       = useState(false)
  const [deleteOpen,    setDeleteOpen]    = useState(false)
  const [taskOpen,      setTaskOpen]      = useState(false)
  const [followupBusy,  setFollowupBusy]  = useState(false)
  const [sheetOpen,     setSheetOpen]     = useState(false)

  // V 트리거 ref — MessageMenu 클릭 외부 감지에서 제외
  const chevronRef = useRef<HTMLButtonElement>(null)

  // 롱프레스 감지 (모바일 touch 전용)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTouchStart = useCallback(() => {
    // sending/failed 메시지는 롱프레스 무시
    if (message._status === 'failed' || message._status === 'sending') return
    longPressTimer.current = setTimeout(() => {
      setSheetOpen(true)
      try { navigator.vibrate(10) } catch { /* 진동 미지원 무시 */ }
    }, 500)
  }, [message._status])

  const handleCancelLongPress = useCallback(() => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleCopy = useCallback(() => {
    if (message.content) {
      navigator.clipboard.writeText(message.content).catch(() => {})
    }
  }, [message.content])

  const hoursSince = message.needs_response
    ? Math.floor((Date.now() - new Date(message.created_at).getTime()) / 3_600_000)
    : 0

  const handleMarkFollowup = async () => {
    if (followupBusy) return
    setFollowupBusy(true)
    try {
      await toggleNeedsResponse(message.id, true)
      upsertMessage(message.room_id!, { ...message, needs_response: true })
      void useRequestStore.getState().loadCounts()
    } catch (e) { console.error(e) } finally { setFollowupBusy(false) }
  }

  const handleUnmarkRequest = async () => {
    if (followupBusy) return
    setFollowupBusy(true)
    try {
      await toggleNeedsResponse(message.id, false)
      upsertMessage(message.room_id!, { ...message, needs_response: false })
      void useRequestStore.getState().loadCounts()
    } catch (e) { console.error(e) } finally { setFollowupBusy(false) }
  }

  const handleMarkReceived = async () => {
    if (followupBusy) return
    setFollowupBusy(true)
    try {
      await markResponseReceived(message.id)
      upsertMessage(message.room_id!, { ...message, response_received: true })
      void useRequestStore.getState().loadCounts()
    } catch (e) { console.error(e) } finally { setFollowupBusy(false) }
  }

  // 번역 대상 언어 결정:
  // - 내 메시지: 내 언어(자기 메시지는 번역하지 않음)
  // - 상대 메시지: get_target_language 결과(targetLanguage)를 우선 사용
  //   → 'none' 이거나 미전달 시 프로필 언어 폴백
  const myLanguage = isOwn
    ? (profile?.preferred_language ?? 'ko')
    : (targetLanguage && targetLanguage !== 'none'
        ? targetLanguage
        : (profile?.preferred_language ?? 'ko'))

  const { translatedText, isTranslating, isTranslatable } =
    useMessageTranslation(message, myLanguage)

  const readStatus = useReadStatus(message, isGroup, members, currentUserId)

  if (message.deleted_at) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1 px-2 md:px-3`}>
        <span className="text-xs italic px-3 py-1.5" style={{ color: 'var(--ink-4)' }}>
          {t('msgDeleted')}
        </span>
      </div>
    )
  }

  const isRequestPending  = (message.needs_response ?? false) && !(message.response_received ?? false)
  const isRequestAnswered = (message.needs_response ?? false) && (message.response_received ?? false)

  const isVoice   = message.message_type === 'voice_translated'
  const isOcr     = message.message_type === 'text_translated' && !!message.content_original
  const isFailed  = message._status === 'failed'
  const isSending = message._status === 'sending'
  const isSent    = message._status === 'sent' || !message._status

  // 수정 권한
  const canEdit = isOwn && isSent && message.message_type === 'text' && isWithin5Min(message.created_at)

  // 2단 레이아웃 조건
  const voiceTwoPanel = (isVoice || isOcr) && !!message.content_original
  const textTwoPanel  = isTranslatable && !!translatedText
  const showTwoPanel  = voiceTwoPanel || textTwoPanel

  const isContinuation = !!prevMessage &&
    prevMessage.sender_id === message.sender_id &&
    !prevMessage.deleted_at &&
    (new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime()) < 5 * 60 * 1000

  // 수정 저장
  const handleSave = async (content: string) => {
    await editMessage(message.id, content)
    // Optimistic update: realtime이 처리하지만 즉시 반영
    upsertMessage(message.room_id!, {
      ...message,
      content,
      edited_at: new Date().toISOString(),
    })
    setEditing(false)
  }

  // 삭제
  const handleDelete = async () => {
    await softDeleteMessage(message.id)
    upsertMessage(message.room_id!, {
      ...message,
      deleted_at: new Date().toISOString(),
    })
  }

  return (
    <div
      className={`flex items-end gap-2 px-2 md:px-3 ${isContinuation ? 'mb-0.5' : 'mb-2'} ${isOwn ? 'flex-row-reverse' : 'flex-row'} message-bubble-row`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleCancelLongPress}
      onTouchEnd={handleCancelLongPress}
      onTouchCancel={handleCancelLongPress}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 아바타 (수신 메시지만) */}
      {!isOwn && (
        <div className="w-8 flex-shrink-0 self-end mb-0.5">
          {!isContinuation && message.sender && (
            <Avatar
              name={message.sender.name}
              avatarUrl={message.sender.avatar_url}
              size="sm"
            />
          )}
        </div>
      )}


      <div className={`flex flex-col max-w-[85%] md:max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>

        {/* 발신자 이름 (그룹방, 첫 메시지) */}
        {showSenderInfo && !isOwn && !isContinuation && message.sender && (
          <span className="text-[11px] font-semibold mb-1 ml-1" style={{ color: 'var(--brand)' }}>
            {message.sender.name}
          </span>
        )}

        {/* 말풍선 */}
        <div
          className={`
            relative pl-3 pr-7 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words message-bubble
            ${isFailed ? 'ring-2 ring-red-400 dark:ring-red-600' : isCurrentResult ? 'ring-2 ring-yellow-400 dark:ring-yellow-500' : ''}
            ${isSending ? 'opacity-60' : ''}
          `}
          style={{
            ...(isOwn ? {
              background: 'var(--bubble-out)',
              border: '1px solid var(--bubble-out-bd)',
              color: 'var(--ink)',
              boxShadow: 'var(--shadow-sm)',
            } : {
              background: 'var(--bubble-in)',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              boxShadow: 'var(--shadow-sm)',
            }),
            ...(isRequestPending  ? { borderLeft: '3px solid #EAB308' } : {}),
            ...(isRequestAnswered ? { borderLeft: '3px solid var(--brand)' } : {}),
          }}
        >

          {/* 요청 표시 (수신 메시지에만 노출 — 발신은 meta 행의 FollowupBadge로 표시) */}
          {!isOwn && isRequestPending && (
            <div className="flex items-center gap-1 mb-1.5" style={{ fontSize: '10px', color: '#CA8A04' }}>
              <ClipboardCheck size={10} style={{ flexShrink: 0 }} />
              <span>{t('followupWaiting')}</span>
            </div>
          )}
          {!isOwn && isRequestAnswered && (
            <div
              className="flex items-center gap-1 mb-1.5 px-1.5 py-0.5 rounded"
              style={{ fontSize: '10px', color: 'var(--brand)', background: 'var(--blue-soft)' }}
            >
              <CheckCheck size={10} style={{ flexShrink: 0 }} />
              <span>{t('followupReceived')}</span>
            </div>
          )}

          {/* 첨부파일 */}
          {message.attachments && message.attachments.length > 0 && (
            <AttachmentPreview attachments={message.attachments} />
          )}

          {/* 인용 메시지 */}
          {!editing && message.reply_to_id && message.reply_message?.id && (
            <QuotedMessage
              reply={message.reply_message}
              onClick={() => message.reply_to_id && onScrollToMessage?.(message.reply_to_id)}
            />
          )}

          {/* 인라인 수정 모드 */}
          {editing ? (
            <MessageEditInput
              initialValue={message.content ?? ''}
              onSave={handleSave}
              onCancel={() => setEditing(false)}
            />
          ) : isVoice ? (
            /* 음성 메시지 전용 레이아웃 — 뷰어 언어로 자동 번역된 텍스트 우선 사용 */
            <VoiceBubbleContent
              messageId={message.id}
              displayText={(isTranslatable && translatedText) ? translatedText : (message.content ?? null)}
              spokenText={message.content_original ?? null}
              sourceLanguage={message.source_language ?? null}
              myLanguage={myLanguage}
              isTranslating={isTranslating}
              isOwn={isOwn}
              searchQuery={searchQuery}
            />
          ) : showTwoPanel ? (
            <div className="space-y-1.5">
              <p className="text-[10px] italic leading-relaxed whitespace-pre-wrap break-words" style={{ color: 'var(--ink-4)', opacity: 0.55 }}>
                {isOcr
                  ? (searchQuery ? highlightText(message.content_original ?? '', searchQuery) : message.content_original)
                  : (searchQuery ? highlightText(message.content ?? '', searchQuery) : message.content)}
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {isOcr
                  ? (searchQuery ? highlightText(message.content ?? '', searchQuery) : message.content)
                  : translatedText}
              </p>
            </div>
          ) : (
            <>
              {message.content && (
                <span>
                  {searchQuery
                    ? highlightText(message.content, searchQuery)
                    : linkifyText(message.content).map((part, i) =>
                        typeof part === 'string'
                          ? <span key={i}>{part}</span>
                          : (
                            <a
                              key={i}
                              href={part.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline break-all" style={{ color: 'var(--brand)' }}
                            >
                              {part.href}
                            </a>
                          ),
                      )}
                </span>
              )}
              {isTranslating && (
                <span className="ml-1.5 inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--ink-4)' }}>
                  <span className="w-2.5 h-2.5 border border-current/30 border-t-current rounded-full animate-spin" />
                  {t('translating')}
                </span>
              )}
            </>
          )}

          {/* V chevron 트리거 — 데스크톱 호버 시만 표시 (모바일 hidden) */}
          {!editing && isSent && (
            <>
              <button
                ref={chevronRef}
                type="button"
                className="absolute top-1.5 right-1 hidden md:flex items-center justify-center w-5 h-5 rounded
                           transition-opacity duration-150"
                style={{
                  opacity: (hovered || menuOpen) ? 1 : 0,
                  color: 'var(--ink-3)',
                  pointerEvents: (hovered || menuOpen) ? 'auto' : 'none',
                }}
                onClick={() => setMenuOpen(v => !v)}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}
                aria-label="메시지 메뉴"
              >
                <ChevronDown size={14} />
              </button>

              <MessageMenu
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                excludeRef={chevronRef}
                isOwn={isOwn}
                canEdit={canEdit}
                needsResponse={message.needs_response ?? false}
                responseReceived={message.response_received ?? false}
                onReply={() => onReply?.()}
                onCopy={handleCopy}
                onCreateTask={() => setTaskOpen(true)}
                onOpenThread={!message.thread_root_id ? onOpenThread : undefined}
                onMarkFollowup={isOwn ? handleMarkFollowup : undefined}
                onUnmarkRequest={isOwn ? handleUnmarkRequest : undefined}
                onMarkReceived={isOwn ? handleMarkReceived : undefined}
                onEdit={isOwn ? () => setEditing(true) : undefined}
                onDelete={isOwn ? () => setDeleteOpen(true) : undefined}
              />
            </>
          )}
        </div>

        {/* 링크 미리보기 */}
        {!editing && !isFailed && !isSending && message.room_id && message.content && (() => {
          const parts = linkifyText(message.content)
          const firstLink = parts.find((p): p is { href: string } => typeof p !== 'string')
          if (!firstLink) return null
          return (
            <LinkPreviewCard
              messageId={message.id}
              roomId={message.room_id}
              url={firstLink.href}
              isOwn={isOwn}
            />
          )
        })()}

        {/* 스레드 답글 배지 — 채널 메시지(thread_root_id 없음)에만 표시 */}
        {!editing && !message.thread_root_id && (message.thread_reply_count ?? 0) > 0 && onOpenThread && (
          <button
            type="button"
            onClick={onOpenThread}
            className={`flex items-center gap-1 mt-1 mx-1 text-[11px] hover:underline ${isOwn ? 'self-end' : 'self-start'}`}
            style={{ color: 'var(--brand)' }}
          >
            <MessageSquare size={11} className="flex-shrink-0" />
            {t('threadReplies', { count: message.thread_reply_count })}
          </button>
        )}

        {/* 메타 정보 */}
        {!editing && (
          <div className={`flex items-center flex-wrap gap-x-1.5 gap-y-0.5 mt-1 mx-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>

            {isFailed && (
              <span className="text-[10px] text-red-500 flex items-center gap-0.5">
                <AlertCircle size={11} />전송 실패
              </span>
            )}
            {isSending && (
              <Clock size={11} className="text-gray-300 dark:text-[#556e78]" />
            )}

            {/* 읽음 표시 (본인 메시지, 전송 완료 후) */}
            {isOwn && isSent && (
              <ReadReceipt status={readStatus} isGroup={isGroup} />
            )}

            {/* 음성 번역 배지 */}
            {isVoice && !isFailed && !isSending && message.source_language && (
              <span className="text-[11px] flex items-center gap-0.5 leading-none" style={{ color: 'var(--ink-4)' }}>
                <Mic size={9} className="flex-shrink-0" />
                {getLangName(message.source_language)}
                {message.target_language && <>{' → '}{getLangName(message.target_language)}</>}
              </span>
            )}

            {/* OCR 번역 배지 */}
            {isOcr && !isFailed && !isSending && message.source_language && (
              <span className="text-[11px] flex items-center gap-0.5 leading-none" style={{ color: 'var(--ink-4)' }}>
                <ScanText size={9} className="flex-shrink-0" />
                {getLangName(message.source_language)}
                {message.target_language && <>{' → '}{getLangName(message.target_language)}</>}
              </span>
            )}

            {/* 자동 텍스트 번역 배지 */}
            {isTranslatable && !isTranslating && translatedText && !isFailed && !isSending && message.source_language && (
              <span className="text-[11px] leading-none" style={{ color: 'var(--ink-4)' }}>
                {getLangName(message.source_language)}{' → '}{getLangName(myLanguage)}
              </span>
            )}

            {/* 후속 추적 배지 (본인 메시지) */}
            {isOwn && isSent && (
              <FollowupBadge
                needsResponse={message.needs_response ?? false}
                responseReceived={message.response_received ?? false}
                hoursSince={hoursSince}
              />
            )}

            {/* 수정됨 배지 */}
            {message.edited_at && !isFailed && !isSending && (
              <span className="text-[10px] italic" style={{ color: 'var(--ink-4)' }}>
                {t('msgEdited')}
              </span>
            )}

            <time
              title={formatFullDateTime(message.created_at)}
              className="text-[10px]" style={{ color: 'var(--ink-4)' }}
            >
              {formatMessageTime(message.created_at)}
            </time>
          </div>
        )}
      </div>


      {/* 삭제 확인 모달 */}
      {deleteOpen && (
        <DeleteMessageModal
          onConfirm={handleDelete}
          onClose={() => setDeleteOpen(false)}
        />
      )}

      {/* 할 일 만들기 모달 */}
      {taskOpen && message.room_id && (
        <CreateActionItemModal
          open={taskOpen}
          onClose={() => setTaskOpen(false)}
          messageId={message.id}
          roomId={message.room_id}
          initialTitle={message.content ?? ''}
          members={members}
          currentUserId={currentUserId}
        />
      )}

      {/* 모바일 롱프레스 액션 시트 */}
      <MobileMessageSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        isOwn={isOwn}
        canEdit={canEdit}
        needsResponse={message.needs_response ?? false}
        responseReceived={message.response_received ?? false}
        onReply={() => onReply?.()}
        onCopy={handleCopy}
        onCreateTask={() => setTaskOpen(true)}
        onOpenThread={!message.thread_root_id ? onOpenThread : undefined}
        onMarkFollowup={isOwn ? handleMarkFollowup : undefined}
        onUnmarkRequest={isOwn ? handleUnmarkRequest : undefined}
        onMarkReceived={isOwn ? handleMarkReceived : undefined}
        onEdit={isOwn ? () => setEditing(true) : undefined}
        onDelete={isOwn ? () => setDeleteOpen(true) : undefined}
      />
    </div>
  )
}

/* ── 음성 메시지 버블 컨텐츠 ─────────────────────────── */
function VoiceBubbleContent({
  displayText,
  spokenText,
  isTranslating,
  searchQuery,
}: {
  messageId:      string
  displayText:    string | null
  spokenText:     string | null
  sourceLanguage: string | null
  myLanguage:     string
  isTranslating:  boolean
  isOwn:          boolean
  searchQuery:    string
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1.5 min-w-[160px]">
      {/* 헤더: 마이크 아이콘 + 레이블 */}
      <div className="flex items-center gap-1.5">
        <Mic size={12} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
        <span className="text-[11px] italic" style={{ color: 'var(--ink-3)' }}>{t('voiceLabel')}</span>
      </div>
      <div style={{ height: '1px', background: 'var(--line)' }} />

      {/* 번역된 텍스트 */}
      {isTranslating ? (
        <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--ink-4)' }}>
          <span className="w-2.5 h-2.5 border border-current/30 border-t-current rounded-full animate-spin" />
          번역 중…
        </span>
      ) : displayText ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {searchQuery ? highlightText(displayText, searchQuery) : displayText}
        </p>
      ) : null}

      {/* 발화 원문 (번역된 텍스트와 다를 때만) */}
      {spokenText && displayText && spokenText !== displayText && (
        <p className="text-xs italic leading-relaxed whitespace-pre-wrap break-words" style={{ color: 'var(--ink-4)' }}>
          {searchQuery ? highlightText(spokenText, searchQuery) : spokenText}
        </p>
      )}

    </div>
  )
}
