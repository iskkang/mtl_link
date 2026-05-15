# MINT 진입점 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route the MenuRail MINT button to the user's `mint_dm` room instead of `AiChatWindow`, so BriefingCards and quick actions are accessible via the normal chat DM list.

**Architecture:** Six targeted changes — a new `get_or_create_mint_dm_room` SQL RPC, TypeScript room type update, two roomService helpers, DmItem image-avatar support, ChatWindow isDirect fix, and ChatPage navigation rewiring. The `bot-respond` Edge Function and `useMessages.isBotRoom` already handle `mint_dm` rooms with no changes needed.

**Tech Stack:** Supabase PostgreSQL (SECURITY DEFINER RPC), React + Zustand, TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-13-mint-daily-briefing-design.md`

---

## Codebase findings (do not re-investigate)

| Question | Answer |
|----------|--------|
| Current MINT button | MenuRail `onSectionChange('ai')` → `setActiveSection('ai')` → `AiChatWindow` |
| DM list filter | `rooms.filter(r => r.room_type !== 'channel')` — **mint_dm already included** |
| fetchRooms() | No room_type filter — fetches all member rooms including mint_dm |
| getRoomDisplayName mint_dm | Falls to `room.name ?? '그룹 채팅'` — **broken, needs fix** |
| getRoomAvatarInfo mint_dm | Returns `{ avatarUrl: null }` — **broken, shows initials** |
| DmItem avatar | Renders initials in colored square — **no image support** |
| database.ts room_type | `'direct' \| 'group' \| 'channel'` — **missing mint_dm** |
| isBotRoom (useMessages) | `members.some(m => m.id === BOT_USER_ID \|\| m.is_bot)` — **already true for mint_dm** |
| bot-respond room check | Checks BOT_USER_ID membership, not room_type — **already supports mint_dm** |
| Empty state | `isBotRoom && !loading && messages.length === 0` → `AiQuickActions` — **already works** |

---

## File Map

| Action | Path |
|--------|------|
| Create | `supabase/migrations/20260513000004_get_or_create_mint_dm_room.sql` |
| Modify | `src/types/database.ts` lines 95, 111, 127 — rooms room_type union |
| Modify | `src/services/roomService.ts` — getRoomDisplayName, getRoomAvatarInfo, add getOrCreateMintDmRoom |
| Modify | `src/components/sidebar/DmItem.tsx` — image avatar branch |
| Modify | `src/components/layout/ChatWindow.tsx` line 137 — isDirect includes mint_dm |
| Modify | `src/pages/ChatPage.tsx` — handleSectionChange('ai'), handleSelectFriend(bot), handleAiNavigate, handleAiBack, import |

---

## Task 1: Migration — get_or_create_mint_dm_room RPC

**Files:**
- Create: `supabase/migrations/20260513000004_get_or_create_mint_dm_room.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260513000004_get_or_create_mint_dm_room.sql

CREATE OR REPLACE FUNCTION get_or_create_mint_dm_room()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_bot_id  UUID := '00000000-0000-0000-0000-000000000001';
  v_room_id UUID;
BEGIN
  -- Find existing mint_dm room for this user
  SELECT rm.room_id INTO v_room_id
  FROM room_members rm
  JOIN rooms r ON r.id = rm.room_id
  WHERE rm.user_id = v_user_id
    AND r.room_type = 'mint_dm'
  LIMIT 1;

  IF v_room_id IS NOT NULL THEN
    RETURN v_room_id;
  END IF;

  -- Create new mint_dm room (no name required — mint_dm is exempt from name constraint)
  INSERT INTO rooms (room_type)
  VALUES ('mint_dm')
  RETURNING id INTO v_room_id;

  -- Add user and bot as members
  INSERT INTO room_members (room_id, user_id)
  VALUES (v_room_id, v_user_id), (v_room_id, v_bot_id);

  RETURN v_room_id;
END;
$$;
```

- [ ] **Step 2: Run in Supabase Dashboard → SQL Editor**

Expected: `CREATE FUNCTION` success.

Verify:
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'get_or_create_mint_dm_room';
```

Expected: one row.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260513000004_get_or_create_mint_dm_room.sql
git commit -m "feat(db): add get_or_create_mint_dm_room RPC for client-side MINT room creation"
```

---

## Task 2: TypeScript types — rooms room_type

**Files:**
- Modify: `src/types/database.ts` lines 95, 111, 127

- [ ] **Step 1: Update Row type (line 95)**

Find:
```ts
          room_type:                    'direct' | 'group' | 'channel'
          name:                         string | null
          created_by:                   string | null
```
(This is the Row type block, under `// ─── rooms ───`)

Replace with:
```ts
          room_type:                    'direct' | 'group' | 'channel' | 'mint_dm'
          name:                         string | null
          created_by:                   string | null
```

- [ ] **Step 2: Update Insert type (line 111)**

