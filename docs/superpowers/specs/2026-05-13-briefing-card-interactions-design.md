---
title: BriefingCard 인터랙션 강화
date: 2026-05-13
status: approved
---

## 목표

mint_dm 채팅의 BriefingCard에 개별 카드 삭제(dismiss), 전체 브리핑 삭제, 완료 표시, 핀, 캘린더 추가 기능을 추가한다.

## UI 레이아웃

```
┌─────────────────────────────────────┐
│ 📌 [핀]  🏷 마감  5/20까지          │ ← 카테고리 배지 + 핀 버튼
│ ☑ 5/20 도착 예정 화물 준비          │ ← 체크박스 + 완료 시 취소선
│ 현재 5/20에 도착할 예정인 화물...   │
│                                     │
│ [📅 Google] [📅 ICS] [채팅 보기 →] [✕] │ ← 하단 액션 + dismiss X
└─────────────────────────────────────┘

브리핑 헤더:
강인성님, 오늘의 브리핑입니다.    [🗑 전체 삭제]
```

**카드 클릭 동작 변경:** 카드 전체 클릭으로 채팅 이동하던 기존 동작을 제거. "채팅 보기 →" 버튼으로만 이동.

---

## 선택된 접근 방법: A (BriefingCard 단일 컴포넌트 확장)

모든 인터랙션 로직을 BriefingCard 내부에서 처리. `messageId` prop 추가, 로컬 `useState`로 items 관리 후 DB 동기화.

---

## 데이터 구조 확장

`BriefingItem` 인터페이스에 3개 필드 추가:

```ts
interface BriefingItem {
  // 기존 필드 유지
  category: 'deadline' | 'action' | 'pending' | 'alert'
  title: string
  description: string
  source_message_id: string | null
  source_room_id: string | null
  source_room_name: string | null
  due_at: string | null
  priority: 'high' | 'medium' | 'low'
  // 신규 필드 (옵셔널 — 기존 브리핑과 호환)
  completed?: boolean
  pinned?: boolean
  dismissed?: boolean
}
```

별도 마이그레이션 없음 — JSONB payload를 in-place 업데이트.

---

## 변경 파일

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `src/components/mint/BriefingCard.tsx` | Modify | 전체 인터랙션 구현, messageId prop 추가 |
| `src/components/chat/MessageBubble.tsx` | Modify (1줄) | message.id를 BriefingCard에 전달 |
| `src/lib/i18n.ts` | Modify | 5개 키 × 6개 언어 추가 |

---

## 기능별 구현 명세

### Props 변경

```tsx
export function BriefingCard({
  payload,
  messageId,
}: {
  payload: BriefingPayload
  messageId: string
})
```

### 로컬 상태

```tsx
const [items, setItems] = useState<BriefingItem[]>(payload.items)
const [deleted, setDeleted] = useState(false)
```

`items`를 payload에서 복사해 로컬 관리. `deleted`는 전체 삭제 후 UI 숨김용.

### updateBriefingItem 헬퍼

```ts
async function updateBriefingItem(
  messageId: string,
  itemIndex: number,
  patch: Partial<BriefingItem>
) {
  const { data: msg } = await supabase
    .from('messages')
    .select('payload')
    .eq('id', messageId)
    .single()

  const updatedItems = [...(msg.payload.items ?? [])]
  updatedItems[itemIndex] = { ...updatedItems[itemIndex], ...patch }

  await supabase
    .from('messages')
    .update({ payload: { ...msg.payload, items: updatedItems } })
    .eq('id', messageId)
}
```

### 1. 개별 카드 dismiss

```tsx
// 로컬 즉시 업데이트 → DB 동기화
const handleDismiss = async (idx: number) => {
  setItems(prev => prev.map((it, i) => i === idx ? { ...it, dismissed: true } : it))
  await updateBriefingItem(messageId, idx, { dismissed: true })
}

// 렌더링
const visibleItems = items.filter(item => !item.dismissed)
const sortedItems = [
  ...visibleItems.filter(i => i.pinned),
  ...visibleItems.filter(i => !i.pinned),
]
```

### 2. 전체 브리핑 삭제

```tsx
const handleDeleteBriefing = async () => {
  setDeleted(true)
  await supabase.from('messages').delete().eq('id', messageId)
  await supabase.from('ai_briefings')
    .delete()
    .eq('delivered_message_id', messageId)
}

// 렌더링
if (deleted) return null
```

