import { supabase } from '../lib/supabase'
import type { RoomListItem, Profile } from '../types/chat'

function roomMsgPreview(msg: { message_type: string; content: string | null }): string | null {
  switch (msg.message_type) {
    case 'image':            return '[사진]'
    case 'file':             return '[파일]'
    case 'voice_translated': return '[음성 메시지]'
    default:                 return msg.content
  }
}

export async function fetchRooms(): Promise<RoomListItem[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // 1. 내가 속한 방 멤버십
  const { data: myMems, error: e1 } = await supabase
    .from('room_members')
    .select('room_id, is_pinned, is_muted, last_read_at')
    .eq('user_id', user.id)
  if (e1) throw e1
  if (!myMems?.length) return []

  const roomIds = myMems.map(m => m.room_id)

  // 2. 방 기본 정보
  const { data: rooms, error: e2 } = await supabase
    .from('rooms')
    .select('*')
    .in('id', roomIds)
    .order('last_message_at', { ascending: false, nullsFirst: false })
  if (e2) throw e2
  if (!rooms?.length) return []

  // 3. 방 멤버 목록 (room_id + user_id + last_read_at)
  const { data: allMems, error: e3 } = await supabase
    .from('room_members')
    .select('room_id, user_id, last_read_at')
    .in('room_id', roomIds)
  if (e3) throw e3

  // 4. 멤버 프로필
  const memberIds = [...new Set((allMems ?? []).map(m => m.user_id))]
  const { data: profiles, error: e4 } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, preferred_language, is_bot')
    .in('id', memberIds)
  if (e4) throw e4

  // 5. 언리드 카운트 (병렬)
  const myMemMap = Object.fromEntries(myMems.map(m => [m.room_id, m]))
  const unreadCounts = await Promise.all(
    rooms.map(async room => {
      const lastRead = myMemMap[room.id]?.last_read_at
      if (!lastRead) return { roomId: room.id, count: 0 }
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id)
        .gt('created_at', lastRead)
        .is('deleted_at', null)
        .is('thread_root_id', null)
        .neq('sender_id', user.id)
      return { roomId: room.id, count: count ?? 0 }
    }),
  )

  // NOTE: N+1 query pattern. Acceptable for current scale (5-10 rooms).
  // For future scaling beyond ~50 rooms, migrate to:
  //   - Database view (rooms_with_last_message)
  //   - Or RPC function with single query
  //   - Or denormalized last_message column with DB trigger
  const lastMessages = await Promise.all(
    rooms.map(async room => {
      const { data } = await supabase
        .from('messages')
        .select('content, created_at, message_type')
        .eq('room_id', room.id)
        .is('deleted_at', null)
        .is('thread_root_id', null)
        .neq('message_type', 'system')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return { roomId: room.id, msg: data }
    }),
  )
  const lastMsgMap = Object.fromEntries(lastMessages.map(x => [x.roomId, x.msg]))

  // 조합
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const membersByRoom: Record<string, (Pick<Profile, 'id' | 'name' | 'avatar_url' | 'preferred_language' | 'is_bot'> & { last_read_at: string | null })[]> = {}
  for (const m of allMems ?? []) {
    if (!membersByRoom[m.room_id]) membersByRoom[m.room_id] = []
    const p = profileMap[m.user_id]
    if (p) membersByRoom[m.room_id].push({ ...p, last_read_at: m.last_read_at ?? null })
  }
  const unreadMap = Object.fromEntries(unreadCounts.map(u => [u.roomId, u.count]))

  return rooms.map(room => {
    const lastMsg = lastMsgMap[room.id]
    const lastMessagePreview = lastMsg ? roomMsgPreview(lastMsg) : (room.last_message ?? null)
    const lastMessageAt = lastMsg ? lastMsg.created_at : (room.last_message_at ?? null)
    return {
      ...room,
      last_message:    lastMessagePreview,
      last_message_at: lastMessageAt,
      members:         membersByRoom[room.id] ?? [],
      is_pinned:       myMemMap[room.id]?.is_pinned  ?? false,
      is_muted:        myMemMap[room.id]?.is_muted   ?? false,
      last_read_at:    myMemMap[room.id]?.last_read_at ?? null,
      unread_count:    unreadMap[room.id] ?? 0,
    }
  })
}

export async function markAsRead(roomId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const now = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('room_members')
    .update({ last_read_at: now })
    .eq('room_id', roomId)
    .eq('user_id', user.id)
  if (updateError) console.error('[markAsRead]', updateError)
  // broadcast는 useRealtimeMessages에서 postgres_changes relay로 처리
}

// ─── 방 생성 ────────────────────────────────────────────────────

/** 1:1 DM — DB 함수가 중복 방 생성을 방지 */
export async function createDirectRoom(targetUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_direct_room', {
    p_target_user_id: targetUserId,
  })
  if (error) throw error
  return data as string
}

/** 그룹 채팅 생성 */
export async function createGroupRoom(name: string, memberIds: string[]): Promise<string> {
  const { data, error } = await supabase.rpc('create_group_room', {
    p_name:       name,
    p_member_ids: memberIds,
  })
  if (error) throw error
  return data as string
}

// ─── 방 나가기 / 삭제 ───────────────────────────────────────

export async function leaveRoom(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_room', { p_room_id: roomId })
  if (error) throw error
}

export async function joinChannel(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('join_channel', { p_room_id: roomId })
  if (error) throw error
}

export interface PublicChannel {
  id:          string
  name:        string
  description: string | null
  is_default:  boolean
  memberCount: number
  isJoined:    boolean
}

export async function fetchPublicChannels(): Promise<PublicChannel[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: channels, error } = await supabase
    .from('rooms')
    .select('id, name, description, is_default')
    .eq('room_type', 'channel')
    .eq('is_private', false)
    .order('name')
  if (error) throw error
  if (!channels?.length) return []

  const channelIds = channels.map(c => c.id)

  const [{ data: allMembers }, { data: myMemberships }] = await Promise.all([
    supabase.from('room_members').select('room_id').in('room_id', channelIds),
    supabase.from('room_members').select('room_id').in('room_id', channelIds).eq('user_id', user.id),
  ])

  const countMap: Record<string, number> = {}
  for (const m of allMembers ?? []) {
    countMap[m.room_id] = (countMap[m.room_id] ?? 0) + 1
  }
  const joinedSet = new Set((myMemberships ?? []).map(m => m.room_id))

  return channels.map(c => ({
    id:          c.id,
    name:        c.name ?? '',
    description: c.description ?? null,
    is_default:  c.is_default ?? false,
    memberCount: countMap[c.id] ?? 0,
    isJoined:    joinedSet.has(c.id),
  }))
}

export async function deleteRoom(roomId: string): Promise<void> {
  const { error } = await supabase.from('rooms').delete().eq('id', roomId)
  if (error) throw error
}

/** DM: 상대방 이름, 그룹: 방 이름 */
export function getRoomDisplayName(room: RoomListItem, currentUserId: string): string {
  if (room.room_type === 'direct') {
    const other = room.members.find(m => m.id !== currentUserId)
    return other?.name ?? '알 수 없음'
  }
  return room.name ?? '그룹 채팅'
}

export function getRoomAvatarInfo(
  room: RoomListItem,
  currentUserId: string,
): { name: string; avatarUrl: string | null } {
  if (room.room_type === 'direct') {
    const other = room.members.find(m => m.id !== currentUserId)
    return { name: other?.name ?? '?', avatarUrl: other?.avatar_url ?? null }
  }
  return { name: room.name ?? '그룹', avatarUrl: null }
}
