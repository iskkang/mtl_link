import { useState } from 'react'
import { Mic, Globe, AlertCircle, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../ui/Avatar'
import { AttachmentPreview } from './AttachmentPreview'
import { LinkPreviewCard } from './LinkPreviewCard'
import { linkifyText } from '../../lib/linkify'
import { formatMessageTime, formatFullDateTime } from '../../lib/date'
import { useAuth } from '../../hooks/useAuth'
import { useMessageTranslation } from '../../hooks/useMessageTranslation'
import type { MessageWithSender } from '../../types/chat'

interface Props {
  message:        MessageWithSender
  isOwn:          boolean
  showSenderInfo: boolean   // 그룹방에서만 true
  prevMessage?:   MessageWithSender | null
}

export function MessageBubble({ message, isOwn, showSenderInfo, prevMessage }: Props) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [showOriginal, setShowOriginal] = useState(false)

  const myLanguage = profile?.preferred_language ?? 'ko'

  const { translatedText, isTranslating, isTranslatable } =
    useMessageTranslation(message, myLanguage, isOwn)

  if (message.deleted_at) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1 px-3`}>
        <span className="text-xs italic text-gray-400 dark:text-[#8696a0] px-3 py-1.5">
          삭제된 메시지입니다
        </span>
      </div>
    )
  }

  const isVoice   = message.message_type === 'voice_translated'
  const isFailed  = message._status === 'failed'
  const isSending = message._status === 'sending'

  // Display text logic:
  // - voice: showOriginal = show original speech, !showOriginal = show translation
  // - text auto: showOriginal = show original, !showOriginal = show translation (fallback to original)
  let display: string | null
  if (isVoice) {
    display = showOriginal && message.content_original
      ? message.content_original
      : message.content
  } else if (isTranslatable && translatedText) {
    display = showOriginal ? message.content : translatedText
  } else {
    display = message.content
  }

  // 같은 발신자의 연속 메시지: 아바타/이름 숨김
  const isContinuation = !!prevMessage &&
    prevMessage.sender_id === message.sender_id &&
    !prevMessage.deleted_at &&
    (new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime()) < 5 * 60 * 1000

  return (
    <div className={`flex items-end gap-2 px-3 ${isContinuation ? 'mb-0.5' : 'mb-2'} ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>

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

          {/* 메시지 본문 */}
          {display && (
            <span>
              {linkifyText(display).map((part, i) =>
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

          {/* 번역 중 인디케이터 (버블 안) */}
          {isTranslating && (
            <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] text-gray-400 dark:text-[#8696a0]">
              <span className="w-2.5 h-2.5 border border-current/30 border-t-current rounded-full animate-spin" />
              {t('translating')}
            </span>
          )}

          {/* 음성번역: 원문/번역 구분선 */}
          {isVoice && showOriginal && message.content_original && (
            <div className="mt-2 pt-2 border-t border-black/10 dark:border-white/10 text-xs opacity-80">
              <div className="text-[10px] font-semibold mb-0.5 opacity-60 uppercase tracking-wider">
                {t('msgShowTranslated')}
              </div>
              <div>{message.content}</div>
            </div>
          )}
        </div>

        {/* 링크 미리보기 */}
        {!isFailed && !isSending && message.room_id && display && (() => {
          const parts = linkifyText(display)
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

        {/* 메타 정보 (시간, 상태, 배지) */}
        <div className={`flex items-center gap-1.5 mt-0.5 mx-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>

          {isFailed && (
            <span className="text-[10px] text-red-500 flex items-center gap-0.5">
              <AlertCircle size={11} />전송 실패
            </span>
          )}

          {isSending && (
            <Clock size={11} className="text-gray-300 dark:text-[#556e78]" />
          )}

          {/* 음성 번역 배지 */}
          {isVoice && !isFailed && !isSending && (
            <>
              <button
                onClick={() => setShowOriginal(v => !v)}
                className="text-[10px] px-1.5 py-0.5 rounded-full
                           border border-gray-300 dark:border-[#556e78]
                           text-gray-500 dark:text-[#8696a0]
                           hover:text-gray-700 dark:hover:text-[#e9edef]
                           transition-colors"
              >
                {showOriginal ? t('msgShowTranslated') : t('msgShowOriginal')}
              </button>
              <span className="text-[10px] text-gray-400 dark:text-[#8696a0] flex items-center gap-0.5">
                <Mic size={9} />
                {message.source_language?.toUpperCase()}
                {message.target_language && (
                  <><Globe size={9} className="ml-0.5" />{message.target_language.toUpperCase()}</>
                )}
              </span>
            </>
          )}

          {/* 자동 텍스트 번역 배지 */}
          {isTranslatable && !isTranslating && translatedText && !isFailed && !isSending && (
            <>
              <button
                onClick={() => setShowOriginal(v => !v)}
                className="text-[10px] px-1.5 py-0.5 rounded-full
                           border border-gray-300 dark:border-[#556e78]
                           text-gray-500 dark:text-[#8696a0]
                           hover:text-gray-700 dark:hover:text-[#e9edef]
                           transition-colors"
              >
                {showOriginal ? t('msgShowTranslated') : t('msgShowOriginal')}
              </button>
              <span className="text-[10px] text-gray-400 dark:text-[#8696a0] flex items-center gap-0.5">
                <Globe size={9} />
                {message.source_language?.toUpperCase()} → {myLanguage.toUpperCase()}
              </span>
            </>
          )}

          <time
            title={formatFullDateTime(message.created_at)}
            className="text-[10px] text-gray-400 dark:text-[#8696a0]"
          >
            {formatMessageTime(message.created_at)}
          </time>
        </div>
      </div>
    </div>
  )
}
