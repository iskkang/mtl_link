# MINT 아침 브리핑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a daily KST 08:30 briefing card in each user's MINT DM room, analysing the past 24h of their messages via GPT-4o-mini into 4 categories, with 6-language output and 👍/👎 feedback.

**Architecture:** Four SQL migrations extend the schema; a new `daily-briefing` Edge Function runs on pg_cron at UTC 23:30 and writes `mint_briefing` messages with JSONB payloads; `BriefingCard.tsx` renders those payloads and uses a lightweight `chatEvents` bus to jump back to source messages.

**Tech Stack:** Supabase (PostgreSQL, Edge Functions/Deno, pg_cron, pg_net), GPT-4o-mini (`response_format: json_object`), React + Tailwind + Lucide React, react-i18next.

**Spec:** `docs/superpowers/specs/2026-05-13-mint-daily-briefing-design.md`

---

## File Map

| Action | Path |
|--------|------|
| Create | `supabase/migrations/20260513000000_rooms_mint_dm.sql` |
| Create | `supabase/migrations/20260513000001_messages_mint_briefing_payload.sql` |
| Create | `supabase/migrations/20260513000002_ai_briefings.sql` |
| Create | `supabase/migrations/20260513000003_bot_rename_rpc.sql` |
| Modify | `src/types/database.ts` lines 208, 232, 256 — add `'mint_briefing'` and `payload` field |
| Modify | `src/lib/i18n.ts` lines 709, 1336, 1963, 2590, 3218, 3846 — add 8 briefing keys per language |
| Modify | `src/lib/aiEvents.ts` — add `chatEvents` export |
| Modify | `src/pages/ChatPage.tsx` — subscribe to `chatEvents.onNavigateToMessage` |
| Modify | `src/components/ui/Avatar.tsx` — render SVG image when `is_bot && avatarUrl` |
| Create | `src/components/mint/BriefingCard.tsx` |
| Modify | `src/components/chat/MessageBubble.tsx` — mint_briefing early-return branch |
| Create | `supabase/functions/daily-briefing/locales.ts` |
| Create | `supabase/functions/daily-briefing/index.ts` |

---

## Task 1: Migration — rooms mint_dm type

**Files:**
- Create: `supabase/migrations/20260513000000_rooms_mint_dm.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260513000000_rooms_mint_dm.sql
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_room_type_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_room_type_check
  CHECK (room_type IN ('direct', 'group', 'channel', 'mint_dm'));

ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS group_room_name_required;
ALTER TABLE public.rooms ADD CONSTRAINT group_room_name_required CHECK (
  (room_type IN ('group', 'channel') AND name IS NOT NULL AND length(trim(name)) > 0)
  OR room_type IN ('direct', 'mint_dm')
);
```

- [ ] **Step 2: Run in Supabase Dashboard → SQL Editor**

Expected: `ALTER TABLE` success, no errors.

Verify:
```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name IN ('rooms_room_type_check', 'group_room_name_required');
```

Expected: both rows returned, `mint_dm` visible in the check clause.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260513000000_rooms_mint_dm.sql
git commit -m "feat(db): add mint_dm room_type to rooms constraint"
```

---

## Task 2: Migration — messages mint_briefing type + payload column

**Files:**
- Create: `supabase/migrations/20260513000001_messages_mint_briefing_payload.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260513000001_messages_mint_briefing_payload.sql
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN (
    'text', 'image', 'file', 'link',
    'system', 'voice_translated', 'text_translated', 'mint_briefing'
  ));

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS payload JSONB;
```

- [ ] **Step 2: Run in Supabase Dashboard → SQL Editor**

Expected: `ALTER TABLE` success twice.

Verify:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'messages' AND column_name = 'payload';
```

