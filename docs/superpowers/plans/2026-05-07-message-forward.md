# Message Forward (v2.6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add KakaoTalk-style message forward — long-press/right-click any message, pick up to 5 rooms, send.

**Architecture:** Add `forwarded_from_*` columns to the existing `messages` table. Slot "Forward" into the existing `MessageActions` interface so it flows automatically into `MessageMenu` (desktop) and `MobileMessageSheet` (mobile). A new `ForwardSheet` component handles room selection. State lives in `ChatWindow` (mirrors existing `replyTo` pattern).

**Tech Stack:** React 18, TypeScript, Supabase (postgres + storage), Vite, i18next, lucide-react, Tailwind CSS with CSS variables (`var(--brand)`, `var(--card)`, etc.)

---

## Codebase map (read this before each task)

| File | Role |
|---|---|
| `src/types/database.ts` | Hand-written Supabase type mirror — manually update when schema changes |
| `src/types/chat.ts` | `MessageWithSender` extends `Message` (from database.ts) |
| `src/components/chat/messageActions.ts` | Shared `MessageActions` + `MessageActionContext` interfaces |
| `src/components/chat/MessageMenu.tsx` | Desktop floating context menu, implements `MessageActions` |
| `src/components/chat/MobileMessageSheet.tsx` | Mobile bottom sheet, implements `MessageActions` |
| `src/components/chat/MessageBubble.tsx` | Renders one message; already uses `useLongPress` → `MobileMessageSheet` |
| `src/components/chat/MessageList.tsx` | Maps messages → `MessageBubble` |
| `src/components/layout/ChatWindow.tsx` | Owns conversation state; manages `replyTo`, thread, search |
| `src/hooks/useLongPress.ts` | Pointer-based long-press (touch only, already used by MessageBubble) |
| `src/lib/i18n.ts` | All 6 languages in one file (ko, en, ru, uz, zh, ja) — inline `resources` object |
| `src/lib/supabase.ts` | Supabase client |

### Key schema facts (do not assume, verify before editing)
- `messages` primary key: `id` (uuid). Sender field: **`sender_id`** (not `user_id`).
- Files/images live in `message_attachments` table (separate rows), not inline on `messages`.
- `MessageWithSender.sender` is a `Pick<Profile, 'id'|'name'|...>` join — sender name is `message.sender?.name`.

---

## Task 1: DB schema — SQL + TypeScript type

**Files:**
- Manual: run SQL in Supabase dashboard
- Modify: `src/types/database.ts` (messages Row / Insert / Update blocks)

- [ ] **Step 1: Run this SQL in Supabase SQL Editor**

```sql
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS forwarded_from_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS forwarded_from_user_name TEXT,
  ADD COLUMN IF NOT EXISTS forwarded_from_message_id UUID REFERENCES messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_forwarded_from
  ON messages(forwarded_from_message_id)
  WHERE forwarded_from_message_id IS NOT NULL;
```

Verify: run `SELECT forwarded_from_user_id, forwarded_from_user_name, forwarded_from_message_id FROM messages LIMIT 1;` — should return a row with NULL values and no error.

- [ ] **Step 2: Update `src/types/database.ts` — messages Row block**

Find the `Row:` block inside `messages:` (around line 198) and add three fields at the end of Row (after `followup_reminded_at`):

```ts
          forwarded_from_user_id?:   string | null
          forwarded_from_user_name?: string | null
          forwarded_from_message_id?: string | null
```

- [ ] **Step 3: Update Insert block** (after `followup_reminded_at?`)

```ts
          forwarded_from_user_id?:    string | null
          forwarded_from_user_name?:  string | null
          forwarded_from_message_id?: string | null
```

- [ ] **Step 4: Update Update block** (same three optional fields)

```ts
          forwarded_from_user_id?:    string | null
          forwarded_from_user_name?:  string | null
          forwarded_from_message_id?: string | null
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors mentioning `forwarded_from`.

- [ ] **Step 6: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(forward): add forwarded_from_* fields to messages type"
```

---

## Task 2: i18n — add forward keys to all 6 languages

