# BriefingCard 인터랙션 강화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BriefingCard에 개별 카드 dismiss, 전체 브리핑 삭제, 완료 표시, 핀, 캘린더 추가(Google/ICS) 기능을 구현한다.

**Architecture:** BriefingCard 단일 컴포넌트 확장. `messageId` prop 추가, `useState<BriefingItem[]>`로 로컬 items 관리 후 `updateBriefingItem` 헬퍼로 Supabase `messages.payload.items` JSONB patch. 카드 전체 클릭 제거, 모든 동작은 명시적 버튼으로만.

**Tech Stack:** React 18, TypeScript, Supabase JS, lucide-react, react-i18next. 테스트: `npm run typecheck` (no unit test runner).

**Spec:** `docs/superpowers/specs/2026-05-13-briefing-card-interactions-design.md`

---

## File Map

| 파일 | 변경 유형 | 담당 |
|------|-----------|------|
| `src/lib/i18n.ts` | Modify | 5개 신규 키 × 6개 언어 블록 |
| `src/components/mint/BriefingCard.tsx` | Modify | 인터페이스 확장, 상태·헬퍼·UI 전체 |
| `src/components/chat/MessageBubble.tsx` | Modify (1줄) | `messageId` prop 전달 |

---

## Task 1: i18n 키 추가 (6개 언어)

**Files:**
- Modify: `src/lib/i18n.ts`

각 언어 블록의 `briefingWeeklyLabel` 줄 **바로 뒤**에 5개 키를 추가한다.

- [ ] **Step 1: ko 블록 추가** (line 722 뒤)

`src/lib/i18n.ts` line 722 `briefingWeeklyLabel: '주간',` 바로 뒤에 삽입:

```ts
      briefingDelete:    '브리핑 삭제',
      briefingDismiss:   '항목 삭제',
      briefingComplete:  '완료',
      briefingPin:       '핀',
      briefingCalendar:  '캘린더에 추가',
```

- [ ] **Step 2: en 블록 추가** (line 1389 뒤)

`briefingWeeklyLabel: 'Weekly',` 바로 뒤에 삽입:

```ts
      briefingDelete:    'Delete briefing',
      briefingDismiss:   'Dismiss',
      briefingComplete:  'Done',
      briefingPin:       'Pin',
      briefingCalendar:  'Add to calendar',
```

- [ ] **Step 3: ru 블록 추가** (line 2056 뒤)

`briefingWeeklyLabel: 'Неделя',` 바로 뒤에 삽입:

```ts
      briefingDelete:    'Удалить брифинг',
      briefingDismiss:   'Скрыть',
      briefingComplete:  'Готово',
      briefingPin:       'Закрепить',
      briefingCalendar:  'В календарь',
```

- [ ] **Step 4: uz 블록 추가** (line 2723 뒤)

`briefingWeeklyLabel: 'Hafta',` 바로 뒤에 삽입:

```ts
      briefingDelete:    "Brifingni o'chirish",
      briefingDismiss:   'Yopish',
      briefingComplete:  'Bajarildi',
      briefingPin:       'Mahkamlash',
      briefingCalendar:  "Kalendarга qo'shish",
```

- [ ] **Step 5: zh 블록 추가** (line 3391 뒤)

`briefingWeeklyLabel: '本周',` 바로 뒤에 삽입:

```ts
      briefingDelete:    '删除简报',
      briefingDismiss:   '忽略',
      briefingComplete:  '完成',
      briefingPin:       '置顶',
      briefingCalendar:  '添加到日历',
```

- [ ] **Step 6: ja 블록 추가** (line 4059 뒤)

`briefingWeeklyLabel: '今週',` 바로 뒤에 삽입:

```ts
      briefingDelete:    'ブリーフィング削除',
      briefingDismiss:   '非表示',
      briefingComplete:  '完了',
      briefingPin:       'ピン留め',
      briefingCalendar:  'カレンダーに追加',
```

- [ ] **Step 7: 타입 검증**

```bash
npm run typecheck
```

Expected: 오류 없이 완료 (exit 0)

- [ ] **Step 8: 커밋**

```bash
git add src/lib/i18n.ts
git commit -m "feat(i18n): add briefing interaction keys for 6 languages"
```

---

## Task 2: BriefingCard 인터페이스·인프라 (상태, 헬퍼, 카드 클릭 제거)

**Files:**
- Modify: `src/components/mint/BriefingCard.tsx`