Expected: one row — `payload`, `jsonb`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260513000001_messages_mint_briefing_payload.sql
git commit -m "feat(db): add mint_briefing message_type and payload JSONB column"
```

---

## Task 3: Migration — ai_briefings table

**Files:**
- Create: `supabase/migrations/20260513000002_ai_briefings.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260513000002_ai_briefings.sql
CREATE TABLE IF NOT EXISTS public.ai_briefings (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  briefing_date        DATE        NOT NULL,
  items                JSONB       NOT NULL DEFAULT '[]'::jsonb,
  message_count        INT         DEFAULT 0,
  model                TEXT        DEFAULT 'gpt-4o-mini',
  tokens_used          INT,
  generated_at         TIMESTAMPTZ DEFAULT NOW(),
  delivered_at         TIMESTAMPTZ,
  delivered_message_id UUID,
  feedback_score       INT,
  feedback_at          TIMESTAMPTZ,
  CONSTRAINT unique_user_date UNIQUE (user_id, briefing_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_briefings_user_date
  ON ai_briefings(user_id, briefing_date DESC);

ALTER TABLE ai_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own briefings"
  ON ai_briefings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
  ON ai_briefings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: Run in Supabase Dashboard → SQL Editor**

Verify:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name = 'ai_briefings';
```

Expected: one row.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260513000002_ai_briefings.sql
git commit -m "feat(db): create ai_briefings table with RLS"
```

---

## Task 4: Migration — bot rename + get_user_related_messages RPC

**Files:**
- Create: `supabase/migrations/20260513000003_bot_rename_rpc.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260513000003_bot_rename_rpc.sql

-- Rename bot and set MINT avatar
UPDATE public.profiles
SET
  name       = 'MINT',
  avatar_url = '/mint-logo-avatar.svg'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- RPC: collect messages the user is permitted to see
CREATE OR REPLACE FUNCTION get_user_related_messages(
  p_user_id UUID,
  p_since   TIMESTAMPTZ,
  p_limit   INT DEFAULT 200
)
RETURNS TABLE (
  id          UUID,
  room_id     UUID,
  room_name   TEXT,
  sender_id   UUID,
  sender_name TEXT,
  content     TEXT,
  created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.room_id,
    r.name     AS room_name,
    m.sender_id,
    p.name     AS sender_name,
    m.content,
    m.created_at
  FROM messages m
  JOIN rooms    r ON r.id = m.room_id
  JOIN profiles p ON p.id = m.sender_id
  WHERE m.created_at >= p_since
    AND m.message_type = 'text'
    AND m.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM room_members rm
      WHERE rm.room_id = m.room_id AND rm.user_id = p_user_id
    )
    AND p.is_bot = FALSE
  ORDER BY m.created_at DESC
  LIMIT p_limit;
END;
$$;
```

- [ ] **Step 2: Run in Supabase Dashboard → SQL Editor**

Verify bot rename:
```sql
SELECT name, avatar_url FROM profiles
WHERE id = '00000000-0000-0000-0000-000000000001';
```

Expected: `name = 'MINT'`, `avatar_url = '/mint-logo-avatar.svg'`.

Verify RPC exists:
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'get_user_related_messages';
```

Expected: one row.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260513000003_bot_rename_rpc.sql
git commit -m "feat(db): rename bot to MINT, add get_user_related_messages RPC"
```

---

## Task 5: TypeScript types — add mint_briefing and payload

**Files:**
- Modify: `src/types/database.ts` lines 208, 232, 256

- [ ] **Step 1: Update Row type (line 208)**

Find:
```ts
          message_type:         'text' | 'image' | 'file' | 'link' | 'system' | 'voice_translated' | 'text_translated'
          content:              string | null
```

Replace with:
```ts
          message_type:         'text' | 'image' | 'file' | 'link' | 'system' | 'voice_translated' | 'text_translated' | 'mint_briefing'
          content:              string | null
          payload:              Json | null
```

- [ ] **Step 2: Update Insert type (line 232)**

Find:
```ts
          message_type?:         'text' | 'image' | 'file' | 'link' | 'system' | 'voice_translated' | 'text_translated'
          content?:              string | null
```

Replace with:
```ts
          message_type?:         'text' | 'image' | 'file' | 'link' | 'system' | 'voice_translated' | 'text_translated' | 'mint_briefing'
          content?:              string | null
          payload?:              Json | null
```

- [ ] **Step 3: Update Update type (line 256)**

Find:
```ts
          message_type?:         'text' | 'image' | 'file' | 'link' | 'system' | 'voice_translated' | 'text_translated'
          content?:              string | null
```

Replace with:
```ts
          message_type?:         'text' | 'image' | 'file' | 'link' | 'system' | 'voice_translated' | 'text_translated' | 'mint_briefing'
          content?:              string | null
          payload?:              Json | null
```

- [ ] **Step 4: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(types): add mint_briefing message_type and payload field"
```

---

## Task 6: i18n — add briefing keys to all 6 languages

**Files:**
- Modify: `src/lib/i18n.ts`

Do all 6 edits in one pass. Insert the block **after** the `learnHow:` line in each language section.

**Note:** i18next `keySeparator` defaults to `.`, so dot-notation flat keys like `'briefing.category.deadline'` would be misinterpreted as nested paths. Use camelCase keys instead. `BriefingCard` uses a static lookup map to get the right key per category.

- [ ] **Step 1: ko block (after line 709)**

After `learnHow: '방법 보기',` add:
```ts
      // ── MINT 브리핑 ─────────────────────────────────────────────────────────
      briefingDeadline:  '마감',
      briefingAction:    '할일',
      briefingPending:   '회신 대기',
      briefingAlert:     '리스크',
      briefingViewChat:  '채팅 보기',
      briefingViewAll:   '전체 일정 보기',
      briefingPrivacy:   '본인 관련 메시지(DM·멘션·본인 발신)만 분석합니다',
      briefingLearnMore: '자세히',
```

- [ ] **Step 2: en block (after line 1336)**

After `learnHow: 'Learn how',` add:
```ts
      // ── MINT Briefing ────────────────────────────────────────────────────────
      briefingDeadline:  'Deadline',
      briefingAction:    'Action',
      briefingPending:   'Pending',
      briefingAlert:     'Alert',
      briefingViewChat:  'View chat',
      briefingViewAll:   'View all',
      briefingPrivacy:   'Only your accessible messages are analyzed',
      briefingLearnMore: 'Learn more',
```

- [ ] **Step 3: ru block (after line 1963)**

After `learnHow: 'Как это сделать',` add:
```ts
      // ── MINT брифинг ─────────────────────────────────────────────────────────
      briefingDeadline:  'Срок',
      briefingAction:    'Задача',
      briefingPending:   'Ожидание',
      briefingAlert:     'Риск',
      briefingViewChat:  'Открыть',
      briefingViewAll:   'Все события',
      briefingPrivacy:   'Анализируются только ваши сообщения',
      briefingLearnMore: 'Подробнее',
```

- [ ] **Step 4: uz block (after line 2590)**

After `learnHow: 'Qanday qilish',` add:
```ts
      // ── MINT brifing ─────────────────────────────────────────────────────────
      briefingDeadline:  'Muddat',
      briefingAction:    'Vazifa',
      briefingPending:   'Kutilmoqda',
      briefingAlert:     'Xavf',
      briefingViewChat:  "Chatni ko'rish",
      briefingViewAll:   "Hammasini ko'rish",
      briefingPrivacy:   'Faqat siz kira oladigan xabarlar tahlil qilinadi',
      briefingLearnMore: 'Batafsil',
```

- [ ] **Step 5: zh block (after line 3218)**

After `learnHow: '查看方法',` add:
```ts
      // ── MINT 简报 ────────────────────────────────────────────────────────────
      briefingDeadline:  '截止',
      briefingAction:    '待办',
      briefingPending:   '等待回复',
      briefingAlert:     '风险',
      briefingViewChat:  '查看聊天',
      briefingViewAll:   '查看全部',
      briefingPrivacy:   '仅分析您可访问的消息',
      briefingLearnMore: '详情',
```

- [ ] **Step 6: ja block (after line 3846)**

After `learnHow: '方法を見る',` add:
```ts
      // ── MINT ブリーフィング ─────────────────────────────────────────────────
      briefingDeadline:  '締切',
      briefingAction:    'やること',
      briefingPending:   '返信待ち',
      briefingAlert:     'リスク',
      briefingViewChat:  'チャットを見る',
      briefingViewAll:   'すべて見る',
      briefingPrivacy:   '自分宛のメッセージのみ分析します',
      briefingLearnMore: '詳細',
```

- [ ] **Step 7: Verify typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/i18n.ts
git commit -m "feat(i18n): add briefing category and UI keys for 6 languages"
```

---

## Task 7: chatEvents — add navigateToMessage event + subscribe in ChatPage

**Files:**
- Modify: `src/lib/aiEvents.ts`
- Modify: `src/pages/ChatPage.tsx`

- [ ] **Step 1: Extend aiEvents.ts**

Append to the bottom of `src/lib/aiEvents.ts` (after the existing `aiEvents` export):

```ts
type NavigateToMessageHandler = (roomId: string, messageId: string) => void
const navigateToMessageHandlers = new Set<NavigateToMessageHandler>()

export const chatEvents = {
  onNavigateToMessage: (fn: NavigateToMessageHandler) => {
    navigateToMessageHandlers.add(fn)
    return () => { navigateToMessageHandlers.delete(fn) }
  },
  emitNavigateToMessage: (roomId: string, messageId: string) =>
    navigateToMessageHandlers.forEach(fn => fn(roomId, messageId)),
}
```

- [ ] **Step 2: Subscribe in ChatPage.tsx**

In `src/pages/ChatPage.tsx`, add the import at the top alongside the existing `aiEvents` import:

Find:
```ts
import { aiEvents }           from '../lib/aiEvents'
```

Replace with:
```ts
import { aiEvents, chatEvents } from '../lib/aiEvents'
```

Then add the subscription `useEffect` immediately after the existing `aiEvents.onNavigate` subscription (around line 83). Place it after the closing `}, [activeSection])` of that effect:

```ts
  useEffect(() => {
    return chatEvents.onNavigateToMessage((roomId, messageId) => {
      setSelectedRoomId(roomId)
      setShowChat(true)
      setHighlightMessageId(messageId)
      setActiveSection('chat')
    })
  }, [])
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/aiEvents.ts src/pages/ChatPage.tsx
git commit -m "feat(events): add chatEvents.navigateToMessage for cross-room jump"
```

---

## Task 8: Avatar — render MINT SVG when bot has avatarUrl

**Files:**
- Modify: `src/components/ui/Avatar.tsx`

The current `is_bot` branch shows a generic `<Bot>` icon. After migration 4 sets `avatar_url = '/mint-logo-avatar.svg'` the Avatar should show the SVG in a mint-tinted squircle.

- [ ] **Step 1: Update Avatar.tsx**

Find the `is_bot` branch:
```tsx
  if (is_bot) {
    return (
      <div
        className={`${sizeClass} rounded-full flex items-center justify-center flex-shrink-0 ${className}`}
        style={{ background: 'var(--blue-soft)', color: 'var(--brand)' }}
      >
        <Bot size={size === 'xs' ? 12 : size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
      </div>
    )
  }
```

Replace with:
```tsx
  if (is_bot) {
    if (avatarUrl) {
      const imgSize = size === 'xs' ? 'w-4 h-4' : size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-8 h-8' : 'w-7 h-7'
      return (
        <div
          className={`${sizeClass} rounded-lg flex items-center justify-center flex-shrink-0 border ${className}`}
          style={{ background: '#f0fdfa', borderColor: '#ccfbf1' }}
        >
          <img src={avatarUrl} alt={name} className={imgSize} />
        </div>
      )
    }
    return (
      <div
        className={`${sizeClass} rounded-full flex items-center justify-center flex-shrink-0 ${className}`}
        style={{ background: 'var(--blue-soft)', color: 'var(--brand)' }}
      >
        <Bot size={size === 'xs' ? 12 : size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
      </div>
    )
  }
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Manual visual check**

Start dev server (`npm run dev`) and open the MINT DM room. The bot avatar in the message list should now show the MINT SVG leaf in a mint-tinted squircle, not the generic `<Bot>` icon.

If migration 4 hasn't been applied yet, you can test by temporarily calling the Avatar component directly in browser devtools or by mocking the sender.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Avatar.tsx
git commit -m "feat(avatar): render SVG image for bot when avatar_url is set"
```

---

## Task 9: BriefingCard component

**Files:**
- Create: `src/components/mint/BriefingCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/mint/BriefingCard.tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Clock, ClipboardCheck, HelpCircle, AlertTriangle,
  ArrowRight, ThumbsUp, ThumbsDown,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { chatEvents } from '../../lib/aiEvents'

interface BriefingItem {
  category: 'deadline' | 'action' | 'pending' | 'alert'
  title: string
  description: string
  source_message_id: string | null
  source_room_id: string | null
  source_room_name: string | null
  due_at: string | null
  priority: 'high' | 'medium' | 'low'
}

export interface BriefingPayload {
  briefing_id: string
  locale: string
  greeting: string
  summary: string
  message_count: number
  items: BriefingItem[]
}

const CATEGORY_CONFIG = {
  deadline: { bg: '#FCEBEB', fg: '#A32D2D', Icon: Clock,          i18nKey: 'briefingDeadline' },
  action:   { bg: '#E6F1FB', fg: '#0C447C', Icon: ClipboardCheck, i18nKey: 'briefingAction'   },
  pending:  { bg: '#FEF3C7', fg: '#92400E', Icon: HelpCircle,     i18nKey: 'briefingPending'  },
  alert:    { bg: '#FEE2E2', fg: '#991B1B', Icon: AlertTriangle,  i18nKey: 'briefingAlert'    },
} as const

function formatDueAt(iso: string): string {
  const date  = new Date(iso)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}까지`
  }
  return `${date.getMonth() + 1}/${date.getDate()}까지`
}