**Files:**
- Modify: `src/lib/i18n.ts`

- [ ] **Step 1: Add Korean keys**

Inside the `ko > translation` object, after the last existing key, add:

```ts
      // ── 메시지 전달 ──────────────────────────────────
      forwardTitle:        '메시지 전달',
      forwardSend:         '전달',
      forwardSendCount:    '전달 ({{count}})',
      forwardSearch:       '채팅방 검색',
      forwardMaxLimit:     '최대 5개 채팅방까지 선택할 수 있어요',
      forwardSuccess:      '{{count}}개 채팅방에 전달했어요',
      forwardedFrom:       '{{name}}님이 보낸 메시지',
      forwardNoResults:    '검색 결과가 없어요',
      forwardCurrentRoom:  '현재',
      msgForward:          '전달',
```

- [ ] **Step 2: Add English keys** (inside `en > translation`)

```ts
      forwardTitle:        'Forward Message',
      forwardSend:         'Forward',
      forwardSendCount:    'Forward ({{count}})',
      forwardSearch:       'Search chats',
      forwardMaxLimit:     'You can select up to 5 chats',
      forwardSuccess:      'Forwarded to {{count}} chat(s)',
      forwardedFrom:       'Forwarded from {{name}}',
      forwardNoResults:    'No results found',
      forwardCurrentRoom:  'Current',
      msgForward:          'Forward',
```

- [ ] **Step 3: Add Russian keys** (inside `ru > translation`)

```ts
      forwardTitle:        'Переслать сообщение',
      forwardSend:         'Переслать',
      forwardSendCount:    'Переслать ({{count}})',
      forwardSearch:       'Поиск чатов',
      forwardMaxLimit:     'Можно выбрать не более 5 чатов',
      forwardSuccess:      'Переслано в {{count}} чат(а)',
      forwardedFrom:       'Переслано от {{name}}',
      forwardNoResults:    'Ничего не найдено',
      forwardCurrentRoom:  'Текущий',
      msgForward:          'Переслать',
```

- [ ] **Step 4: Add Uzbek keys** (inside `uz > translation`)

```ts
      forwardTitle:        'Xabarni yo\'naltirish',
      forwardSend:         'Yo\'naltirish',
      forwardSendCount:    'Yo\'naltirish ({{count}})',
      forwardSearch:       'Chatlarni qidirish',
      forwardMaxLimit:     'Ko\'pi bilan 5 ta chat tanlash mumkin',
      forwardSuccess:      '{{count}} ta chatga yo\'naltirildi',
      forwardedFrom:       '{{name}} dan yo\'naltirilgan',
      forwardNoResults:    'Hech narsa topilmadi',
      forwardCurrentRoom:  'Joriy',
      msgForward:          'Yo\'naltirish',
```

- [ ] **Step 5: Add Chinese keys** (inside `zh > translation`)

```ts
      forwardTitle:        '转发消息',
      forwardSend:         '转发',
      forwardSendCount:    '转发 ({{count}})',
      forwardSearch:       '搜索聊天',
      forwardMaxLimit:     '最多可选择5个聊天',
      forwardSuccess:      '已转发至{{count}}个聊天',
      forwardedFrom:       '来自{{name}}的消息',
      forwardNoResults:    '没有找到结果',
      forwardCurrentRoom:  '当前',
      msgForward:          '转发',
```

- [ ] **Step 6: Add Japanese keys** (inside `ja > translation`)

```ts
      forwardTitle:        'メッセージを転送',
      forwardSend:         '転送',
      forwardSendCount:    '転送 ({{count}})',
      forwardSearch:       'チャットを検索',
      forwardMaxLimit:     '最大5つのチャットを選択できます',
      forwardSuccess:      '{{count}}件のチャットに転送しました',
      forwardedFrom:       '{{name}}からのメッセージ',
      forwardNoResults:    '検索結果がありません',
      forwardCurrentRoom:  '現在',
      msgForward:          '転送',
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/i18n.ts
git commit -m "feat(forward): add forward i18n keys for all 6 languages"
```

---

## Task 3: MessageActions interface + Forward item in both menus

