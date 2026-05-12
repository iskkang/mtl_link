# MTL Link v2.6 구현 기록

> 이 세션에서 추가·수정된 기능 전체를 기록한다.  
> 작성일: 2026-05-12  
> 대상 브랜치: `main`  
> 기준: v2.5 이후 커밋 (`d39c737` ~ `f25504f`, 2026-05-12)

---

## 0. 세션 요약

| 분류 | 내용 |
|------|------|
| 클립보드 이미지 붙여넣기 | MessageInput에 Ctrl+V 이미지 감지 → 파일 첨부 연동 |
| 드롭다운 hover 스타일 통일 | JS onMouseEnter/Leave → Tailwind CSS hover: 클래스로 교체 |
| 스레드 답글 알림 배지 | 새 스레드 답글 감지 → 메시지 버블에 빨간 unread 카운터 표시 |
| GreetingWeatherCard i18n | 한국어 하드코딩 21개 문자열 → i18n 6개 언어 완전 국제화 |
| 전역 폰트 사이즈 축소 | html font-size 16px → 14px (rem 기반 전체 스케일 다운) |
| 사이드바/채널 폰트 사이즈 축소 | 5개 컴포넌트에서 text-sm/base/headline-2 → text-[13px] |

---

## 1. 클립보드 이미지 붙여넣기 (Ctrl+V)

### 1-1. MessageInput — onPasteFiles prop 추가 (`src/components/chat/MessageInput.tsx`)

```ts
// Props 인터페이스에 추가
onPasteFiles?: (files: File[]) => void
```

```ts
// handlePaste useCallback — textarea onPaste 핸들러
const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
  const items = Array.from(e.clipboardData?.items ?? [])
  const imageItems = items.filter(item => item.type.startsWith('image/'))
  if (imageItems.length === 0) return
  e.preventDefault()
  const files = imageItems.map(item => {
    const blob = item.getAsFile()!
    const ext  = item.type.split('/')[1] ?? 'png'
    return new File([blob], `screenshot_${Date.now()}.${ext}`, { type: item.type })
  })
  onPasteFiles?.(files)
}, [onPasteFiles])
```

- `<textarea>`에 `onPaste={handlePaste}` 연결
- 이미지가 아닌 일반 텍스트 붙여넣기는 그대로 통과

### 1-2. ChatWindow — onPasteFiles 연결 (`src/components/layout/ChatWindow.tsx`)

```tsx
<MessageInput
  ...
  onPasteFiles={handleFilesSelected}
/>
```

### 1-3. ThreadPanel — onPasteFiles 연결 (`src/components/chat/ThreadPanel.tsx`)

```tsx
<MessageInput
  ...
  onPasteFiles={handleFilesSelected}
/>
```

---

## 2. 드롭다운 메뉴 hover 스타일 CSS 클래스로 통일

**배경**: 기존 메뉴 항목들이 JS `onMouseEnter`/`onMouseLeave`로 인라인 스타일을 직접 조작. CSS transition이 적용되지 않고 코드가 장황함.

**변경 방식**: 모든 hover 효과를 Tailwind `hover:bg-[var(--bg-hover)]` 클래스로 교체.

### 2-1. MessageMenu — MenuItem 컴포넌트 (`src/components/chat/MessageMenu.tsx`)

```tsx
// Before
onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
onMouseLeave={e => e.currentTarget.style.background = ''}

// After
className="... hover:bg-[var(--bg-hover)] transition-colors duration-100"
// onMouseEnter/Leave 제거
```

### 2-2. ChatHeaderMenu — MenuRow 컴포넌트 (`src/components/chat/ChatHeaderMenu.tsx`)

```tsx
className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-100
  ${danger ? 'hover:bg-[rgba(239,63,26,0.06)]' : 'hover:bg-[var(--bg-hover)]'}`}
```

### 2-3. ProfileMenu — MenuRow + 언어 선택 버튼 (`src/components/layout/ProfileMenu.tsx`)

```tsx
// MenuRow
className={`... ${danger ? 'hover:bg-[rgba(239,63,26,0.06)]' : 'hover:bg-[var(--bg-hover)]'}`}

