import { useCallback } from 'react'
import { Mic, Square } from 'lucide-react'
import { useMicrophonePermission } from '../../hooks/useMicrophonePermission'
import { useMediaRecorder } from '../../hooks/useMediaRecorder'
import { sendVoiceTranslatedMessage } from '../../services/voiceMessageService'
import { getUserFriendlyMessage } from '../../lib/errors'

interface Props {
  roomId:         string
  targetLanguage: string | null
  disabled?:      boolean
  onError:        (msg: string) => void
}

function fmtTime(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function VoiceRecorderButton({ roomId, targetLanguage, disabled, onError }: Props) {
  const { state: micState, request: requestMic } = useMicrophonePermission()

  const handleBlob = useCallback(async (blob: Blob) => {
    if (!targetLanguage) return
    try {
      await sendVoiceTranslatedMessage({ roomId, audioBlob: blob, targetLanguage })
    } catch (err) {
      onError(getUserFriendlyMessage(err))
    }
  }, [roomId, targetLanguage, onError])

  const { recState, elapsedMs, start, stop } = useMediaRecorder(handleBlob)

  const isRecording   = recState === 'recording'
  const isProcessing  = recState === 'processing'
  const canUse        = !!targetLanguage && !disabled

  const handleClick = async () => {
    if (isProcessing) return

    if (isRecording) {
      stop()
      return
    }

    if (!canUse) {
      onError('번역 언어를 먼저 설정해 주세요')
      return
    }

    if (micState === 'denied') {
      onError('마이크 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.')
      return
    }

    if (micState !== 'granted') {
      const ok = await requestMic()
      if (!ok) { onError('마이크 권한이 필요합니다.'); return }
    }

    const ok = await start()
    if (!ok) onError('녹음을 시작할 수 없습니다.')
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={isProcessing || disabled}
        aria-label={isRecording ? '녹음 중지 및 전송' : '음성 번역 녹음 시작'}
        title={
          isRecording   ? '클릭하면 전송됩니다 (최대 60초)'
          : isProcessing ? '전송 중…'
          : !canUse      ? '번역 언어를 먼저 설정해 주세요'
          : '음성 번역 (클릭하여 녹음)'
        }
        className={`
          p-2 rounded-lg transition-colors duration-100
          ${isRecording
            ? 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 animate-pulse'
            : isProcessing
              ? 'text-gray-400 dark:text-[#8696a0]'
              : canUse
                ? 'text-gray-400 dark:text-[#8696a0] hover:text-gray-600 dark:hover:text-[#e9edef] hover:bg-gray-100 dark:hover:bg-surface-hover'
                : 'text-gray-300 dark:text-[#556e78]'
          }
          disabled:cursor-not-allowed
        `}
      >
        {isProcessing
          ? <span className="w-[19px] h-[19px] border-2 border-current/30 border-t-current rounded-full animate-spin block" />
          : isRecording
            ? <Square size={19} className="fill-current" />
            : <Mic size={19} />
        }
      </button>

      {/* 경과 시간 */}
      {isRecording && (
        <span className="text-xs font-mono text-red-500 dark:text-red-400 tabular-nums select-none min-w-[36px]">
          {fmtTime(elapsedMs)}
        </span>
      )}
    </div>
  )
}
