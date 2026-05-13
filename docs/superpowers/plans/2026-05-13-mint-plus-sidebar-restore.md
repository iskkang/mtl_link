# MINT+ 사이드바 진입점 복원 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 3에서 mint_dm으로 합쳐진 사이드바 MINT 버튼을 MINT+ (AiChatWindow 카드 그리드) 로 복원하고, DM의 MINT(mint_dm 방)와 독립적으로 동작하게 분리한다.

**Architecture:** `ChatPage.tsx`의 `handleSectionChange('ai')` 에서 mint_dm 라우팅 코드를 제거해 기본 `setActiveSection('ai')` 경로를 타도록 되돌린다. 라벨 3곳("MINT" → "MINT+")을 추가 업데이트한다.

**Tech Stack:** React, TypeScript, Vite (`npm run typecheck` 으로 타입 검증)

**Spec:** `docs/superpowers/specs/2026-05-13-mint-plus-sidebar-restore-design.md`

---

## File Map

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `src/pages/ChatPage.tsx` | Modify (lines 176-189) | `'ai'` 케이스 제거 — mint_dm 라우팅 코드 삭제 |
| `src/components/layout/MenuRail.tsx` | Modify (line 87) | 레일 버튼 라벨 `t('menuRailBots')` → `"MINT+"` |
| `src/components/layout/ChatSidebar.tsx` | Modify (line 72) | 섹션 타이틀 `'MINT'` → `'MINT+'` |
| `src/components/ai/AiChatWindow.tsx` | Modify (line 454) | idle 상태 타이틀 `MINT` → `MINT+` |

---

## Task 1: handleSectionChange에서 mint_dm 라우팅 제거

**Files:**
- Modify: `src/pages/ChatPage.tsx:164-191`

이 변경이 핵심이다. `'ai'` 섹션 클릭 시 mint_dm 방으로 이동하는 대신 `setActiveSection('ai')` 기본 경로를 타게 된다.

- [ ] **Step 1: 현재 상태 확인**

```bash
grep -n "s === 'ai'" src/pages/ChatPage.tsx
```

Expected: `176:    if (s === 'ai') {` 라인 출력

- [ ] **Step 2: handleSectionChange에서 'ai' 케이스 제거**

`src/pages/ChatPage.tsx` 에서 아래 블록(약 176-189라인)을 **전체 삭제**한다:

```ts
// 이 블록 전체 삭제
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
```

삭제 후 `handleSectionChange` 함수는 다음과 같아야 한다:

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

- [ ] **Step 3: 타입 검증**

```bash
npm run typecheck
```

Expected: 오류 없이 완료 (exit code 0)

- [ ] **Step 4: 커밋**

```bash
git add src/pages/ChatPage.tsx
git commit -m "fix(sidebar): remove mint_dm routing from 'ai' section change"
```

---

## Task 2: MINT+ 라벨 3곳 업데이트

**Files:**
- Modify: `src/components/layout/MenuRail.tsx:87`
- Modify: `src/components/layout/ChatSidebar.tsx:72`
- Modify: `src/components/ai/AiChatWindow.tsx:454`

- [ ] **Step 1: MenuRail.tsx — 레일 버튼 라벨 변경**

`src/components/layout/MenuRail.tsx` 84-89라인을 찾아 `label` prop을 변경한다:

```tsx
// 변경 전
          <RailBtn
            Icon={MintIcon}
            label={t('menuRailBots')}
            active={activeSection === 'ai'}
            onClick={() => onSectionChange('ai')}
          />
```

```tsx
// 변경 후
          <RailBtn
            Icon={MintIcon}
            label="MINT+"
            active={activeSection === 'ai'}
            onClick={() => onSectionChange('ai')}
          />
```

- [ ] **Step 2: ChatSidebar.tsx — 섹션 타이틀 변경**

`src/components/layout/ChatSidebar.tsx` 72라인을 찾아 변경한다:

```ts
// 변경 전
    ai:            'MINT',
```

```ts
// 변경 후
    ai:            'MINT+',
```

- [ ] **Step 3: AiChatWindow.tsx — idle 상태 타이틀 변경**

`src/components/ai/AiChatWindow.tsx` 453-455라인을 찾아 변경한다:

```tsx
// 변경 전
              <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-.5px' }}>
                MINT
              </span>
```

```tsx
// 변경 후
              <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-.5px' }}>
                MINT+
              </span>
```

- [ ] **Step 4: 타입 검증**

```bash
npm run typecheck
```

Expected: 오류 없이 완료 (exit code 0)

- [ ] **Step 5: 커밋**

```bash
git add src/components/layout/MenuRail.tsx src/components/layout/ChatSidebar.tsx src/components/ai/AiChatWindow.tsx
git commit -m "fix(sidebar): rename MINT → MINT+ in rail, sidebar header, and idle title"
```

---

## Task 3: 동작 검증

- [ ] **Step 1: 개발 서버 시작**

```bash
npm run dev
```

브라우저에서 앱이 열리면 다음 체크리스트를 수동 검증한다.

- [ ] **Step 2: MINT+ 진입점 검증**

1. 사이드바 레일에서 MintIcon 버튼(Folded Leaf) 클릭
2. 확인: 메인 영역에 "MINT+" 타이틀 + 6개 기능 카드 그리드 표시
3. 확인: 사이드바 헤더에 "MINT+" 텍스트 표시
4. 확인: mint_dm 방으로 이동하지 않음

- [ ] **Step 3: DM MINT 독립 동작 검증**

1. 사이드바 레일에서 채팅(MessageSquare) 버튼 클릭
2. DM 목록에서 "MINT" 항목 클릭
3. 확인: mint_dm 방 열림 (BriefingCard 또는 MintHomeEmptyState 표시)
4. 확인: MINT+ 카드 그리드와 완전히 독립적으로 동작

- [ ] **Step 4: 기능 카드 클릭 동작 검증**

1. MINT+ 화면에서 "견적 체크리스트" 카드 클릭
2. 확인: QuotationPage로 이동
3. 뒤로가기 후 다른 카드도 각각 확인 (선택사항)

- [ ] **Step 5: 최종 커밋 (필요 시)**

검증 중 수정 사항이 있었다면:

```bash
git add -p
git commit -m "fix(sidebar): <수정 내용>"
```

---

## 검증 체크리스트 (Task 3 완료 기준)

- [ ] 사이드바 레일에 MINT+ 항목 표시 (기존 위치)
- [ ] MINT+ 클릭 → 6개 기능 카드 그리드 ("MINT+" 타이틀)
- [ ] DM의 MINT 클릭 → mint_dm 방 (브리핑 카드)
- [ ] 두 진입점 독립적으로 동작
- [ ] mint_dm 빈 방 → empty state 카드 그리드 여전히 표시
- [ ] 기존 기능 카드 클릭 동작 정상