export function BriefingCard({ payload }: { payload: BriefingPayload }) {
  const { t } = useTranslation()
  const [feedback, setFeedback] = useState<1 | -1 | null>(null)

  const handleViewChat = (item: BriefingItem) => {
    if (!item.source_room_id || !item.source_message_id) return
    chatEvents.emitNavigateToMessage(item.source_room_id, item.source_message_id)
  }

  const handleFeedback = async (score: 1 | -1) => {
    if (feedback !== null) return
    setFeedback(score)
    await supabase
      .from('ai_briefings')
      .update({ feedback_score: score, feedback_at: new Date().toISOString() })
      .eq('id', payload.briefing_id)
  }

  return (
    <div className="max-w-[540px]">
      <div className="text-[14px] text-[#0f172a] leading-[1.5] mb-1 font-medium">
        {payload.greeting}
      </div>
      <div className="text-[12px] text-[#64748b] mb-[14px]">
        {payload.summary}
      </div>

      <div className="flex flex-col gap-2">
        {payload.items.map((item, idx) => {
          const cfg = CATEGORY_CONFIG[item.category]
          const borderClass = item.category === 'alert' ? 'border-red-200' : 'border-black/[0.08]'

          return (
            <div
              key={idx}
              onClick={() => handleViewChat(item)}
              className={`bg-white border-[0.5px] ${borderClass} rounded-[10px] p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow`}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                  style={{ background: cfg.bg, color: cfg.fg }}
                >
                  <cfg.Icon size={11} />
                  {t(cfg.i18nKey)}
                </span>
                {item.due_at && (
                  <span className="text-[11px] font-medium" style={{ color: cfg.fg }}>
                    {formatDueAt(item.due_at)}
                  </span>
                )}
              </div>
              <div className="text-[13px] font-medium text-[#0f172a] mb-1">
                {item.title}
              </div>
              <div className="text-[12px] text-[#64748b] mb-2.5 leading-[1.5]">
                {item.description}
              </div>
              {item.source_room_id && item.source_message_id && (
                <span className="inline-flex items-center gap-1 text-[11px] text-[#0d9488] font-medium">
                  {t('briefingViewChat')}
                  <ArrowRight size={12} />
                </span>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-[14px] pt-3 border-t border-black/[0.08] flex justify-between items-center">
        <button
          disabled
          className="inline-flex items-center gap-1 text-[12px] text-[#94a3b8] font-medium cursor-not-allowed"
        >
          {t('briefingViewAll')}
          <ArrowRight size={12} />
        </button>
        <div className="flex gap-1.5">
          <button
            onClick={() => handleFeedback(1)}
            disabled={feedback !== null}
            className={`w-6 h-6 flex items-center justify-center border-[0.5px] border-[#ccfbf1] rounded-md transition-colors ${
              feedback === 1 ? 'bg-[#f0fdfa] text-[#0d9488]' : 'text-[#64748b] hover:text-[#0d9488]'
            }`}
            aria-label="유용했어요"
          >
            <ThumbsUp size={13} />
          </button>
          <button
            onClick={() => handleFeedback(-1)}
            disabled={feedback !== null}
            className={`w-6 h-6 flex items-center justify-center border-[0.5px] border-[#ccfbf1] rounded-md transition-colors ${
              feedback === -1 ? 'bg-red-50 text-red-600' : 'text-[#64748b] hover:text-red-600'
            }`}
            aria-label="별로였어요"
          >
            <ThumbsDown size={13} />
          </button>
        </div>
      </div>

      <div className="text-[10px] text-[#94a3b8] mt-2.5 text-center leading-[1.5]">
        {t('briefingPrivacy')}
        {' · '}
        <button className="text-[#0d9488] hover:underline">
          {t('briefingLearnMore')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/mint/BriefingCard.tsx
git commit -m "feat(mint): add BriefingCard component with 4-category layout"
```

---

## Task 10: MessageBubble — mint_briefing branch

**Files:**
- Modify: `src/components/chat/MessageBubble.tsx`

- [ ] **Step 1: Add import**

Find the existing imports at the top of `MessageBubble.tsx`. After the last import line, add:

```tsx
import { BriefingCard, type BriefingPayload } from '../mint/BriefingCard'
```

- [ ] **Step 2: Add early return for mint_briefing**

Find the line (around line 221) that reads:

```tsx
  return (
    <div
      className={`flex items-end gap-2 px-2 md:px-3 ${isContinuation ? 'mb-0.5' : 'mb-2'} ${isOwn ? 'flex-row-reverse' : 'flex-row'} message-bubble-row`}
```

Insert the following block immediately **before** that `return (`:

```tsx
  if (message.message_type === 'mint_briefing' && message.payload) {
    return (
      <div className={`flex items-end gap-2 px-2 md:px-3 ${isContinuation ? 'mb-0.5' : 'mb-2'}`}>
        <div className="w-9 flex-shrink-0 self-end mb-0.5">
          {!isContinuation && (
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center border"
              style={{ background: '#f0fdfa', borderColor: '#ccfbf1' }}
            >
              <img src="/mint-logo-avatar.svg" alt="MINT" className="w-7 h-7" />
            </div>
          )}
        </div>
        <div className="flex flex-col items-start">
          {!isContinuation && (
            <span className="text-[11px] font-semibold mb-1 ml-1 flex items-center gap-1" style={{ color: 'var(--brand)' }}>
              MINT
              <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: 'var(--brand)', color: 'white', lineHeight: 1 }}>
                AI
              </span>
            </span>
          )}
          <BriefingCard payload={message.payload as unknown as BriefingPayload} />
        </div>
      </div>
    )
  }
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Smoke-test in browser**

Start dev server (`npm run dev`). Open any MINT DM room. To see the card without running the Edge Function, paste this in the browser console to insert a fake `mint_briefing` message into local state (or use Supabase Dashboard to INSERT a test row):

```sql
-- Supabase Dashboard → SQL Editor (replace <your_user_id> and <mint_dm_room_id>)
INSERT INTO messages (room_id, sender_id, message_type, content, payload)
VALUES (
  '<mint_dm_room_id>',
  '00000000-0000-0000-0000-000000000001',
  'mint_briefing',
  '테스트 브리핑입니다.',
  '{
    "briefing_id": "00000000-0000-0000-0000-000000000999",
    "locale": "ko",
    "greeting": "홍길동님, 오늘의 브리핑입니다.",
    "summary": "지난 24시간 동안 메시지 12개를 분석했어요. 중요한 2가지를 추려봤습니다.",
    "message_count": 12,
    "items": [
      {
        "category": "deadline",
        "title": "B/L 제출 마감",
        "description": "김철수님이 오늘 18시까지 제출 요청.",
        "source_message_id": null,
        "source_room_id": null,
        "source_room_name": "운영팀",
        "due_at": null,
        "priority": "high"
      },
      {
        "category": "action",
        "title": "운임 확인 요청",
        "description": "파트너사에서 FCL 운임 견적 요청. 답장 필요.",
        "source_message_id": null,
        "source_room_id": null,
        "source_room_name": "영업팀",
        "due_at": null,
        "priority": "medium"
      }
    ]
  }'::jsonb
);
```

Expected: BriefingCard renders in the MINT DM room with two cards — one red "마감" badge and one blue "할일" badge.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/MessageBubble.tsx
git commit -m "feat(chat): render BriefingCard for mint_briefing messages"
```

---

## Task 11: Edge Function — locales.ts

**Files:**
- Create: `supabase/functions/daily-briefing/locales.ts`

- [ ] **Step 1: Create the file**

```ts
// supabase/functions/daily-briefing/locales.ts

type Lang = 'ko' | 'en' | 'zh' | 'ja' | 'ru' | 'uz'

interface Locale {
  systemPrompt: string
  greeting: (name: string) => string
  summary: (msgCount: number, itemCount: number) => string
}

const COMMON_RULES = `당신은 MTL Shipping Agency 직원의 일일 브리핑 비서.

다음은 직원이 지난 24시간 동안 주고받은 메시지입니다.
물류·해운·통관 도메인 관점에서 다음 4가지 카테고리로 항목을 추출하세요:

1. deadline — 시한이 명시되거나 임박한 사항 (예: "오늘 18시까지", "5/15 마감")
2. action — 본인이 해야 할 구체적 일 (예: "WJ에게 사진 요청", "P/L 작성")
3. pending — 다른 사람의 회신을 기다리는 사항 (예: "운임 회신 대기 3일째")
4. alert — 통관/선적/운임 리스크 신호 (예: "통관 지연 가능성", "선적 일정 변경")

규칙:
- 메시지 ID, 채팅방 ID/이름은 정확히 보존
- 최대 8개 항목. 중요도 순.
- 단순 인사·잡담은 제외
- 이미 완료된 일은 제외
- 본인 발신 메시지에서도 본인이 약속한 일은 action으로 추출

각 항목은 다음 JSON 형식:
{
  "category": "deadline|action|pending|alert",
  "title": "짧고 명확하게 (15자 이내 권장)",
  "description": "1-2문장 설명, 출처 정보 포함",
  "source_message_id": "원본 메시지 UUID",
  "source_room_id": "채팅방 UUID",
  "source_room_name": "채팅방 이름",
  "due_at": "ISO 8601 또는 null",
  "priority": "high|medium|low"
}

전체 응답은 JSON 배열로: { "items": [...] }`

const LOCALES: Record<Lang, Locale> = {
  ko: {
    systemPrompt: COMMON_RULES + '\n\n**모든 출력 텍스트(title, description)는 한국어로 작성하세요.**',
    greeting: (name) => `${name}님, 오늘의 브리핑입니다.`,
    summary: (n, k) => `지난 24시간 동안 메시지 ${n}개를 분석했어요. 중요한 ${k}가지를 추려봤습니다.`,
  },
  en: {
    systemPrompt: COMMON_RULES + '\n\n**Output all text (title, description) in English.**',
    greeting: (name) => `Good morning, ${name}.`,
    summary: (n, k) => `Analyzed ${n} messages from the last 24 hours. Here are the ${k} key items.`,
  },
  zh: {
    systemPrompt: COMMON_RULES + '\n\n**所有输出文本(title, description)请用简体中文。**',
    greeting: (name) => `${name}，早上好。今日简报已送达。`,
    summary: (n, k) => `分析了过去24小时的${n}条消息，整理出${k}个重要事项。`,
  },
  ja: {
    systemPrompt: COMMON_RULES + '\n\n**すべての出力テキスト(title, description)は日本語で書いてください。**',
    greeting: (name) => `${name}さん、今日のブリーフィングです。`,
    summary: (n, k) => `過去24時間のメッセージ${n}件を分析しました。重要な${k}件をまとめました。`,
  },
  ru: {
    systemPrompt: COMMON_RULES + '\n\n**Весь вывод (title, description) на русском языке.**',
    greeting: (name) => `${name}, доброе утро. Ваш сегодняшний брифинг.`,
    summary: (n, k) => `Проанализировал ${n} сообщений за последние 24 часа. Выбрал ${k} важных пунктов.`,
  },
  uz: {
    systemPrompt: COMMON_RULES + "\n\n**Barcha matnni (title, description) o'zbek tilida yozing.**",
    greeting: (name) => `Xayrli tong, ${name}. Bugungi brifing.`,
    summary: (n, k) => `So'nggi 24 soatda ${n} ta xabar tahlil qilindi. ${k} ta muhim element ajratildi.`,
  },
}

export function getLocale(lang: string | null | undefined): Locale {
  const key = ((lang ?? 'ko').toLowerCase()) as Lang
  return LOCALES[key] ?? LOCALES.ko
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/daily-briefing/locales.ts
git commit -m "feat(fn): daily-briefing locale map — 6 languages"
```

---

## Task 12: Edge Function — index.ts

**Files:**
- Create: `supabase/functions/daily-briefing/index.ts`

- [ ] **Step 1: Create the file**

```ts
// supabase/functions/daily-briefing/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getLocale } from './locales.ts'

const BOT_USER_ID = '00000000-0000-0000-0000-000000000001'

interface BriefingItem {
  category: 'deadline' | 'action' | 'pending' | 'alert'
  title: string
  description: string
  source_message_id: string | null
  source_room_id: string | null
  source_room_name: string | null
  due_at: string | null
  priority: 'high' | 'medium' | 'low'
}

interface MessageRow {
  id: string
  room_id: string
  room_name: string
  sender_id: string
  sender_name: string
  content: string
  created_at: string
}

// deno-lint-ignore no-explicit-any
async function getOrCreateMintRoom(db: any, userId: string): Promise<string> {
  const { data: existing } = await db
    .from('room_members')
    .select('room_id, rooms!inner(room_type)')
    .eq('user_id', userId)
    .eq('rooms.room_type', 'mint_dm')
    .maybeSingle() as { data: { room_id: string } | null }

  if (existing?.room_id) return existing.room_id

  const { data: newRoom } = await db
    .from('rooms')
    .insert({ room_type: 'mint_dm' })
    .select()
    .single() as { data: { id: string } }

  await db.from('room_members').insert([
    { room_id: newRoom.id, user_id: userId },
    { room_id: newRoom.id, user_id: BOT_USER_ID },
  ])

  return newRoom.id
}

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const openaiKey   = Deno.env.get('OPENAI_API_KEY')!

  const db    = createClient(supabaseUrl, serviceKey)
  const today = new Date().toISOString().split('T')[0]
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: users } = await db
    .from('profiles')
    .select('id, name, preferred_language')
    .eq('is_bot', false) as { data: { id: string; name: string; preferred_language: string | null }[] | null }

  if (!users?.length) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const results: unknown[] = []

  for (const user of users) {
    try {
      const { data: existing } = await db
        .from('ai_briefings')
        .select('id')
        .eq('user_id', user.id)
        .eq('briefing_date', today)
        .maybeSingle()

      if (existing) {
        results.push({ user_id: user.id, status: 'skipped' })
        continue
      }

      const { data: messages } = await db.rpc('get_user_related_messages', {
        p_user_id: user.id,
        p_since: since,
        p_limit: 200,
      }) as { data: MessageRow[] | null }

      const msgs = messages ?? []
      if (msgs.length === 0) {
        results.push({ user_id: user.id, status: 'no_messages' })
        continue
      }

      const locale    = getLocale(user.preferred_language)
      const formatted = msgs
        .map(m => `[${m.id}] (${m.room_name}, ${m.sender_name}, ${m.created_at}) ${m.content}`)
        .join('\n')

      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: locale.systemPrompt },
            { role: 'user',   content: `직원: ${user.name}\n\n메시지:\n${formatted}` },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
      })

      if (!aiRes.ok) {
        console.error(`[daily-briefing] OpenAI error for ${user.id}:`, await aiRes.text())
        results.push({ user_id: user.id, status: 'openai_error' })
        continue
      }

      const aiData = await aiRes.json() as {
        choices: { message: { content: string } }[]
        usage?: { total_tokens: number }
      }
      const parsed = JSON.parse(aiData.choices[0].message.content) as { items: BriefingItem[] }
      const items  = parsed.items ?? []

      if (items.length === 0) {
        results.push({ user_id: user.id, status: 'no_items' })
        continue
      }

      const { data: briefing, error: insertErr } = await db
        .from('ai_briefings')
        .insert({
          user_id:       user.id,
          briefing_date: today,
          items,
          message_count: msgs.length,
          tokens_used:   aiData.usage?.total_tokens ?? 0,
        })
        .select()
        .single()

      if (insertErr || !briefing) {
        console.error(`[daily-briefing] insert error for ${user.id}:`, insertErr)
        results.push({ user_id: user.id, status: 'insert_error' })
        continue
      }

      const mintRoomId = await getOrCreateMintRoom(db, user.id)

      const { data: msg } = await db
        .from('messages')
        .insert({
          room_id:      mintRoomId,
          sender_id:    BOT_USER_ID,
          message_type: 'mint_briefing',
          payload: {
            briefing_id:   briefing.id,
            locale:        user.preferred_language ?? 'ko',
            greeting:      locale.greeting(user.name),
            summary:       locale.summary(msgs.length, items.length),
            message_count: msgs.length,
            items,
          },
          content: locale.greeting(user.name),
        })
        .select()
        .single()

      if (msg) {
        await db
          .from('ai_briefings')
          .update({
            delivered_at:         new Date().toISOString(),
            delivered_message_id: msg.id,
          })
          .eq('id', briefing.id)
      }

      results.push({ user_id: user.id, items: items.length, status: 'ok' })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[daily-briefing] error for ${user.id}:`, errMsg)
      results.push({ user_id: user.id, status: 'failed', error: errMsg })
    }
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
```

- [ ] **Step 2: Set OPENAI_API_KEY secret**

```bash
supabase secrets set OPENAI_API_KEY=sk-<your-key>
```

Expected: `Added secret OPENAI_API_KEY`

- [ ] **Step 3: Deploy the function**

```bash
supabase functions deploy daily-briefing
```

Expected: `Deployed Function daily-briefing`

- [ ] **Step 4: Manual trigger test**

Get a valid JWT (log in as any active user and copy `session.access_token` from browser devtools → Application → Local Storage → `sb-...-auth-token`).

Replace `<YOUR_PROJECT_URL>` with the value of `VITE_SUPABASE_URL` from `.env`:

```bash
curl -X POST https://<YOUR_PROJECT_URL>/functions/v1/daily-briefing \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response:
```json
{
  "processed": N,
  "results": [
    { "user_id": "...", "items": 3, "status": "ok" },
    ...
  ]
}
```

Then verify in Supabase Dashboard → Table Editor → `ai_briefings`:
- One row per active user with `briefing_date = today` and `delivered_at` set.

Open the MINT DM room in the app — BriefingCard should render.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/daily-briefing/index.ts
git commit -m "feat(fn): daily-briefing Edge Function — GPT-4o-mini per-user briefing"
```

---

## Task 13: Cron registration + final verification

- [ ] **Step 1: Set app.supabase_functions_url Postgres setting**

In Supabase Dashboard → SQL Editor:

```sql
-- Set the functions base URL (use your actual project URL)
ALTER DATABASE postgres SET "app.supabase_functions_url" = 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1';
ALTER DATABASE postgres SET "app.cron_secret" = '<YOUR_SERVICE_ROLE_KEY>';
```

Replace `<YOUR_PROJECT_REF>` with the ref from your Supabase project URL and `<YOUR_SERVICE_ROLE_KEY>` from Project Settings → API.

- [ ] **Step 2: Register cron job**

```sql
SELECT cron.schedule(
  'mint-daily-briefing',
  '30 23 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_functions_url', true) || '/daily-briefing',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true),
      'Content-Type', 'application/json'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 3: Verify cron registered**

```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'mint-daily-briefing';
```

Expected: one row, `active = true`, `schedule = '30 23 * * *'`.

- [ ] **Step 4: Run full verification checklist**

DB:
```sql
-- migrations applied
SELECT COUNT(*) FROM ai_briefings;                            -- table exists
SELECT room_type FROM rooms WHERE room_type = 'mint_dm';     -- after first trigger
SELECT column_name FROM information_schema.columns
  WHERE table_name='messages' AND column_name='payload';     -- payload column
```

UI (manual):
- Open MINT DM room → BriefingCard renders with 4-category badges
- Click a "채팅 보기" button on any card with source_room_id set → app switches to source room and highlights the message
- Click 👍 → `ai_briefings.feedback_score = 1` in Dashboard
- MINT avatar shows SVG leaf (not Bot icon) in chat header and sidebar

Privacy:
```sql
-- Confirm RPC excludes bot messages
SELECT COUNT(*) FROM get_user_related_messages(
  '<any_user_id>'::uuid,
  now() - interval '24 hours',
  200
) WHERE sender_id = '00000000-0000-0000-0000-000000000001';
```

Expected: `0`.

- [ ] **Step 5: Final commit + build**

```bash
npm run build
git add .
git commit -m "feat(mint): MINT 아침 브리핑 Phase 1 MVP

- 4 DB migrations: mint_dm room type, mint_briefing message type + payload JSONB,
  ai_briefings table with RLS, bot rename to MINT + get_user_related_messages RPC
- daily-briefing Edge Function: GPT-4o-mini analyses last-24h messages per user,
  6-language output via locales.ts (ko/en/zh/ja/ru/uz), json_object response format
- BriefingCard component: 4 categories with Lucide icons, chatEvents jump-to-source,
  thumbs feedback writes to ai_briefings
- MessageBubble: mint_briefing early return, MINT avatar SVG in mint squircle
- i18n: 8 briefing.* keys × 6 languages
- Avatar: renders SVG image when is_bot && avatarUrl
- chatEvents.navigateToMessage: cross-room jump via ChatPage state
- pg_cron: UTC 23:30 daily (KST 08:30)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Rollback

```sql
SELECT cron.unschedule('mint-daily-briefing');
```

Edge Function: Supabase Dashboard → Functions → daily-briefing → Pause (or delete).

DB tables are safe to leave in place — no other feature references them.
