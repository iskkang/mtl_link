import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useFriendsStore } from '../stores/friendsStore'
import { useMessageStore } from '../stores/messageStore'
import { useRoomStore } from '../stores/roomStore'
import type { FriendProfile } from '../services/friendsService'
import type { MessageWithSender } from '../types/chat'
import type { RoomListItem } from '../types/chat'

export function usePresenceSubscription() {
  useEffect(() => {
    const channel = supabase
      .channel('profiles-status-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const updated = payload.new as Record<string, unknown>
          const userId = updated.id as string | undefined
          if (!userId) return

          // Build a loosely typed patch, then cast to each store's expected type
          const raw: Record<string, unknown> = {}
          if ('presence_status' in payload.new) raw.presence_status = updated.presence_status
          if ('status_message'  in payload.new) raw.status_message  = updated.status_message
          if ('name'            in payload.new) raw.name            = updated.name
          if ('avatar_url'      in payload.new) raw.avatar_url      = updated.avatar_url
          if ('avatar_color'    in payload.new) raw.avatar_color    = updated.avatar_color

          useFriendsStore.getState().patchProfile(userId, raw as Partial<FriendProfile>)
          useMessageStore.getState().patchSender(userId, raw as Partial<NonNullable<MessageWithSender['sender']>>)
          useRoomStore.getState().patchMember(userId, raw as Partial<RoomListItem['members'][number]>)
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])
}