// 언어 버튼 (비활성 상태만)
className={`... ${!isActive ? 'hover:bg-[var(--bg-hover)]' : ''}`}
```

**CSS 변수 값**:
- 라이트 모드: `--bg-hover: #F0F0F1`
- 다크 모드: `--bg-hover: #2B3A47`

---

## 3. 스레드 답글 알림 배지

### 3-1. roomStore — threadUnread 상태 추가 (`src/stores/roomStore.ts`)

```ts
// 인터페이스
threadUnread:           Record<string, number>   // { [rootMessageId]: count }
incrementThreadUnread:  (messageId: string) => void
resetThreadUnread:      (messageId: string) => void

// 초기값
threadUnread: {}

// 구현
incrementThreadUnread: (messageId) => set(s => ({
  threadUnread: { ...s.threadUnread, [messageId]: (s.threadUnread[messageId] ?? 0) + 1 },
})),
resetThreadUnread: (messageId) => set(s => {
  if (!s.threadUnread[messageId]) return {}
  const next = { ...s.threadUnread }
  delete next[messageId]
  return { threadUnread: next }
}),
```

### 3-2. useGlobalMessageMonitor — 스레드 답글 감지 (`src/hooks/useGlobalMessageMonitor.ts`)

```ts
// Realtime INSERT 콜백 내부에 추가
if (msg.thread_root_id) {
  const rootId = msg.thread_root_id as string
  supabase
    .from('messages')
    .select('sender_id')
    .eq('id', rootId)
    .single()
    .then(({ data: rootMsg }) => {
      if (rootMsg?.sender_id === userIdRef.current) {
        incrementThreadUnread(rootId)
      }
    })
}
```

- `thread_root_id`가 있는 메시지(스레드 답글)에서만 동작
- 해당 루트 메시지의 sender_id가 현재 유저일 때만 카운트 증가
- `reply_to_id`(인라인 인용 답장)와 혼동하지 않도록 명확히 분리

> **주의**: 스레드 답글에도 기존 알림음이 울리므로(타인의 메시지 전체 처리) 추가 beep 없음.

### 3-3. MessageBubble — unread 배지 표시 (`src/components/chat/MessageBubble.tsx`)

```tsx
const threadUnread = useRoomStore(s => s.threadUnread[message.id] ?? 0)

// 스레드 버튼 옆에 배지 렌더링
{threadUnread > 0 && (
  <span
    className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4
               rounded-full px-1 text-[10px] font-bold text-white leading-none"
    style={{ background: '#ef4444' }}
    title={t('threadNewReplies', { count: threadUnread })}
  >
    {threadUnread}
  </span>
)}
```

### 3-4. ThreadPanel — 열릴 때 카운트 초기화 (`src/components/chat/ThreadPanel.tsx`)

```ts
const resetThreadUnread = useRoomStore(s => s.resetThreadUnread)
useEffect(() => {
  resetThreadUnread(rootMessageId)
}, [rootMessageId, resetThreadUnread])
```

### 3-5. i18n 키 추가 (`src/lib/i18n.ts`)

| 키 | 한국어 | 영어 |
|----|--------|------|
| `threadReplyNotif` | `{name}님이 스레드에 답글을 남겼습니다` | `{name} replied in a thread` |
| `threadNewReplies` | `새 답글 {count}개` | `{count} new replies` |

6개 언어(ko/en/ru/uz/zh/ja) 모두 추가.

---

## 4. GreetingWeatherCard 완전 국제화

### 4-1. 하드코딩 문자열 제거 및 i18n 키 매핑

**기존 문제**:
- `WEATHER_MESSAGES` 객체: 11개 날씨 메시지 한국어 하드코딩
- `getGreetingMessage()`: 8개 시간대별 인사말 한국어 하드코딩
- `Intl.DateTimeFormat`: locale 미지정 → 항상 브라우저 기본 로케일 사용

**변경 후 구조**:

