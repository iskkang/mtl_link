import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface Props {
  onConfirm: () => Promise<void>
  onClose:   () => void
}

export function DeleteRoomModal({ onConfirm, onClose }: Props) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setLoading(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && !loading) onClose() }}
    >
      <div
        className="rounded-2xl shadow-2xl w-[90vw] max-w-sm mx-4 p-6"
        style={{ background: 'var(--card)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-red-500 dark:text-red-400" />
          </div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
            {t('deleteRoomTitle')}
          </h3>
        </div>
        <p className="text-sm leading-relaxed mb-5 ml-12" style={{ color: 'var(--ink-3)' }}>
          {t('deleteRoomDesc')}
        </p>

        {error && <p className="text-xs text-red-500 mb-4">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            style={{ color: 'var(--ink-3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {t('deleteRoomCancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {t('deleteRoomConfirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
