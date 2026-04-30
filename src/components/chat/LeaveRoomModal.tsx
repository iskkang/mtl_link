import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

interface Props {
  onConfirm: () => Promise<void>
  onClose:   () => void
}

export function LeaveRoomModal({ onConfirm, onClose }: Props) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setLoading(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
                 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && !loading) onClose() }}
    >
      <div className="bg-white dark:bg-surface-panel rounded-2xl shadow-2xl
                      w-[90vw] max-w-sm mx-4 p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-[#e9edef] mb-3">
          {t('leaveRoomTitle')}
        </h3>
        <p className="text-sm text-gray-500 dark:text-[#8696a0] leading-relaxed mb-5">
          {t('leaveRoomDesc')}
        </p>

        {error && (
          <p className="text-xs text-red-500 mb-4">{error}</p>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium
                       text-gray-600 dark:text-[#8696a0]
                       hover:bg-gray-100 dark:hover:bg-surface-hover
                       disabled:opacity-50 transition-colors"
          >
            {t('leaveRoomCancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                       bg-mtl-navy dark:bg-accent text-white
                       hover:bg-mtl-navy/90 dark:hover:bg-accent-hover
                       disabled:opacity-50 transition-colors"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {t('leaveRoomConfirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