```ts
// 날씨 카테고리 → i18n 키 매핑
const WEATHER_MSG_KEYS: Record<string, string> = {
  clear:        'weatherMsgClear',
  cloudy:       'weatherCloudy',
  rainExpected: 'weatherRainExpected',
  // ... 11개
}

// LOCALE_MAP — Intl.DateTimeFormat 로케일 결정
const LOCALE_MAP: Record<string, string> = {
  ko: 'ko-KR', en: 'en-US', ru: 'ru-RU',
  uz: 'uz-UZ', zh: 'zh-CN', ja: 'ja-JP',
}

// 인사말 함수 — t() 함수를 인자로 받아 i18n 처리
function getGreetingBody(h: number, t: (key: string) => string): string {
  if (h < 5)  return t('greetingLateNight')
  if (h < 8)  return t('greetingMorning')
  // ...
}
```

### 4-2. 추가된 i18n 키 (6개 언어 × 20개 키)

**시간대별 인사말 (8개)**:

| 키 | 시간 | 한국어 | 영어 |
|----|------|--------|------|
| `greetingLateNight` | 0–4시 | 늦은 밤이네요. 무리하지 마세요. | It's late. Take care. |
| `greetingMorning` | 5–7시 | 좋은 아침입니다! | Good morning! |
| `greetingMidMorning` | 8–10시 | 오늘도 활기찬 하루 되세요! | Have a great morning! |
| `greetingNoon` | 11–12시 | 점심 시간이에요. 잘 드셨나요? | Lunchtime! Did you eat well? |
| `greetingAfternoon` | 13–14시 | 오후도 파이팅입니다! | Keep going this afternoon! |
| `greetingLateAfternoon` | 15–17시 | 퇴근까지 조금만 더! | Almost done for the day! |
| `greetingEvening` | 18–20시 | 수고 많으셨습니다! | Good work today! |
| `greetingNight` | 21–23시 | 편안한 저녁 되세요. | Have a restful evening. |

**날씨 메시지 (11개 + feelsLike 1개)**:

| 키 | 한국어 | 영어 |
|----|--------|------|
| `weatherMsgClear` | 오늘은 맑은 날씨예요! | Clear skies today! |
| `weatherCloudy` | 흐린 날씨예요. 우산을 챙기세요. | Cloudy today. Bring an umbrella. |
| `weatherRainExpected` | 비가 올 수도 있어요. | Rain is expected. |
| `weatherRaining` | 비가 내리고 있어요. | It's raining. |
| `weatherHeavyRain` | 폭우가 내립니다. 외출 시 주의하세요! | Heavy rain! Be careful outside. |
| `weatherSnowExpected` | 눈이 올 수도 있어요. | Snow is expected. |
| `weatherHeavySnow` | 폭설이 내립니다. 미끄럼에 주의하세요! | Heavy snowfall! Watch your step. |
| `weatherHot` | 무더운 날씨예요. 수분 보충 잊지 마세요! | Hot day! Stay hydrated. |
| `weatherExtremeHot` | 매우 뜨거워요! 야외 활동을 자제하세요. | Extreme heat! Avoid outdoors. |
| `weatherFreezing` | 매우 추워요. 따뜻하게 입으세요! | Very cold. Dress warmly! |
| `weatherColdWave` | 한파 경보! 체온 관리에 주의하세요. | Cold wave alert! Keep warm. |
| `weatherFeelsLikeTemp` | 체감 {{temp}}° | Feels like {{temp}}° |

> **키 충돌 방지**: 기존 `WeatherCard.tsx`가 사용하는 `weatherClear: '맑음'` 단축 키와 충돌을 피하기 위해 `weatherMsgClear`(문장형)로 신규 키 명명.

### 4-3. 날짜 표시 로케일 적용

```ts
const userLanguage = i18n.language.split('-')[0]
const locale = LOCALE_MAP[userLanguage] ?? 'en-US'

const dateStr = new Intl.DateTimeFormat(locale, {
  weekday: 'long', month: 'long', day: 'numeric',
}).format(new Date())
// ko-KR → "5월 12일 월요일"
// en-US → "Monday, May 12"
```