**Files:**
- Modify: `src/components/chat/messageActions.ts`
- Modify: `src/components/chat/MessageMenu.tsx`
- Modify: `src/components/chat/MobileMessageSheet.tsx`

- [ ] **Step 1: Add `onForward?` to `MessageActions` interface** in `src/components/chat/messageActions.ts`

Add after `onReply?`:

```ts
  onForward?: () => void
```

Full file after edit:

```ts
/** Shared action handler interface — used by MessageMenu (desktop) and MobileMessageSheet (mobile) */
export interface MessageActions {
  onCopy:           () => void
  onCreateTask:     () => void
  onOpenThread?:    () => void
  onMarkFollowup?:  () => void
  onUnmarkRequest?: () => void
  onMarkReceived?:  () => void
  onEdit?:          () => void
  onDelete?:        () => void
  onReact?:         (emoji: string) => void
  onReply?:         () => void
  onForward?:       () => void
}

/** Shared context for conditional action visibility */
export interface MessageActionContext {
  isOwn:            boolean
  canEdit:          boolean
  needsResponse:    boolean
  responseReceived: boolean
}
```

- [ ] **Step 2: Add Forward to `MessageMenu.tsx`** (desktop menu)

Add `Share2` to the lucide import line:
```ts
import { Copy, CheckSquare, Clock, CheckCheck, Pencil, Trash2, MessageSquare, CornerUpLeft, Share2 } from 'lucide-react'
```

Add `onForward` to the destructure in `export function MessageMenu({`:
```ts
  onCopy, onCreateTask, onOpenThread,
  onMarkFollowup, onUnmarkRequest, onMarkReceived,
  onEdit, onDelete, onReact, onReply, onForward,
```

Insert the Forward menu item right after the `onReply` block (around line 82) and before `onCopy`:

```tsx
      {onForward && (
        <MenuItem icon={Share2} label={t('msgForward')} onClick={act(onForward)} />
      )}
```

- [ ] **Step 3: Add Forward to `MobileMessageSheet.tsx`** (mobile sheet)

Add `Share2` to the lucide import:
```ts
import { Copy, CheckSquare, Clock, CheckCheck, Pencil, Trash2, MessageSquare, CornerUpLeft, Share2 } from 'lucide-react'
```

Add `onForward` to the destructure in `export function MobileMessageSheet({`:
```ts
  onCopy, onCreateTask, onOpenThread,
  onMarkFollowup, onUnmarkRequest, onMarkReceived,
  onEdit, onDelete, onReact, onReply, onForward,
```

Insert after the `onReply` SheetRow and before the `onCopy` SheetRow:

```tsx
          {onForward && (
            <SheetRow icon={Share2} label={t('msgForward')} onClick={act(onForward)} />
          )}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/messageActions.ts src/components/chat/MessageMenu.tsx src/components/chat/MobileMessageSheet.tsx
git commit -m "feat(forward): add onForward to MessageActions and both menus"
```

---

## Task 4: MessageBubble — forwarded label + onForward prop

**Files:**
- Modify: `src/components/chat/MessageBubble.tsx`

- [ ] **Step 1: Add `onForward?` to the Props interface** (around line 30)

```ts
interface Props {
  message:            MessageWithSender
  isOwn:              boolean
  showSenderInfo:     boolean
  prevMessage?:       MessageWithSender | null
  onReply?:           () => void
  onForward?:         () => void   // ← add this
  onOpenThread?:      () => void
  onScrollToMessage?: (messageId: string) => void
  members:            RoomListItem['members']
  currentUserId:      string
  isGroup:            boolean
  searchQuery?:       string
  isCurrentResult?:   boolean
}
```

- [ ] **Step 2: Destructure `onForward` in the function signature** (line 61)

```ts
export function MessageBubble({ message, isOwn, showSenderInfo, prevMessage, onReply, onForward, onOpenThread, onScrollToMessage, members, currentUserId, isGroup, searchQuery = '', isCurrentResult = false }: Props) {
```

- [ ] **Step 3: Add `Share2` to lucide import** (line 7)

