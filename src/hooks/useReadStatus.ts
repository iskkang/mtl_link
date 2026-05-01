import { useMemo } from 'react'
import type { MessageWithSender, RoomListItem } from '../types/chat'

export interface ReadStatus {
  type:       'unread' | 'read'
  readCount?: number
}

export function useReadStatus(
  message:  MessageWithSender,
  isGroup:  boolean,
  members:  RoomListItem['members'],
  myUserId: string,
): ReadStatus {
  return useMemo(() => {
    if (message.sender_id !== myUserId) return { type: 'unread' }
    if (message.deleted_at)             return { type: 'unread' }
    if (message._status === 'sending')  return { type: 'unread' }

    const others = members.filter(m => m.id !== myUserId)

    if (!isGroup) {
      const peer = others[0]
      if (!peer?.last_read_at) return { type: 'unread' }
      // ISO string 직접 비교 가능 (lexicographic === chronological)
      const isRead = peer.last_read_at > message.created_at
      return { type: isRead ? 'read' : 'unread' }
    }

    const readCount = others.filter(
      m => !!m.last_read_at && m.last_read_at > message.created_at,
    ).length
    return { type: readCount > 0 ? 'read' : 'unread', readCount }
  }, [message, isGroup, members, myUserId])
}
