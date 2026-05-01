import { useRef, useState } from 'react'
import { ScanText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { sendOcrTranslation } from '../../services/ocrService'
import { getUserFriendlyMessage } from '../../lib/errors'

interface Props {
  roomId:         string
  targetLanguage: string | null
  disabled?:      boolean
  onError:        (msg: string) => void
}

export function OcrButton({ roomId, targetLanguage, disabled, onError }: Props) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const lang = (!targetLanguage || targetLanguage === 'none') ? 'ko' : targetLanguage

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileInputRef.current) fileInputRef.current.value = ''

    setLoading(true)
    try {
      await sendOcrTranslation({ roomId, imageFile: file, targetLanguage: lang })
    } catch (err) {
      onError(getUserFriendlyMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => fileInputRef.current?.click()}
        aria-label={t('ocrBtn')}
        title={t('ocrBtn')}
        className={`
          p-2 rounded-lg transition-colors duration-100
          text-gray-400 dark:text-[#8696a0]
          hover:text-gray-600 dark:hover:text-[#e9edef]
          hover:bg-gray-100 dark:hover:bg-surface-hover
          disabled:opacity-35 disabled:cursor-not-allowed
        `}
      >
        {loading
          ? <span className="w-[19px] h-[19px] border-2 border-current/30 border-t-current rounded-full animate-spin block" />
          : <ScanText size={19} />
        }
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={handleFileSelect}
        capture="environment"
      />
    </>
  )
}
