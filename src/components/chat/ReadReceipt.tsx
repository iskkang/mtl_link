import { Check, CheckCheck } from 'lucide-react'
import type { ReadStatus } from '../../hooks/useReadStatus'

interface Props {
  status:  ReadStatus
  isGroup: boolean
}

export function ReadReceipt({ status, isGroup }: Props) {
  if (!isGroup) {
    return status.type === 'read'
      ? <CheckCheck size={14} className="flex-shrink-0" style={{ color: 'var(--blue)' }} />
      : <Check      size={14} className="flex-shrink-0" style={{ color: 'var(--ink-4)' }} />
  }

  if (!status.readCount) return null
  return (
    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--ink-4)' }}>
      {status.readCount}
    </span>
  )
}