Find:
```ts
          room_type:                     'direct' | 'group' | 'channel'
          name?:                         string | null
          created_by?:                   string | null
```
(This is the Insert type block — `room_type` is required, no `?`)

Replace with:
```ts
          room_type:                     'direct' | 'group' | 'channel' | 'mint_dm'
          name?:                         string | null
          created_by?:                   string | null
```

- [ ] **Step 3: Update Update type (line 127)**

Find:
```ts
          room_type?:                    'direct' | 'group' | 'channel'
          name?:                         string | null
          created_by?:                   string | null
```
(This is the Update type block — `room_type?` has `?`)

Replace with:
```ts
          room_type?:                    'direct' | 'group' | 'channel' | 'mint_dm'
          name?:                         string | null
          created_by?:                   string | null
```

- [ ] **Step 4: Verify typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(types): add mint_dm to rooms room_type union"
```

---

## Task 3: roomService — mint_dm display name, avatar, and getOrCreateMintDmRoom

**Files:**
- Modify: `src/services/roomService.ts`

- [ ] **Step 1: Fix getRoomDisplayName**

Find:
```ts
export function getRoomDisplayName(room: RoomListItem, currentUserId: string): string {
  if (room.room_type === 'direct') {
    const other = room.members.find(m => m.id !== currentUserId)
    return other?.name ?? '알 수 없음'
  }
  return room.name ?? '그룹 채팅'
}
```

Replace with:
```ts
export function getRoomDisplayName(room: RoomListItem, currentUserId: string): string {
  if (room.room_type === 'direct' || room.room_type === 'mint_dm') {
    const other = room.members.find(m => m.id !== currentUserId)
    return other?.name ?? '알 수 없음'
  }
  return room.name ?? '그룹 채팅'
}
```

- [ ] **Step 2: Fix getRoomAvatarInfo**

Find:
```ts
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
```

Replace with:
```ts
export function getRoomAvatarInfo(
  room: RoomListItem,
  currentUserId: string,
): { name: string; avatarUrl: string | null; avatarColor?: string | null } {
  if (room.room_type === 'direct' || room.room_type === 'mint_dm') {
    const other = room.members.find(m => m.id !== currentUserId)
    return { name: other?.name ?? '?', avatarUrl: other?.avatar_url ?? null, avatarColor: other?.avatar_color ?? null }
  }
  return { name: room.name ?? '그룹', avatarUrl: null }
}
```

- [ ] **Step 3: Add getOrCreateMintDmRoom function**

Find the `createDirectRoom` export:
```ts
/** 1:1 DM — DB 함수가 중복 방 생성을 방지 */
export async function createDirectRoom(targetUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_direct_room', {
    p_target_user_id: targetUserId,
  })
  if (error) throw error
  return data as string
}
```

Insert immediately after that function:
```ts
/** MINT DM 방 — 없으면 생성, 있으면 기존 반환 */
export async function getOrCreateMintDmRoom(): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_mint_dm_room')
  if (error) throw error
  return data as string
}
```

- [ ] **Step 4: Verify typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/services/roomService.ts
git commit -m "feat(rooms): handle mint_dm in display name/avatar, add getOrCreateMintDmRoom"
```

---

## Task 4: DmItem — image avatar support

**Files:**
- Modify: `src/components/sidebar/DmItem.tsx`

- [ ] **Step 1: Update the avatar rendering block**

Find:
```tsx
        {/* 8px rounded square avatar */}
        <div
          className="w-[22px] h-[22px] flex-shrink-0 flex items-center justify-center
                     text-white font-semibold text-[10px]"
          style={{
            background:   avatar.avatarColor ?? '#7F77DD',
            borderRadius: '6px',
          }}
        >
          {getInitials(avatar.name)}
        </div>
```

Replace with:
```tsx
        {/* 8px rounded square avatar */}
        {avatar.avatarUrl ? (
          <div
            className="w-[22px] h-[22px] flex-shrink-0 flex items-center justify-center"
            style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '6px' }}
          >
            <img src={avatar.avatarUrl} alt={avatar.name} className="w-[16px] h-[16px]" />
          </div>
        ) : (
          <div
            className="w-[22px] h-[22px] flex-shrink-0 flex items-center justify-center
                       text-white font-semibold text-[10px]"
            style={{
              background:   avatar.avatarColor ?? '#7F77DD',
              borderRadius: '6px',
            }}
          >
            {getInitials(avatar.name)}
          </div>
        )}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/sidebar/DmItem.tsx
git commit -m "feat(sidebar): render image avatar in DmItem when avatarUrl is set"
```

---

## Task 5: ChatWindow — isDirect includes mint_dm

**Files:**
- Modify: `src/components/layout/ChatWindow.tsx` line ~137

- [ ] **Step 1: Update isDirect**

Find (around line 137):
```ts
  const isDirect      = !!room && room.room_type === 'direct'
```