Realtime이 `messages` 삭제를 수신해 채팅에서 자동 제거. `deleted` state는 Realtime 수신 전 즉각 숨김용.

### 3. 완료 표시

```tsx
const handleComplete = async (idx: number) => {
  const next = !items[idx].completed
  setItems(prev => prev.map((it, i) => i === idx ? { ...it, completed: next } : it))
  await updateBriefingItem(messageId, idx, { completed: next })
}

// 타이틀 스타일
<h3 style={item.completed ? { textDecoration: 'line-through', color: '#94a3b8' } : {}}>
  {item.title}
</h3>
```

### 4. 핀

```tsx
const handlePin = async (idx: number) => {
  const next = !items[idx].pinned
  setItems(prev => prev.map((it, i) => i === idx ? { ...it, pinned: next } : it))
  await updateBriefingItem(messageId, idx, { pinned: next })
}

// 정렬: pinned 항목 최상단
const sortedItems = [
  ...visibleItems.filter(i => i.pinned),
  ...visibleItems.filter(i => !i.pinned),
]
```

### 5. 캘린더 추가 (deadline 카테고리만)

```tsx
const handleAddToCalendar = (item: BriefingItem) => {
  const title = encodeURIComponent(`[MTL] ${item.title}`)
  const details = encodeURIComponent(item.description)
  const date = item.due_at
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
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${item.title}.ics`
  a.click()
}

// 카드 하단 (deadline만)
{item.category === 'deadline' && (
  <div className="flex gap-2">
    <button onClick={e => { e.stopPropagation(); handleAddToCalendar(item) }}>
      📅 Google
    </button>
    <button onClick={e => { e.stopPropagation(); handleDownloadICS(item) }}>
      📅 ICS
    </button>
  </div>
)}
```

---

## MessageBubble 변경 (1줄)

```tsx
// 변경 전
<BriefingCard payload={message.payload as unknown as BriefingPayload} />

// 변경 후
<BriefingCard
  payload={message.payload as unknown as BriefingPayload}
  messageId={message.id}
/>
```

---

## i18n 추가 키 (6개 언어)

각 언어 블록의 `briefingWeeklyLabel` 뒤에 추가:

| 키 | ko | en | ru | uz | zh | ja |
|----|----|----|----|----|----|----|
| `briefingDelete` | 브리핑 삭제 | Delete briefing | Удалить брифинг | Brifingni o'chirish | 删除简报 | ブリーフィング削除 |
| `briefingDismiss` | 항목 삭제 | Dismiss | Скрыть | Yopish | 忽略 | 非表示 |
| `briefingComplete` | 완료 | Done | Готово | Bajarildi | 完成 | 完了 |
| `briefingPin` | 핀 | Pin | Закрепить | Mahkamlash | 置顶 | ピン留め |
| `briefingCalendar` | 캘린더에 추가 | Add to calendar | В календарь | Kalendarга qo'shish | 添加到日历 | カレンダーに追加 |

---

## 변경하지 않는 것

- `BriefingPayload` 인터페이스 (기존 필드 유지)
- 피드백(ThumbsUp/Down) 기능
- 브리핑 프라이버시 안내 텍스트
- 브리핑 생성 로직 (Edge Function)
- `ai_briefings` 테이블 스키마 — `delivered_message_id` 컬럼은 이미 존재

---

## 검증 체크리스트

- [ ] 개별 카드 X → 해당 카드 즉시 사라짐, 새로고침 후에도 유지
- [ ] 전체 삭제 → 브리핑 카드 전체 제거 (Realtime)
- [ ] 체크박스 → 완료 스타일 (취소선 + 옅은 색), 토글 가능
- [ ] 핀 → 해당 카드 최상단 이동, 핀 아이콘 강조, 새로고침 후 유지
- [ ] 마감 카테고리만 📅 버튼 표시
- [ ] Google Calendar 버튼 → 새 탭 열림
- [ ] ICS 버튼 → 파일 다운로드
- [ ] 카드 빈 영역 클릭 → 채팅 이동 없음
- [ ] "채팅 보기 →" 클릭 → 채팅 이동

---

## 커밋 메시지

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
