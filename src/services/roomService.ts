import { supabase } from '../lib/supabase'
import { useRoomStore, sortByRecency } from '../stores/roomStore'
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
    .select('id, name, avatar_url, avatar_color, preferred_language, is_bot, presence_status, status_message')
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
  const membersByRoom: Record<string, (Pick<Profile, 'id' | 'name' | 'avatar_url' | 'avatar_color' | 'preferred_language' | 'is_bot' | 'presence_status' | 'status_message'> & { last_read_at: string | null })[]> = {}
  for (const m of allMems ?? []) {
    if (!membersByRoom[m.room_id]) membersByRoom[m.room_id] = []
    const p = profileMap[m.user_id]
    if (p) membersByRoom[m.room_id].push({ ...p, last_read_at: m.last_read_at ?? null })
  }
  const unreadMap = Object.fromEntries(unreadCounts.map(u => [u.roomId, u.count]))

  // 로컬 스토어에 낙관적으로 적용된 last_read_at이 서버보다 최신일 수 있음.
  // fetchRooms 응답이 stale한 last_read_at을 가져오면 unread가 되살아나므로
  // 로컬값이 더 최신이면 로컬을 우선한다.
  const localRooms = useRoomStore.getState().rooms
  const localMap   = new Map(localRooms.map(r => [r.id, r]))

  const mapped = rooms.map(room => {
    const lastMsg = lastMsgMap[room.id]
    const lastMessagePreview = lastMsg ? roomMsgPreview(lastMsg) : (room.last_message ?? null)
    const lastMessageAt = lastMsg ? lastMsg.created_at : (room.last_message_at ?? null)

    const serverLastRead = myMemMap[room.id]?.last_read_at ?? null
    const localLastRead  = localMap.get(room.id)?.last_read_at ?? null

    // 로컬값이 서버값보다 최신이면 로컬을 사용하고 unread를 0으로 고정
    const useLocal = localLastRead && serverLastRead && localLastRead > serverLastRead
    const lastReadAt   = useLocal ? localLastRead : serverLastRead
    const unreadCount  = useLocal ? 0 : (unreadMap[room.id] ?? 0)

    return {
      ...room,
      last_message:    lastMessagePreview,
      last_message_at: lastMessageAt,
      members:         membersByRoom[room.id] ?? [],
      is_pinned:       myMemMap[room.id]?.is_pinned ?? false,
      is_muted:        myMemMap[room.id]?.is_muted  ?? false,
      last_read_at:    lastReadAt,
      unread_count:    unreadCount,
    }
  })

  return sortByRecency(mapped)
}

export async function markAsRead(roomId: string): Promise<void> {
  // 1. 즉시 낙관적 업데이트 — DB write 완료 전에도 UI가 unread 0으로 보임
  const optimisticTime = new Date().toISOString()
  useRoomStore.getState().applyLocalRead(roomId, optimisticTime)

  // 2. 서버 RPC 호출 — DB의 NOW()를 timestamp로 사용해 클라이언트 시계 오차 제거
  //    mark_room_as_read RPC가 없는 경우 fallback으로 직접 UPDATE
  const { data: serverTime, error } = await (supabase as any)
    .rpc('mark_room_as_read', { p_room_id: roomId })

  if (error) {
    // RPC 미존재(PGRST202) 시 직접 UPDATE로 폴백
    if (error.code === 'PGRST202' || error.message?.includes('Could not find')) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error: updateError } = await supabase
        .from('room_members')
        .update({ last_read_at: optimisticTime })
        .eq('room_id', roomId)
        .eq('user_id', user.id)
      if (updateError) console.error('[markAsRead] fallback UPDATE 실패:', updateError)
    } else {
      console.error('[markAsRead] RPC 실패:', error)
    }
    return // 낙관적 업데이트는 이미 적용됨
  }

  // 3. 서버 timestamp로 교체 (정확한 값 확정)
  if (serverTime) {
    useRoomStore.getState().applyLocalRead(roomId, serverTime as string)
  }
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

// ─── 채널 생성 / 수정 / 멤버 관리 ──────────────────────────────

export async function createChannel(params: {
  name: string
  description?: string | null
  memberIds?: string[]
}): Promise<string> {
  const { name, description = null, memberIds = [] } = params

  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .insert({
      name:        name.trim(),
      description: description?.trim() || null,
      room_type:   'channel',
      is_private:  false,
    } as never)
    .select('id')
    .single()

  if (roomErr) throw roomErr

  const { data: { user } } = await supabase.auth.getUser()
  const allMemberIds = [...new Set([user!.id, ...memberIds])]

  const { error: memberErr } = await supabase
    .from('room_members')
    .insert(allMemberIds.map(uid => ({ room_id: (room as { id: string }).id, user_id: uid })))

  if (memberErr) throw memberErr

  return (room as { id: string }).id
}

export async function updateChannel(
  roomId: string,
  updates: { name?: string; description?: string | null }
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (updates.name !== undefined)        patch.name        = updates.name.trim()
  if (updates.description !== undefined) patch.description = updates.description?.trim() || null

  const { error } = await supabase
    .from('rooms')
    .update(patch as never)
    .eq('id', roomId)

  if (error) throw error
}

export async function inviteToChannel(roomId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('room_members')
    .insert({ room_id: roomId, user_id: userId })
  if (error && error.code !== '23505') throw error
}

export async function removeMemberFromChannel(roomId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('room_members')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function fetchChannelMembers(
  roomId: string
): Promise<{ id: string; name: string; avatar_url: string | null; avatar_color: string | null }[]> {
  const { data: mems, error: e1 } = await supabase
    .from('room_members')
    .select('user_id')
    .eq('room_id', roomId)
  if (e1) throw e1

  const userIds = (mems ?? []).map(m => m.user_id)
  if (!userIds.length) return []

  const { data: profiles, error: e2 } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, avatar_color')
    .in('id', userIds)
  if (e2) throw e2

  return (profiles ?? []) as { id: string; name: string; avatar_url: string | null; avatar_color: string | null }[]
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
): { name: string; avatarUrl: string | null; avatarColor?: string | null } {
  if (room.room_type === 'direct') {
    const other = room.members.find(m => m.id !== currentUserId)
    return { name: other?.name ?? '?', avatarUrl: other?.avatar_url ?? null, avatarColor: other?.avatar_color ?? null }
  }
  return { name: room.name ?? '그룹', avatarUrl: null }
}
