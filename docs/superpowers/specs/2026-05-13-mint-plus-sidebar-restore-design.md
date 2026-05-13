---
title: MINT+ 사이드바 진입점 복원
date: 2026-05-13
status: approved
---

## 목표

Phase 3에서 사이드바 MINT 버튼을 mint_dm 방으로 라우팅하도록 변경한 것을 되돌린다.
MINT+와 DM의 MINT(mint_dm)를 독립된 두 진입점으로 분리한다.

## 최종 구조

```
사이드바 레일
├── MINT+  ← AI 기능 카드 그리드 (AiChatWindow idle state)
└── 채팅
    └── DM 목록
        └── MINT  ← mint_dm 방 (브리핑 + 대화)
```

## 회귀 원인

`ChatPage.tsx:176-189` — `handleSectionChange('ai')` 가 mint_dm 방으로 라우팅:

```ts
// Phase 3에서 추가된 잘못된 코드
if (s === 'ai') {
  const roomId = await getOrCreateMintDmRoom()
  setSelectedRoomId(roomId)
  setShowChat(true)
  setActiveSection('chat')  // 'ai' 섹션으로 이동하지 않음
  return
}
```

## 선택된 접근 방법: A (최소 회귀 복원)

기존 인프라(`activeSection === 'ai'` 렌더링 경로, AiChatWindow)는 이미 올바르게 존재한다.
Phase 3에서 추가된 mint_dm 라우팅 코드만 제거하고 라벨 4곳을 업데이트하면 충분하다.

## 변경 명세

### 1. ChatPage.tsx — `handleSectionChange` 수정

**위치:** `src/pages/ChatPage.tsx:176-189`

Phase 3에서 추가된 `'ai'` 케이스 전체를 제거한다. `'ai'`는 기본 `setActiveSection(s)` 경로를 타게 된다.

```ts
// 제거 대상 (Phase 3 추가분)
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

// 결과: 'ai'는 아래의 기본 경로를 탄다
setActiveSection(s)
```

### 2. MenuRail.tsx — 레일 버튼 라벨

**위치:** `src/components/layout/MenuRail.tsx:87`

```tsx
// 변경 전
label={t('menuRailBots')}

// 변경 후
label="MINT+"
```

### 3. ChatSidebar.tsx — 섹션 타이틀

**위치:** `src/components/layout/ChatSidebar.tsx:72`

```ts
// 변경 전
ai: 'MINT',

// 변경 후
ai: 'MINT+',
```

### 4. AiChatWindow.tsx — idle 상태 타이틀

**위치:** `src/components/ai/AiChatWindow.tsx:454`

```tsx
// 변경 전
MINT

// 변경 후
MINT+
```

## 변경하지 않는 것

- mint_dm 방 생성 로직 (`getOrCreateMintDmRoom` useEffect — ChatPage.tsx:101-107)
- DM 목록의 MINT 항목 렌더링
- BriefingCard, 빠른 액션 칩, MintHomeEmptyState
- AiChatWindow의 카드 그리드(AiQuickActions) 동작
- ChatPage의 `activeSection === 'ai'` 렌더링 경로 (이미 올바름)

## 검증 체크리스트

- [ ] 사이드바 레일에 MINT+ 항목 표시 (기존 위치)
- [ ] MINT+ 클릭 → 6개 기능 카드 그리드 ("MINT+" 타이틀)
- [ ] DM의 MINT 클릭 → mint_dm 방 (브리핑 카드)
- [ ] 두 진입점 독립적으로 동작
- [ ] mint_dm 빈 방 → empty state 카드 그리드 여전히 표시
- [ ] 기존 기능 카드 클릭 동작 정상

## 커밋 메시지

```
fix(sidebar): restore MINT+ as separate entry point

Split MINT into two distinct areas:
- MINT+ in sidebar: AI tool cards (quote, email, shipping, etc.)
- MINT in DMs: daily briefing + conversation (mint_dm room)

MINT+ restores original MintHome card grid.
Name updated from "MINT" to "MINT+".
DM MINT unchanged.
```