```ts
import { Mic, AlertCircle, Clock, ClipboardCheck, CheckCheck, ChevronDown, ScanText, MessageSquare, Smile, Share2 } from 'lucide-react'
```

- [ ] **Step 4: Pass `onForward` to MobileMessageSheet**

Find where `<MobileMessageSheet` is rendered (around line where `sheetOpen` is used) and add the prop:

```tsx
        <MobileMessageSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          isOwn={isOwn}
          canEdit={canEdit}
          needsResponse={message.needs_response ?? false}
          responseReceived={message.response_received ?? false}
          onCopy={handleCopy}
          onCreateTask={() => setTaskOpen(true)}
          onOpenThread={onOpenThread}
          onMarkFollowup={isOwn ? handleMarkFollowup : undefined}
          onUnmarkRequest={isOwn ? handleUnmarkRequest : undefined}
          onMarkReceived={isOwn && (message.needs_response ?? false) ? handleMarkReceived : undefined}
          onEdit={isOwn ? () => setEditing(true) : undefined}
          onDelete={isOwn ? () => setDeleteOpen(true) : undefined}
          onReact={handleReact}
          onReply={onReply}
          onForward={onForward}
        />
```

- [ ] **Step 5: Pass `onForward` to MessageMenu (desktop)**

Find the `<MessageMenu` render and add `onForward={onForward}`.

- [ ] **Step 6: Add "forwarded" label above the bubble**

In the JSX `<div className="flex flex-col max-w-[85%]...">` block, add before the sender name span:

```tsx
        {/* 전달됨 라벨 */}
        {message.forwarded_from_user_name && (
          <div className="flex items-center gap-1 mb-0.5 ml-1" style={{ color: 'var(--ink-4)', fontSize: 11 }}>
            <Share2 size={10} />
            <span>{t('forwardedFrom', { name: message.forwarded_from_user_name })}</span>
          </div>
        )}
```

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/components/chat/MessageBubble.tsx
git commit -m "feat(forward): MessageBubble — onForward prop + forwarded_from label"
```

---

## Task 5: forwardMessage business logic

**Files:**
- Create: `src/lib/forwardMessage.ts`

- [ ] **Step 1: Create `src/lib/forwardMessage.ts`**

```ts
import { supabase } from './supabase'
import type { MessageWithSender } from '../types/chat'

export async function forwardMessage(
  original: MessageWithSender,
  targetRoomIds: string[],
  currentUserId: string,
): Promise<{ success: number; failed: number }> {
  // Preserve original author chain — if already forwarded, keep the root author
  const fromUserId   = original.forwarded_from_user_id   ?? original.sender_id
  const fromUserName = original.forwarded_from_user_name ?? original.sender?.name ?? ''
  const rootMsgId    = original.forwarded_from_message_id ?? original.id

  // Insert one message per target room
  const rows = targetRoomIds.map(roomId => ({
    room_id:                    roomId,
    sender_id:                  currentUserId,
    message_type:               original.message_type,
    content:                    original.content,
    content_original:           original.content_original,
    forwarded_from_user_id:     fromUserId,
    forwarded_from_user_name:   fromUserName,
    forwarded_from_message_id:  rootMsgId,
  }))

  const { data: inserted, error } = await supabase
    .from('messages')
    .insert(rows)
    .select('id, room_id')

  if (error) {
    console.error('[forwardMessage]', error)
    return { success: 0, failed: targetRoomIds.length }
  }

  // Copy attachments for each new message (same file_path, no re-upload)
  if (original.attachments.length > 0 && inserted) {
    const attachRows = inserted.flatMap(newMsg => {
      const targetRoom = newMsg.room_id
      return original.attachments.map(att => ({
        message_id:      newMsg.id,
        room_id:         targetRoom,
        uploaded_by:     att.uploaded_by,
        file_name:       att.file_name,
        file_path:       att.file_path,
        file_size:       att.file_size,
        mime_type:       att.mime_type,
        attachment_type: att.attachment_type,
      }))
    })
    if (attachRows.length > 0) {
      const { error: attErr } = await supabase.from('message_attachments').insert(attachRows)
      if (attErr) console.error('[forwardMessage] attachment copy failed', attErr)
    }
  }

  const successCount = inserted?.length ?? 0
  return { success: successCount, failed: targetRoomIds.length - successCount }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/forwardMessage.ts
git commit -m "feat(forward): forwardMessage business logic (text + attachment copy)"
```

---

## Task 6: ForwardSheet component

**Files:**
- Create: `src/components/chat/ForwardSheet.tsx`

- [ ] **Step 1: Create `src/components/chat/ForwardSheet.tsx`**

```tsx
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Share2, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useRoomStore } from '../../stores/roomStore'
import { forwardMessage } from '../../lib/forwardMessage'
import type { MessageWithSender, RoomListItem } from '../../types/chat'