---

## 5. 전역 폰트 사이즈 축소

### 5-1. index.css — html font-size 조정 (`src/index.css`)

```css
@layer base {
  html {
    font-size: 14px;   /* 기존: 16px (브라우저 기본) */
    scroll-behavior: smooth;
  }
}
```

**효과**: Tailwind의 rem 기반 클래스(`text-sm` = 0.875rem, `text-base` = 1rem 등)가 14px 기준으로 비례 축소.

| Tailwind 클래스 | 기존 (16px 기준) | 변경 후 (14px 기준) |
|----------------|-----------------|-------------------|
| `text-xs`      | 12px            | 10.5px            |
| `text-sm`      | 14px            | 12.25px           |
| `text-base`    | 16px            | 14px              |
| `text-lg`      | 18px            | 15.75px           |

---

## 6. 사이드바 / 채널 패널 폰트 사이즈 명시적 축소

rem 기반 클래스 외에 절대 px을 지정한 커스텀 Tailwind 토큰(`headline-2` = 16px, `subtitle-2` = 14px)은 html font-size 변경에 영향을 받지 않으므로 직접 수정.

### 6-1. ChannelsPanel (`src/components/channels/ChannelsPanel.tsx`)

| 위치 | 변경 전 | 변경 후 |
|------|---------|---------|
| 패널 헤더 타이틀 | `text-base` | `text-[13px]` |
| 검색 input | `text-sm` | `text-[13px]` |
| 빈 상태 텍스트 | `text-sm` | `text-[13px]` |
| 채널 이름 | `text-sm` | `text-[13px]` |
| 채널 설명 | `text-xs` | `text-[11px]` |

### 6-2. ChatSidebar (`src/components/layout/ChatSidebar.tsx`)

| 위치 | 변경 전 | 변경 후 |
|------|---------|---------|
| 채팅 검색 input | `text-sm` | `text-[13px]` |
| ComingSoon 제목 (h3) | `text-sm` | `text-[13px]` |
| ComingSoon 부제목 (p) | `text-xs` | `text-[11px]` |
| ComingSoon 설명 (p) | `text-xs` | `text-[11px]` |
| EmptyRoomList 제목 | `text-sm` | `text-[13px]` |
| EmptyRoomList 설명 | `text-xs` | `text-[11px]` |

### 6-3. FriendsList (`src/components/chat/FriendsList.tsx`)

| 위치 | 변경 전 | 변경 후 |
|------|---------|---------|
| 검색 input | `text-sm` | `text-[13px]` |

### 6-4. ChatHeader (`src/components/chat/ChatHeader.tsx`)

| 위치 | 변경 전 | 변경 후 |
|------|---------|---------|
| MTL 로고 회사명 | `text-sm` | `text-[13px]` |
| 회사 부제목 | `text-xs` | `text-[11px]` |

*(채팅방 displayName은 이미 `text-[13px]`, subtitle은 `text-[11px]`로 선행 적용 상태)*

### 6-5. RoomListItem (`src/components/chat/RoomListItem.tsx`)

tailwind.config.js 커스텀 토큰 확인:
- `text-headline-2`: 16px → 채팅방명에 사용 → `text-[13px] font-medium`으로 교체
- `text-subtitle-2`: 14px → 최근 메시지 미리보기에 사용 → `text-[12px]`으로 교체
- `text-caption-2`: 12px → 타임스탬프 → 유지 (이미 충분히 작음)

---

## 7. 파일 변경 목록

### 주요 수정

