import { Check, CheckCheck } from 'lucide-react'
import type { ReadStatus } from '../../hooks/useReadStatus'

interface Props {
  status:  ReadStatus
  isGroup: boolean
}

export function ReadReceipt({ status, isGroup }: Props) {
  console.log('[READ-9] ReadReceipt 렌더', { status, isGroup })
  if (!isGroup) {
    return status.type === 'read'
      ? <CheckCheck size={14} className="text-blue-500 dark:text-blue-400 flex-shrink-0" />
      : <Check      size={14} className="text-gray-400 dark:text-[#8696a0] flex-shrink-0" />
  }

  if (!status.readCount) return null
  return (
    <span className="text-[10px] text-gray-400 dark:text-[#8696a0] flex-shrink-0">
      {status.readCount}
    </span>
  )
}