이 태스크는 후속 태스크(3~5)의 기반을 만든다. 아직 dismiss/complete/pin/delete/calendar UI는 추가하지 않는다. 컴파일은 되어야 하고, 카드 동작은 기존과 동일하되 카드 전체 클릭은 제거된다.

- [ ] **Step 1: import 업데이트**

파일 상단 import를 다음으로 교체한다:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Clock, ClipboardCheck, HelpCircle, AlertTriangle,
  ArrowRight, ThumbsUp, ThumbsDown,
  Pin, X, Circle, CheckCircle2, Trash2, CalendarPlus,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { chatEvents } from '../../lib/aiEvents'
```

- [ ] **Step 2: BriefingItem 인터페이스 확장**

기존 `BriefingItem` 인터페이스를 다음으로 교체한다:

```ts
interface BriefingItem {
  category: 'deadline' | 'action' | 'pending' | 'alert'
  title: string
  description: string
  source_message_id: string | null
  source_room_id: string | null
  source_room_name: string | null
  due_at: string | null
  priority: 'high' | 'medium' | 'low'
  completed?: boolean
  pinned?: boolean
  dismissed?: boolean
}
```

- [ ] **Step 3: updateBriefingItem 헬퍼 추가**

`CATEGORY_CONFIG` 정의 바로 앞(파일 모듈 레벨)에 추가한다:

```ts
async function updateBriefingItem(
  messageId: string,
  itemIndex: number,
  patch: Partial<BriefingItem>,
) {
  const { data: msg } = await supabase
    .from('messages')
    .select('payload')
    .eq('id', messageId)
    .single()
  if (!msg) return
  const updatedItems = [...(msg.payload.items ?? [])]
  updatedItems[itemIndex] = { ...updatedItems[itemIndex], ...patch }
  await supabase
    .from('messages')
    .update({ payload: { ...msg.payload, items: updatedItems } })
    .eq('id', messageId)
}
```

- [ ] **Step 4: BriefingCard props + 상태 업데이트**

함수 시그니처와 상태를 다음으로 교체한다:

```tsx
export function BriefingCard({
  payload,
  messageId,
}: {
  payload: BriefingPayload
  messageId: string
}) {
  const { t } = useTranslation()
  const [feedback, setFeedback] = useState<1 | -1 | null>(null)
  const [items, setItems] = useState<BriefingItem[]>(payload.items)
  const [deleted, setDeleted] = useState(false)
  const isWeekly = (payload.briefing_type ?? 'daily') === 'weekly'
```

- [ ] **Step 5: 카드 렌더링 — 카드 전체 onClick 제거, "채팅 보기" 버튼으로 변환**

기존 카드 `<div onClick={() => handleViewChat(item)} ...>` 를 찾아 `onClick` 제거:

```tsx
// 변경 전
<div
  key={idx}
  onClick={() => handleViewChat(item)}
  className={`bg-white border-[0.5px] ${borderClass} rounded-[10px] p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow`}
>
```

```tsx
// 변경 후
<div
  key={idx}
  className={`bg-white border-[0.5px] ${borderClass} rounded-[10px] p-3 shadow-sm`}
>
```

- [ ] **Step 6: "채팅 보기" `<span>` → `<button>` 변환**

기존 `<span>` 을 `<button>` 으로 교체한다:

```tsx
// 변경 전
{item.source_room_id && item.source_message_id && (
  <span className="inline-flex items-center gap-1 text-[11px] text-[#0d9488] font-medium">
    {t('briefingViewChat')}
    <ArrowRight size={12} />
  </span>
)}
```

```tsx
// 변경 후
{item.source_room_id && item.source_message_id && (
  <button
    onClick={() => handleViewChat(item)}
    className="inline-flex items-center gap-1 text-[11px] text-[#0d9488] font-medium hover:underline"
  >
    {t('briefingViewChat')}
    <ArrowRight size={12} />
  </button>
)}
```

- [ ] **Step 7: items 상태로 렌더링 전환**

기존 `{payload.items.map((item, idx) => {` 를 `{items.map((item, idx) => {` 로 변경한다.

- [ ] **Step 8: 타입 검증**

```bash
npm run typecheck
```

Expected: 오류 없이 완료 (exit 0)

- [ ] **Step 9: 커밋**

```bash
git add src/components/mint/BriefingCard.tsx
git commit -m "refactor(briefing): add messageId prop, local items state, remove card-wide click"
```

---

## Task 3: Dismiss · Complete · Pin 인터랙션

**Files:**
- Modify: `src/components/mint/BriefingCard.tsx`

Task 2 완료 후 진행한다. 이 태스크에서 3개 핸들러와 UI 버튼을 추가한다.

- [ ] **Step 1: 핸들러 3개 추가**

`handleFeedback` 함수 아래에 추가한다:

```tsx
const handleDismiss = async (idx: number) => {
  setItems(prev => prev.map((it, i) => i === idx ? { ...it, dismissed: true } : it))
  await updateBriefingItem(messageId, idx, { dismissed: true })
}

const handleComplete = async (idx: number) => {
  const next = !items[idx].completed
  setItems(prev => prev.map((it, i) => i === idx ? { ...it, completed: next } : it))
  await updateBriefingItem(messageId, idx, { completed: next })
}

const handlePin = async (idx: number) => {
  const next = !items[idx].pinned
  setItems(prev => prev.map((it, i) => i === idx ? { ...it, pinned: next } : it))
  await updateBriefingItem(messageId, idx, { pinned: next })
}
```

- [ ] **Step 2: visibleItems + sortedItems 계산 추가**

`return (` 바로 위에 추가한다:

```tsx
const visibleItems = items.filter(item => !item.dismissed)
const sortedItems = [
  ...visibleItems.filter(i => i.pinned),
  ...visibleItems.filter(i => !i.pinned),
]
```

- [ ] **Step 3: 렌더링 — `items.map` → `sortedItems.map` 변경**

```tsx
// 변경 전
{items.map((item, idx) => {
```

```tsx
// 변경 후
{sortedItems.map((item, idx) => {
```

**주의:** `idx`는 `sortedItems` 배열 내 인덱스가 아니라 원본 `items` 배열 내 인덱스여야 DB가 올바른 항목을 업데이트한다. `sortedItems.map` 시 원본 인덱스를 보존해야 한다:

```tsx
// Step 3 정정 — 원본 인덱스 보존
const visibleItems = items
  .map((item, idx) => ({ item, idx }))
  .filter(({ item }) => !item.dismissed)

const sortedItems = [
  ...visibleItems.filter(({ item }) => item.pinned),
  ...visibleItems.filter(({ item }) => !item.pinned),
]

// 렌더링
{sortedItems.map(({ item, idx }) => {
  const cfg = CATEGORY_CONFIG[item.category]
  const borderClass = item.category === 'alert' ? 'border-red-200' : 'border-black/[0.08]'
  return (
```

- [ ] **Step 4: 카드 상단 — 핀 버튼 + 카테고리 배지 행 교체**

기존 카테고리 배지 행을 다음으로 교체한다:

```tsx
{/* 상단 행: 핀 + 카테고리 배지 + 마감일 */}
<div className="flex items-center gap-1.5 mb-2">
  <button
    onClick={() => handlePin(idx)}
    className="flex-shrink-0 p-0.5 transition-colors"
    aria-label={t('briefingPin')}
  >
    <Pin size={12} color={item.pinned ? '#14b8a6' : '#cbd5e1'} />
  </button>
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
```

- [ ] **Step 5: 카드 제목 행 — 체크박스 + 완료 스타일 적용**

기존 제목 `<div>` 를 다음으로 교체한다:

```tsx
{/* 제목 행: 체크박스 + 완료 스타일 */}
<div className="flex items-start gap-2 mb-1">
  <button
    onClick={() => handleComplete(idx)}
    className="mt-0.5 flex-shrink-0"
    aria-label={t('briefingComplete')}
  >
    {item.completed
      ? <CheckCircle2 size={14} color="#14b8a6" />
      : <Circle size={14} color="#cbd5e1" />}
  </button>
  <div
    className="text-[13px] font-medium"
    style={{
      color:          item.completed ? '#94a3b8' : '#0f172a',
      textDecoration: item.completed ? 'line-through' : 'none',
    }}
  >
    {item.title}
  </div>
</div>
```

- [ ] **Step 6: 설명 텍스트 들여쓰기 조정**

체크박스 너비(14px + gap 8px = 22px) 만큼 들여쓰기:

```tsx
<div className="text-[12px] text-[#64748b] mb-2.5 leading-[1.5] pl-[22px]">
  {item.description}
</div>
```

- [ ] **Step 7: 카드 하단 — "채팅 보기" + Dismiss X 버튼**

기존 "채팅 보기" 버튼 블록을 다음으로 교체한다 (dismiss X 버튼 추가):

```tsx
{/* 하단 행: 채팅 보기 + X */}
<div className="flex items-center justify-end gap-2 pl-[22px]">
  {item.source_room_id && item.source_message_id && (
    <button
      onClick={() => handleViewChat(item)}
      className="inline-flex items-center gap-1 text-[11px] text-[#0d9488] font-medium hover:underline"
    >
      {t('briefingViewChat')}
      <ArrowRight size={12} />
    </button>
  )}
  <button
    onClick={() => handleDismiss(idx)}
    className="p-0.5 text-[#cbd5e1] hover:text-[#ef4444] transition-colors"
    aria-label={t('briefingDismiss')}
  >
    <X size={12} />
  </button>
</div>
```

- [ ] **Step 8: 타입 검증**

```bash
npm run typecheck
```

Expected: 오류 없이 완료 (exit 0)

- [ ] **Step 9: 커밋**

```bash
git add src/components/mint/BriefingCard.tsx
git commit -m "feat(briefing): add dismiss, complete, pin interactions"
```

---

## Task 4: 전체 브리핑 삭제

**Files:**
- Modify: `src/components/mint/BriefingCard.tsx`

Task 3 완료 후 진행한다.

- [ ] **Step 1: handleDeleteBriefing 핸들러 추가**

`handlePin` 아래에 추가한다:

```tsx
const handleDeleteBriefing = async () => {
  setDeleted(true)
  await supabase.from('messages').delete().eq('id', messageId)
  await (supabase as any)
    .from('ai_briefings')
    .delete()
    .eq('delivered_message_id', messageId)
}
```

- [ ] **Step 2: deleted 가드 추가**

`const visibleItems = ...` 계산 바로 위에 추가한다:

```tsx
if (deleted) return null
```

- [ ] **Step 3: 브리핑 헤더에 삭제 버튼 추가**

기존 헤더 `<div className="flex items-center gap-2 mb-1">` 내부를 다음으로 교체한다:

```tsx
<div className="flex items-center gap-2 mb-1">
  {isWeekly && (
    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex-shrink-0">
      {t('briefingWeeklyLabel')}
    </span>
  )}
  <span className="text-[14px] text-[#0f172a] leading-[1.5] font-medium">
    {payload.greeting}
  </span>
  <button
    onClick={handleDeleteBriefing}
    className="ml-auto p-1 text-[#cbd5e1] hover:text-[#ef4444] transition-colors flex-shrink-0"
    aria-label={t('briefingDelete')}
  >
    <Trash2 size={14} />
  </button>
</div>
```

- [ ] **Step 4: 타입 검증**

```bash
npm run typecheck
```

Expected: 오류 없이 완료 (exit 0)

- [ ] **Step 5: 커밋**

```bash
git add src/components/mint/BriefingCard.tsx
git commit -m "feat(briefing): add full briefing delete with messages + ai_briefings cleanup"
```

---

## Task 5: 캘린더 통합 (Google Calendar + ICS)

**Files:**
- Modify: `src/components/mint/BriefingCard.tsx`

Task 4 완료 후 진행한다. `deadline` 카테고리 카드에만 표시된다.

- [ ] **Step 1: handleAddToCalendar + handleDownloadICS 추가**

`handleDeleteBriefing` 아래에 추가한다:

```tsx
const handleAddToCalendar = (item: BriefingItem) => {
  const title   = encodeURIComponent(`[MTL] ${item.title}`)
  const details = encodeURIComponent(item.description)
  const date    = item.due_at
    ? new Date(item.due_at).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    : new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${date}/${date}&details=${details}`
  window.open(url, '_blank')
}

const handleDownloadICS = (item: BriefingItem) => {
  const date = item.due_at
    ? new Date(item.due_at).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    : new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `SUMMARY:[MTL] ${item.title}`,
    `DESCRIPTION:${item.description}`,
    `DTSTART:${date}`,
    `DTEND:${date}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const blob = new Blob([ics], { type: 'text/calendar' })
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = `${item.title}.ics`
  a.click()
}
```

- [ ] **Step 2: 카드 하단 행에 캘린더 버튼 추가**

Task 3에서 추가한 하단 행 `<div className="flex items-center justify-end gap-2 pl-[22px]">` 를 다음으로 교체한다 (캘린더 버튼 섹션 삽입):

```tsx
{/* 하단 행: 캘린더(deadline만) + 채팅 보기 + X */}
<div className="flex items-center justify-between pl-[22px]">
  <div className="flex gap-1">
    {item.category === 'deadline' && (
      <>
        <button
          onClick={() => handleAddToCalendar(item)}
          className="inline-flex items-center gap-0.5 text-[10px] text-[#64748b] hover:text-[#0d9488] transition-colors"
          title={t('briefingCalendar')}
        >
          <CalendarPlus size={11} />
          Google
        </button>
        <button
          onClick={() => handleDownloadICS(item)}
          className="inline-flex items-center gap-0.5 text-[10px] text-[#64748b] hover:text-[#0d9488] transition-colors"
          title="ICS"
        >
          <CalendarPlus size={11} />
          ICS
        </button>
      </>
    )}
  </div>
  <div className="flex items-center gap-2">
    {item.source_room_id && item.source_message_id && (
      <button
        onClick={() => handleViewChat(item)}
        className="inline-flex items-center gap-1 text-[11px] text-[#0d9488] font-medium hover:underline"
      >
        {t('briefingViewChat')}
        <ArrowRight size={12} />
      </button>
    )}
    <button
      onClick={() => handleDismiss(idx)}
      className="p-0.5 text-[#cbd5e1] hover:text-[#ef4444] transition-colors"
      aria-label={t('briefingDismiss')}
    >
      <X size={12} />
    </button>
  </div>
</div>
```

- [ ] **Step 3: 타입 검증**

```bash
npm run typecheck
```

Expected: 오류 없이 완료 (exit 0)

- [ ] **Step 4: 커밋**

```bash
git add src/components/mint/BriefingCard.tsx
git commit -m "feat(briefing): add Google Calendar and ICS download for deadline items"
```

---

## Task 6: MessageBubble — messageId prop 전달

**Files:**
- Modify: `src/components/chat/MessageBubble.tsx:245`

- [ ] **Step 1: BriefingCard 호출에 messageId 추가**

line 245 를 찾아 교체한다:

```tsx
// 변경 전
<BriefingCard payload={message.payload as unknown as BriefingPayload} />
```

```tsx
// 변경 후
<BriefingCard
  payload={message.payload as unknown as BriefingPayload}
  messageId={message.id}
/>
```

- [ ] **Step 2: 타입 검증**

```bash
npm run typecheck
```

Expected: 오류 없이 완료 (exit 0)

- [ ] **Step 3: 커밋**

```bash
git add src/components/chat/MessageBubble.tsx
git commit -m "feat(briefing): pass messageId to BriefingCard"
```

---

## Task 7: 빌드 검증

- [ ] **Step 1: 프로덕션 빌드**

```bash
npm run build
```

Expected: 오류 없이 완료 (exit 0), `dist/` 생성

- [ ] **Step 2: 수동 검증 체크리스트**

개발 서버(`npm run dev`)를 켜고 mint_dm 방에서 브리핑 카드를 확인한다:

- [ ] 개별 카드 X → 해당 카드 즉시 사라짐, 새로고침 후에도 유지
- [ ] 전체 삭제(휴지통) → 브리핑 카드 전체 제거
- [ ] 체크박스 클릭 → 취소선 + 옅은 색, 다시 클릭하면 복원
- [ ] 핀 버튼 → 해당 카드 최상단, 핀 아이콘 민트색 강조
- [ ] `deadline` 카테고리만 📅 Google + ICS 버튼 표시
- [ ] Google 버튼 → 새 탭 열림
- [ ] ICS 버튼 → `.ics` 파일 다운로드
- [ ] 카드 빈 영역 클릭 → 채팅 이동 없음
- [ ] "채팅 보기 →" 버튼 클릭 → 채팅으로 이동

---

## 검증 완료 후 커밋 메시지

```
feat(briefing): add dismiss, complete, pin, calendar to BriefingCard

- Individual card dismiss (dismissed flag in payload)
- Full briefing delete (messages + ai_briefings row)
- Complete toggle with strikethrough style
- Pin to top with sort order
- Add to Google Calendar URL scheme
- ICS download for Outlook/Apple Calendar
- Remove card-wide click navigation — use explicit button only
- 6-language i18n for new labels
```