const MAX_SELECT = 5

interface Props {
  message:    MessageWithSender
  currentRoomId: string
  onClose:    () => void
  onSuccess:  (count: number) => void
}

export function ForwardSheet({ message, currentRoomId, onClose, onSuccess }: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const rooms = useRoomStore(s => s.rooms) as RoomListItem[]

  const [query,     setQuery]     = useState('')
  const [selected,  setSelected]  = useState<Set<string>>(new Set())
  const [sending,   setSending]   = useState(false)
  const [limitToast, setLimitToast] = useState(false)

  // PWA back closes sheet
  useEffect(() => {
    window.history.pushState({ forwardSheet: true }, '')
    const onPop = () => onClose()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [onClose])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return rooms
    return rooms.filter(r => (r.name ?? '').toLowerCase().includes(q))
  }, [rooms, query])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= MAX_SELECT) {
          setLimitToast(true)
          setTimeout(() => setLimitToast(false), 2500)
          return prev
        }
        next.add(id)
      }
      return next
    })
  }

  const handleSend = async () => {
    if (!user || selected.size === 0) return
    setSending(true)
    const { success } = await forwardMessage(message, [...selected], user.id)
    setSending(false)
    onSuccess(success)
  }

  const preview = message.content
    ? message.content.slice(0, 80) + (message.content.length > 80 ? '…' : '')
    : message.attachments[0]?.file_name ?? ''

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[59] bg-black/50"
        onClick={onClose}
      />

      {/* Sheet / Modal */}
      <div
        className="fixed z-[60] flex flex-col
          inset-x-0 bottom-0 rounded-t-2xl
          md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
          md:w-[480px] md:h-[640px] md:rounded-2xl"
        style={{ background: 'var(--card)', maxHeight: '85dvh' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 h-14 border-b flex-shrink-0"
          style={{ borderColor: 'var(--line)' }}
        >
          <div className="flex items-center gap-2">
            <Share2 size={16} style={{ color: 'var(--brand)' }} />
            <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
              {t('forwardTitle')}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg"
            style={{ color: 'var(--ink-3)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Message preview */}
        {preview && (
          <div
            className="mx-4 mt-3 px-3 py-2 rounded-xl text-xs border flex-shrink-0 truncate"
            style={{ background: 'var(--chat-bg)', borderColor: 'var(--line)', color: 'var(--ink-3)' }}
          >
            {preview}
          </div>
        )}

        {/* Search */}
        <div className="px-4 py-2 flex-shrink-0">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl border"
            style={{ background: 'var(--chat-bg)', borderColor: 'var(--line)' }}
          >
            <Search size={14} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('forwardSearch')}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--ink)' }}
            />
          </div>
        </div>

        {/* Room list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-sm" style={{ color: 'var(--ink-4)' }}>
              {t('forwardNoResults')}
            </div>
          ) : (
            filtered.map(room => {
              const isCurrent = room.id === currentRoomId
              const isSelected = selected.has(room.id)
              const name = room.name ?? '—'
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => toggle(room.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                  style={{ background: isSelected ? 'var(--blue-soft)' : 'transparent' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  {/* Checkbox */}
                  <div
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      background: isSelected ? 'var(--brand)' : 'transparent',
                      borderColor: isSelected ? 'var(--brand)' : 'var(--ink-3)',
                    }}
                  >
                    {isSelected && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>

                  <span className="flex-1 text-sm truncate" style={{ color: 'var(--ink)' }}>{name}</span>

                  {isCurrent && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--blue-soft)', color: 'var(--brand)' }}
                    >
                      {t('forwardCurrentRoom')}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* CTA */}
        <div
          className="flex-shrink-0 p-4 border-t"
          style={{ borderColor: 'var(--line)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={selected.size === 0 || sending}
            className="w-full py-3 rounded-2xl text-sm font-semibold text-white transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--brand)' }}
          >
            {sending
              ? '…'
              : selected.size > 0
                ? t('forwardSendCount', { count: selected.size })
                : t('forwardSend')}
          </button>
        </div>

        {/* Max-limit toast */}
        {limitToast && (
          <div
            className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-xs font-medium text-white pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.75)' }}
          >
            {t('forwardMaxLimit')}
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/ForwardSheet.tsx
git commit -m "feat(forward): ForwardSheet — room picker bottom sheet / desktop modal"
```

---

## Task 7: MessageList — thread onForward prop

**Files:**
- Modify: `src/components/chat/MessageList.tsx`

- [ ] **Step 1: Add `onForward?` to the `Props` interface** (around line 9)

```ts
interface Props {
  messages:          MessageWithSender[]
  loading:           boolean
  hasMore:           boolean
  currentUserId:     string
  isGroupRoom:       boolean
  members:           RoomListItem['members']
  onLoadMore:        () => void
  onOpenThread?:     (messageId: string) => void
  onScrollToMessage: (messageId: string) => void
  onReply?:          (msg: MessageWithSender) => void
  onForward?:        (msg: MessageWithSender) => void   // ← add
  searchQuery?:      string
  currentResultId?:  string | null
  roomId?:           string
  isBotTyping?:      boolean
}
```

- [ ] **Step 2: Destructure `onForward` in the function signature**

```ts
export function MessageList({ messages, loading, hasMore, currentUserId, isGroupRoom, members, onLoadMore, onOpenThread, onScrollToMessage, onReply, onForward, searchQuery = '', currentResultId = null, roomId, isBotTyping = false }: Props) {
```

- [ ] **Step 3: Pass `onForward` to `MessageBubble`** (around line 127)

```tsx
              <MessageBubble
                message={msg}
                isOwn={msg.sender_id === currentUserId}
                showSenderInfo={isGroupRoom}
                prevMessage={prev}
                onReply={onReply ? () => onReply(msg) : undefined}
                onForward={onForward ? () => onForward(msg) : undefined}
                onOpenThread={onOpenThread ? () => onOpenThread(msg.id) : undefined}
                onScrollToMessage={onScrollToMessage}
                members={members}
                currentUserId={currentUserId}
                isGroup={isGroupRoom}
                searchQuery={searchQuery}
                isCurrentResult={msg.id === currentResultId}
              />
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/MessageList.tsx
git commit -m "feat(forward): MessageList passes onForward down to MessageBubble"
```

---

## Task 8: ChatWindow — state + ForwardSheet render

**Files:**
- Modify: `src/components/layout/ChatWindow.tsx`

- [ ] **Step 1: Import `ForwardSheet`**

Add to imports:

```ts
import { ForwardSheet } from '../chat/ForwardSheet'
```

- [ ] **Step 2: Add `forwardTarget` state** (after the `replyTo` state, around line 66)

```ts
const [forwardTarget, setForwardTarget] = useState<MessageWithSender | null>(null)
```

- [ ] **Step 3: Reset `forwardTarget` on room change** — add to the cleanup `useEffect` that already resets `replyTo` (around line 100):

```ts
    setForwardTarget(null)
```

- [ ] **Step 4: Add `handleForward` callback** (after `handleReply`):

```ts
const handleForward = useCallback((msg: MessageWithSender) => {
  setForwardTarget(msg)
}, [])
```

- [ ] **Step 5: Pass `onForward` to `MessageList`** — find the `<MessageList` render (around line 353) and add:

```tsx
                onForward={handleForward}
```

- [ ] **Step 6: Add the success toast helper** — find where other toasts are shown; add a local state:

```ts
const [forwardToast, setForwardToast] = useState<string | null>(null)
```

And a small `useEffect` auto-dismiss:

```ts
useEffect(() => {
  if (!forwardToast) return
  const tid = setTimeout(() => setForwardToast(null), 3000)
  return () => clearTimeout(tid)
}, [forwardToast])
```

- [ ] **Step 7: Render `ForwardSheet`** — add before the closing `</>` of the ChatWindow JSX return:

```tsx
      {forwardTarget && roomId && (
        <ForwardSheet
          message={forwardTarget}
          currentRoomId={roomId}
          onClose={() => setForwardTarget(null)}
          onSuccess={count => {
            setForwardTarget(null)
            setForwardToast(t('forwardSuccess', { count }))
          }}
        />
      )}

      {forwardToast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70]
                     px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.8)' }}
        >
          {forwardToast}
        </div>
      )}
```

- [ ] **Step 8: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 9: Build**

```bash
npm run build
```

Expected: build succeeds (chunk-size warnings are OK, errors are not).

- [ ] **Step 10: Commit + push**

```bash
git add src/components/layout/ChatWindow.tsx
git commit -m "feat(forward): ChatWindow — forwardTarget state + ForwardSheet render"
git push
```

---

## Task 9: Final build + tag + deploy

- [ ] **Step 1: Full type-check + build**

```bash
npx tsc --noEmit && npm run build
```

Expected: `✓ built in Xs` with no TypeScript errors.

- [ ] **Step 2: Tag + push**

```bash
git tag v2.6
git push origin main --tags
```

Vercel auto-deploys on push to `main`. Build completes in ~1-2 min.

- [ ] **Step 3: Smoke-test on https://mtl-link.vercel.app**

Desktop:
- Open any chat → hover a message → click the chevron (▾) menu → Forward item visible
- Click Forward → ForwardSheet opens as centered modal
- Select 1-2 rooms → click Forward → toast appears
- Open one of the target rooms → message shows "Forwarded from [name]" label

Mobile (or DevTools mobile emulation):
- Long-press a message (≥500ms) → MobileMessageSheet opens → Forward item visible
- Tap Forward → ForwardSheet opens as bottom sheet

---

## Self-Review Notes

**Spec coverage check:**
- ✅ DB schema 3 columns — Task 1
- ✅ TypeScript types — Task 1
- ✅ useLongPress — already exists, no new code needed
- ✅ Right-click (desktop) — handled by existing `MessageMenu` which uses the `onContextMenu → e.preventDefault()` + chevron button pattern, no separate handler needed
- ✅ Forward item in menus — Task 3
- ✅ ForwardSheet (mobile bottom sheet + desktop modal, responsive) — Task 6
- ✅ Multi-select max 5 + toast — Task 6
- ✅ Room search debounce — filtered by `useMemo` on query (sufficient; real debounce only matters for network calls, not local filter)
- ✅ "Forwarded from" label — Task 4
- ✅ Chain preservation (re-forwarding keeps root author) — Task 5
- ✅ Attachment copy (file_path re-use, no re-upload) — Task 5
- ✅ i18n 6 languages — Task 2
- ✅ PWA back closes sheet — Task 6 (useEffect with popstate)
- ✅ Success toast — Task 8
- ✅ Current room badge — Task 6
- ✅ Build + deploy + tag — Task 9
- ⚠️ **DB migration must be run manually in Supabase SQL Editor before deploying** — code will TypeScript-error-free but runtime inserts will fail until columns exist

**Type consistency check:**
- `forwardMessage(original, targetRoomIds, currentUserId)` — used in `ForwardSheet` with those exact args ✓
- `forwarded_from_user_name` referenced in `MessageBubble` display and `forwardMessage` insert ✓
- `onForward?: () => void` flows: `MessageActions` → `MessageMenu` / `MobileMessageSheet` → `MessageBubble` → `MessageList` → `ChatWindow` ✓
- `ForwardSheet` props: `{ message, currentRoomId, onClose, onSuccess }` — matches usage in `ChatWindow` ✓
