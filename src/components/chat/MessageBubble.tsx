import { useState } from 'react'
import { Mic, Globe, AlertCircle, Clock, CornerDownLeft, ScanText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../ui/Avatar'
import { AttachmentPreview } from './AttachmentPreview'
import { LinkPreviewCard } from './LinkPreviewCard'
import { MessageMenu } from './MessageMenu'
import { MessageEditInput } from './MessageEditInput'
import { DeleteMessageModal } from './DeleteMessageModal'
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
  onScrollToMessage?: (messageId: string) => void
  members:            RoomListItem['members']
  currentUserId:      string
  isGroup:            boolean
}

function isWithin5Min(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() < 5 * 60 * 1000
}

export function MessageBubble({ message, isOwn, showSenderInfo, prevMessage, onReply, onScrollToMessage, members, currentUserId, isGroup }: Props) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { upsertMessage } = useMessageStore()

  const [hovered,     setHovered]     = useState(false)
  const [editing,     setEditing]     = useState(false)
  const [deleteOpen,  setDeleteOpen]  = useState(false)

  const myLanguage = profile?.preferred_language ?? 'ko'

  const { translatedText, isTranslating, isTranslatable } =
    useMessageTranslation(message, myLanguage)

  const readStatus = useReadStatus(message, isGroup, members, currentUserId)

  if (message.deleted_at) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1 px-3`}>
        <span className="text-xs italic text-gray-400 dark:text-[#8696a0] px-3 py-1.5">
          {t('msgDeleted')}
        </span>
      </div>
    )
  }

  const isVoice   = message.message_type === 'voice_translated'
  const isOcr     = message.message_type === 'text_translated' && !!message.content_original
  const isFailed  = message._status === 'failed'
  const isSending = message._status === 'sending'
  const isSent    = message._status === 'sent' || !message._status

  // 수정/삭제 권한
  const canDelete = isOwn && isSent && message.message_type !== 'system'
  const canEdit   = isOwn && isSent && message.message_type === 'text' && isWithin5Min(message.created_at)

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
      className={`flex items-end gap-2 px-3 ${isContinuation ? 'mb-0.5' : 'mb-2'} ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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

      {/* 액션 버튼 (호버 시) - own: 버블 왼쪽 */}
      {isOwn && (hovered || deleteOpen || editing) && !editing && (
        <div className="self-end mb-1 flex-shrink-0 flex items-center gap-1.5">
          <button
            onClick={onReply}
            title={t('msgReply')}
            className="p-2 rounded-full bg-gray-700 dark:bg-gray-600
                       shadow-md hover:bg-gray-600 dark:hover:bg-gray-500
                       transition-colors"
          >
            <CornerDownLeft size={16} className="text-gray-100" />
          </button>
          <MessageMenu
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={() => setEditing(true)}
            onDelete={() => setDeleteOpen(true)}
          />
        </div>
      )}

      <div className={`flex flex-col max-w-[72%] md:max-w-[60%] ${isOwn ? 'items-end' : 'items-start'}`}>

        {/* 발신자 이름 (그룹방, 첫 메시지) */}
        {showSenderInfo && !isOwn && !isContinuation && message.sender && (
          <span className="text-[11px] font-semibold mb-1 ml-1 text-mtl-cyan dark:text-mtl-cyan">
            {message.sender.name}
          </span>
        )}

        {/* 말풍선 */}
        <div className={`
          relative px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words
          ${isOwn
            ? 'bg-[#d9fdd3] dark:bg-bubble-own text-gray-800 dark:text-[#e9edef] rounded-br-sm'
            : 'bg-white dark:bg-bubble-other text-gray-800 dark:text-[#e9edef] rounded-bl-sm shadow-sm dark:shadow-none border border-gray-100 dark:border-0'
          }
          ${isFailed ? 'ring-2 ring-red-400 dark:ring-red-600' : ''}
          ${isSending ? 'opacity-60' : ''}
        `}>

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
          ) : showTwoPanel ? (
            <div className="space-y-2">
              <p className="text-xs italic text-gray-400 dark:text-white/50 leading-relaxed whitespace-pre-wrap break-words">
                {(isVoice || isOcr) ? message.content_original : message.content}
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {(isVoice || isOcr) ? message.content : translatedText}
              </p>
            </div>
          ) : (
            <>
              {message.content && (
                <span>
                  {linkifyText(message.content).map((part, i) =>
                    typeof part === 'string'
                      ? <span key={i}>{part}</span>
                      : (
                        <a
                          key={i}
                          href={part.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline text-blue-600 dark:text-blue-400 break-all"
                        >
                          {part.href}
                        </a>
                      ),
                  )}
                </span>
              )}
              {isTranslating && (
                <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] text-gray-400 dark:text-[#8696a0]">
                  <span className="w-2.5 h-2.5 border border-current/30 border-t-current rounded-full animate-spin" />
                  {t('translating')}
                </span>
              )}
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

        {/* 메타 정보 */}
        {!editing && (
          <div className={`flex items-center gap-1.5 mt-0.5 mx-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>

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
            {isVoice && !isFailed && !isSending && (
              <span className="text-[10px] text-gray-400 dark:text-[#8696a0] flex items-center gap-0.5">
                <Mic size={9} />
                {message.source_language?.toUpperCase()}
                {message.target_language && (
                  <><Globe size={9} className="ml-0.5" />{message.target_language.toUpperCase()}</>
                )}
              </span>
            )}

            {/* OCR 번역 배지 */}
            {isOcr && !isFailed && !isSending && (
              <span className="text-[10px] text-gray-400 dark:text-[#8696a0] flex items-center gap-0.5">
                <ScanText size={9} />
                {message.source_language?.toUpperCase()}
                {message.target_language && (
                  <><Globe size={9} className="ml-0.5" />{message.target_language.toUpperCase()}</>
                )}
              </span>
            )}

            {/* 자동 텍스트 번역 배지 */}
            {isTranslatable && !isTranslating && translatedText && !isFailed && !isSending && (
              <span className="text-[10px] text-gray-400 dark:text-[#8696a0] flex items-center gap-0.5">
                <Globe size={9} />
                {message.source_language?.toUpperCase()} → {myLanguage.toUpperCase()}
              </span>
            )}

            {/* 수정됨 배지 */}
            {message.edited_at && !isFailed && !isSending && (
              <span className="text-[10px] text-gray-400 dark:text-[#8696a0] italic">
                {t('msgEdited')}
              </span>
            )}

            <time
              title={formatFullDateTime(message.created_at)}
              className="text-[10px] text-gray-400 dark:text-[#8696a0]"
            >
              {formatMessageTime(message.created_at)}
            </time>
          </div>
        )}
      </div>

      {/* 수신 메시지 답장 버튼 (버블 오른쪽) */}
      {!isOwn && hovered && (
        <div className="self-end mb-1 flex-shrink-0">
          <button
            onClick={onReply}
            title={t('msgReply')}
            className="p-2 rounded-full bg-gray-700 dark:bg-gray-600
                       shadow-md hover:bg-gray-600 dark:hover:bg-gray-500
                       transition-colors"
          >
            <CornerDownLeft size={16} className="text-gray-100" />
          </button>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteOpen && (
        <DeleteMessageModal
          onConfirm={handleDelete}
          onClose={() => setDeleteOpen(false)}
        />
      )}
    </div>
  )
}