Replace with:
```ts
  const isDirect      = !!room && (room.room_type === 'direct' || room.room_type === 'mint_dm')
```

This ensures `mint_dm` rooms:
- Show "direct leave" toast text (not "leave room" toast)
- Show "direct leave" modal copy
- Don't show the "delete room" button in the header menu (which only shows for non-direct owners)
- Correctly derive `peer` (the bot member) for the header

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/ChatWindow.tsx
git commit -m "fix(chat): treat mint_dm as isDirect in ChatWindow"
```

---

## Task 6: ChatPage — wire MINT button to mint_dm room

**Files:**
- Modify: `src/pages/ChatPage.tsx`

- [ ] **Step 1: Add getOrCreateMintDmRoom to imports**

Find:
```ts
import { createDirectRoom, fetchRooms } from '../services/roomService'
```

Replace with:
```ts
import { createDirectRoom, fetchRooms, getOrCreateMintDmRoom } from '../services/roomService'
```

- [ ] **Step 2: Change handleSectionChange('ai')**

Find:
```ts
  const handleSectionChange = async (s: Section) => {
    if (s === 'bots') {
      try {
        const roomId = await createDirectRoom(BOT_USER_ID)
        const rooms = await fetchRooms()
        useRoomStore.getState().setRooms(rooms)
        handleSelectRoom(roomId)
      } catch (err) {
        console.error('봇 방 생성 실패:', err)
      }
      return
    }
    setActiveSection(s)
  }
```

Replace with:
```ts
  const handleSectionChange = async (s: Section) => {
    if (s === 'bots') {
      try {
        const roomId = await createDirectRoom(BOT_USER_ID)
        const rooms = await fetchRooms()
        useRoomStore.getState().setRooms(rooms)
        handleSelectRoom(roomId)
      } catch (err) {
        console.error('봇 방 생성 실패:', err)
      }
      return
    }
    if (s === 'ai') {
      try {
        const roomId = await getOrCreateMintDmRoom()
        const updatedRooms = await fetchRooms()
        useRoomStore.getState().setRooms(updatedRooms)
        useRoomStore.getState().resetUnread(roomId)
        setSelectedRoomId(roomId)
        setShowChat(true)
        setActiveSection('chat')
      } catch (err) {
        console.error('MINT 방 진입 실패:', err)
      }
      return
    }
    setActiveSection(s)
  }
```

- [ ] **Step 3: Change handleSelectFriend for BOT_USER_ID**

Find the BOT_USER_ID branch inside `handleSelectFriend`:
```ts
      if (userId === BOT_USER_ID) {
        useRoomStore.getState().resetUnread(roomId)
        setSelectedRoomId(roomId)
        setShowChat(true)
        setActiveAiView('chat')
        // activeSection은 'ai' 그대로 유지
      } else {
```

Replace with:
```ts
      if (userId === BOT_USER_ID) {
        useRoomStore.getState().resetUnread(roomId)
        setSelectedRoomId(roomId)
        setShowChat(true)
        setActiveSection('chat')
      } else {
```

Note: `roomId` here is the result of `createDirectRoom(userId)` which creates a `direct` room, not `mint_dm`. This is fine — existing direct bot rooms still work. The MINT button uses `getOrCreateMintDmRoom()` (Task 6 Step 2) for the primary path.

- [ ] **Step 4: Fix handleAiNavigate to also set activeSection('ai')**

Find:
```ts
  const handleAiNavigate = (view: 'quotation' | 'message' | 'transport' | 'customs' | 'hscode' | 'tracking') => setActiveAiView(view)
```

Replace with:
```ts
  const handleAiNavigate = (view: 'quotation' | 'message' | 'transport' | 'customs' | 'hscode' | 'tracking') => {
    setActiveAiView(view)
    setActiveSection('ai')
  }
```

This ensures tool pages (QuotationPage, TransportPage etc.) render when triggered from within ChatWindow.

- [ ] **Step 5: Fix handleAiBack to return to chat section**

Find:
```ts
  const handleAiBack     = () => setActiveAiView('chat')
```

Replace with:
```ts
  const handleAiBack = () => {
    setActiveAiView('chat')
    setActiveSection('chat')
  }
```

This ensures "Back" from a tool page returns to the ChatWindow (selectedRoomId is still set to the mint_dm room).

- [ ] **Step 6: Verify typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 7: Verify build**

```bash
npm run build
```

Expected: 0 errors (size warnings are OK).

- [ ] **Step 8: Commit**

```bash
git add src/pages/ChatPage.tsx
git commit -m "feat(mint): wire MINT button to mint_dm room, fix AI tool back-nav"
```

---

## Rollback

If the MINT button breaks:
```ts
// In handleSectionChange, remove the 'ai' block — it falls through to setActiveSection(s)
// which restores the old AiChatWindow behaviour
```

The SQL RPC is safe to leave in place; it doesn't affect anything until called.