| 파일 | 수정 내용 |
|------|-----------|
| `src/components/chat/MessageInput.tsx` | `onPasteFiles` prop, `handlePaste` useCallback, textarea `onPaste` 연결 |
| `src/components/layout/ChatWindow.tsx` | `onPasteFiles={handleFilesSelected}` 전달 |
| `src/components/chat/ThreadPanel.tsx` | `onPasteFiles={handleFilesSelected}` 전달, `resetThreadUnread` 마운트 시 호출 |
| `src/components/chat/MessageMenu.tsx` | JS hover → Tailwind `hover:bg-[var(--bg-hover)]` |
| `src/components/chat/ChatHeaderMenu.tsx` | JS hover → Tailwind CSS, danger 조건부 hover |
| `src/components/layout/ProfileMenu.tsx` | JS hover → Tailwind CSS (MenuRow + 언어 버튼) |
| `src/stores/roomStore.ts` | `threadUnread`, `incrementThreadUnread`, `resetThreadUnread` 추가 |
| `src/hooks/useGlobalMessageMonitor.ts` | `thread_root_id` 감지 → `incrementThreadUnread` 호출 |
| `src/components/chat/MessageBubble.tsx` | `threadUnread` 배지 렌더링 |
| `src/components/dashboard/GreetingWeatherCard.tsx` | 전체 i18n 적용 — 한국어 하드코딩 완전 제거 |
| `src/lib/i18n.ts` | 20개 신규 키 × 6개 언어 추가 |
| `src/index.css` | `html { font-size: 14px }` |
| `src/components/channels/ChannelsPanel.tsx` | 폰트 사이즈 일괄 축소 |
| `src/components/layout/ChatSidebar.tsx` | 폰트 사이즈 일괄 축소 |
| `src/components/chat/FriendsList.tsx` | 검색 input 폰트 축소 |
| `src/components/chat/ChatHeader.tsx` | 로고 영역 폰트 축소 |
| `src/components/chat/RoomListItem.tsx` | 커스텀 토큰 → 명시적 px 클래스로 교체 |

---

## 8. 테스트 체크리스트

### 클립보드 이미지 붙여넣기
- [ ] 채팅창에서 이미지 복사 후 Ctrl+V → 파일 첨부 미리보기 표시 확인
- [ ] 스레드 패널에서도 동일하게 동작 확인
- [ ] 텍스트 붙여넣기는 정상적으로 텍스트 삽입 확인 (파일 처리 안 됨)
- [ ] 첨부 후 전송 시 이미지 업로드 정상 확인

### 드롭다운 hover 스타일
- [ ] 메시지 우클릭/hover 메뉴 항목에 hover 시 배경색 전환 확인
- [ ] 채팅 헤더 메뉴 항목 hover 확인
- [ ] 프로필 메뉴 항목 hover 확인
- [ ] danger 항목(나가기/삭제)은 빨간 계열 hover 확인
- [ ] 다크/라이트 모드 양쪽에서 CSS 변수 올바르게 적용 확인

### 스레드 답글 알림 배지
- [ ] 타인이 내 메시지에 스레드 답글 작성 시 해당 메시지 버튼 옆 빨간 배지 표시 확인
- [ ] 배지 숫자가 답글 수에 맞게 증가 확인
- [ ] ThreadPanel 열면 배지 초기화(사라짐) 확인
- [ ] 내 메시지가 아닌 스레드 답글에는 배지 표시 안 됨 확인
- [ ] i18n 툴팁(threadNewReplies) 6개 언어 확인

### GreetingWeatherCard i18n
- [ ] 앱 언어를 EN/RU/UZ/ZH/JA로 변경 시 인사말·날씨 메시지가 해당 언어로 표시 확인
- [ ] 날짜 표시가 로케일에 맞게 포맷 변경 확인 (ko: "5월 12일 월요일", en: "Monday, May 12")
- [ ] 체감온도 보간 `{{temp}}°` 정상 출력 확인
- [ ] 날씨 API 미응답 시 날씨 관련 텍스트 미표시 확인 (graceful fallback)

### 폰트 사이즈
- [ ] 사이드바 채팅방 이름이 이전보다 작아짐 확인
- [ ] ChannelsPanel 채널 이름/설명 축소 확인
- [ ] ChatHeader 회사명 텍스트 축소 확인
- [ ] 전체적인 UI 레이아웃 깨짐 없음 확인
- [ ] 다크/라이트 모드 양쪽 확인
