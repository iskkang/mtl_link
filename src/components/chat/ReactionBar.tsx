import { useState } from 'react'
import { useMessageStore } from '../../stores/messageStore'
import { toggleReaction } from '../../services/reactionService'

interface Props {
  messageId:     string
  roomId:        string
  reactions:     { emoji: string; user_id: string }[]
  currentUserId: string
  senderNames:   Record<string, string>  // user_id → display name
}

interface Chip {
  emoji:    string
  count:    number
  active:   boolean
  userIds:  string[]
}

export function ReactionBar({ messageId, roomId, reactions, currentUserId, senderNames }: Props) {
  const [pending, setPending] = useState<string | null>(null)
  const setReactions = useMessageStore(s => s.setReactions)

  if (!reactions || reactions.length === 0) return null

  const chipMap = new Map<string, Chip>()
  for (const r of reactions) {
    const existing = chipMap.get(r.emoji)
    if (existing) {
      existing.count++
      existing.userIds.push(r.user_id)
      if (r.user_id === currentUserId) existing.active = true
    } else {
      chipMap.set(r.emoji, {
        emoji:   r.emoji,
        count:   1,
        active:  r.user_id === currentUserId,
        userIds: [r.user_id],
      })
    }
  }
  const chips = Array.from(chipMap.values())

  const handleClick = async (emoji: string) => {
    if (pending) return
    setPending(emoji)

    // optimistic update
    const next = reactions.filter(r => !(r.emoji === emoji && r.user_id === currentUserId))
    const alreadyReacted = reactions.some(r => r.emoji === emoji && r.user_id === currentUserId)
    if (!alreadyReacted) next.push({ emoji, user_id: currentUserId })
    setReactions(roomId, messageId, next)

    try {
      await toggleReaction(messageId, roomId, emoji, currentUserId, reactions)
    } catch {
      // rollback
      setReactions(roomId, messageId, reactions)
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {chips.map(chip => {
        const names = chip.userIds
          .map(id => senderNames[id] ?? '…')
          .join(', ')
        return (
          <button
            key={chip.emoji}
            title={names}
            onClick={() => handleClick(chip.emoji)}
            disabled={pending !== null}
            className={[
              'flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs transition-colors',
              'border',
              chip.active
                ? 'border-brand bg-brand/8 text-brand font-medium'
                : 'border-border bg-background text-foreground hover:bg-muted',
              pending === chip.emoji ? 'opacity-60' : '',
            ].join(' ')}
          >
            <span>{chip.emoji}</span>
            <span>{chip.count}</span>
          </button>
        )
      })}
    </div>
  )
}
