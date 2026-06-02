import { supabase, getSessionUser } from '../lib/supabase'
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

// fetchRooms + requestCounts를 단일 RPC(get_dashboard_data)로 처리.
// 반환값의 requestCounts는 usePollingRefresh에서 requestStore에 주입.
export async function fetchRooms(): Promise<{ rooms: RoomListItem[]; requestCounts: { received: number; sent: number } }> {
  const user = await getSessionUser()
  if (!user) return { rooms: [], requestCounts: { received: 0, sent: 0 } }

  const { data, error } = await (supabase as any).rpc('get_dashboard_data', { p_user_id: user.id })
  if (error) throw error

  const {
    myMems    = [],
    rooms     = [],
    allMems   = [],
    profiles  = [],
    roomListData = [],
    requestCounts = { received: 0, sent: 0 },
  } = (data ?? {}) as {
    myMems:        { room_id: string; is_pinned: boolean; is_muted: boolean; last_read_at: string | null }[]
    rooms:         Record<string, unknown>[]
    allMems:       { room_id: string; user_id: string; last_read_at: string | null }[]
    profiles:      Pick<Profile, 'id' | 'name' | 'avatar_url' | 'avatar_color' | 'preferred_language' | 'is_bot' | 'presence_status' | 'status_message'>[]
    roomListData:  { room_id: string; unread_count: number; last_message_content: string | null; last_message_at: string | null; last_message_type: string | null }[]
    requestCounts: { received: number; sent: number }
  }

  if (!rooms.length) return { rooms: [], requestCounts }

  const myMemMap   = Object.fromEntries(myMems.map(m => [m.room_id, m]))
  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))

  const membersByRoom: Record<string, (Pick<Profile, 'id' | 'name' | 'avatar_url' | 'avatar_color' | 'preferred_language' | 'is_bot' | 'presence_status' | 'status_message'> & { last_read_at: string | null })[]> = {}
  for (const m of allMems) {
    if (!membersByRoom[m.room_id]) membersByRoom[m.room_id] = []
    const p = profileMap[m.user_id]
    if (p) membersByRoom[m.room_id].push({ ...p, last_read_at: m.last_read_at ?? null })
  }

  const unreadMap: Record<string, number> = {}
  const lastMsgMap: Record<string, { content: string | null; created_at: string; message_type: string } | null> = {}
  for (const row of roomListData) {
    unreadMap[row.room_id]  = Number(row.unread_count ?? 0)
    lastMsgMap[row.room_id] = row.last_message_at
      ? { content: row.last_message_content, created_at: row.last_message_at, message_type: row.last_message_type! }
      : null
  }

  const localRooms = useRoomStore.getState().rooms
  const localMap   = new Map(localRooms.map(r => [r.id, r]))

  const mapped = (rooms as any[]).map(room => {
    const lastMsg            = lastMsgMap[room.id as string]
    const lastMessagePreview = lastMsg ? roomMsgPreview(lastMsg) : (room.last_message ?? null)
    const lastMessageAt      = lastMsg ? lastMsg.created_at : (room.last_message_at ?? null)

    const serverLastRead = myMemMap[room.id]?.last_read_at ?? null
    const localLastRead  = localMap.get(room.id)?.last_read_at ?? null

    const useLocal    = localLastRead && serverLastRead && localLastRead > serverLastRead
    const lastReadAt  = useLocal ? localLastRead : serverLastRead
    const unreadCount = useLocal ? 0 : (unreadMap[room.id] ?? 0)

    return {
      ...room,
      last_message:    lastMessagePreview,
      last_message_at: lastMessageAt,
      members:         membersByRoom[room.id] ?? [],
      is_pinned:       myMemMap[room.id]?.is_pinned ?? false,
      is_muted:        myMemMap[room.id]?.is_muted  ?? false,
      last_read_at:    lastReadAt,
      unread_count:    unreadCount,
    } as RoomListItem
  })

  return { rooms: sortByRecency(mapped), requestCounts }
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
      const user = await getSessionUser()
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

/** MINT DM 방 — 없으면 생성, 있으면 기존 반환 */
export async function getOrCreateMintDmRoom(): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_mint_dm_room')
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
  const user = await getSessionUser()
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

  const user = await getSessionUser()
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
    .upsert(
      { room_id: roomId, user_id: userId },
      { onConflict: 'room_id,user_id', ignoreDuplicates: true },
    )
  if (error) throw error
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
  if (room.room_type === 'mint_dm') {
    const bot = room.members.find(m => m.is_bot)
    return bot?.name ?? 'MINT'
  }
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
  if (room.room_type === 'mint_dm') {
    const bot = room.members.find(m => m.is_bot)
    return { name: bot?.name ?? 'MINT', avatarUrl: bot?.avatar_url ?? null, avatarColor: bot?.avatar_color ?? null }
  }
  if (room.room_type === 'direct') {
    const other = room.members.find(m => m.id !== currentUserId)
    return { name: other?.name ?? '?', avatarUrl: other?.avatar_url ?? null, avatarColor: other?.avatar_color ?? null }
  }
  return { name: room.name ?? '그룹', avatarUrl: null }
}
