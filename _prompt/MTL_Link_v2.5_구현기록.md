# MTL Link v2.5 구현 기록

> 이 세션에서 추가·수정된 기능 전체를 기록한다.  
> 작성일: 2026-05-07  
> 대상 브랜치: `main`  
> 기준: v2.4 이후 커밋 (`687bf29` ~ `6d142da`, 2026-05-06)

---

## 0. 세션 요약

| 분류 | 내용 |
|------|------|
| AI 봇 채팅 | MTL Assistant 봇 채팅방 구현 (Haiku 4.5, bot-respond Edge Function) |
| Phase 캘린더 | 6개국 공휴일 월 뷰 CalendarPage 신규 구현 |
| 이메일 승인/거절 | 관리자 알림 이메일에 원클릭 승인·거절 링크 추가 |
| 대시보드 버그 수정 | 카드 짤림, 높이 조정, vite 청크 캐시 불일치 |
| 번역 로직 단순화 | 수신 메시지 번역 언어를 viewer의 preferred_language로 고정 |
| PostgREST 오류 수정 | messages↔profiles FK 모호성, .single() → .maybeSingle() |

---

## 1. AI 봇 채팅 (MTL Assistant)

### 1-1. DB 스키마 — is_bot 컬럼 추가

```sql
-- profiles 테이블에 is_bot 컬럼 추가
ALTER TABLE profiles ADD COLUMN is_bot boolean NOT NULL DEFAULT false;

-- 봇 프로필 시드 데이터
INSERT INTO profiles (id, display_name, is_bot, preferred_language)
VALUES ('00000000-0000-0000-0000-000000000001', 'MTL Assistant', true, 'en');
```

**타입 변경 (`src/types/database.ts`, `src/types/chat.ts`)**:
- `Profile` Row/Insert/Update에 `is_bot: boolean` 추가
- `MessageWithSender.sender` Pick에 `is_bot` 포함
- `RoomListItem.members` Pick에 `is_bot` 포함

### 1-2. bot-respond Edge Function (`supabase/functions/bot-respond/index.ts`)

물류·무역 도메인 특화 AI 챗봇. Claude Haiku 4.5 모델 사용.

**주요 동작 흐름**:
1. 봇 방 검증 (`room_members`에 `BOT_USER_ID` 존재 확인)
2. Rate limit: 최근 1분 내 봇 응답 ≥ 10건이면 429 반환
3. 최근 10개 메시지 로드 → 대화 컨텍스트 구성
4. Anthropic API 호출 (Haiku 4.5, max_tokens: 800)
5. 봇 응답을 `messages` 테이블에 INSERT

**시스템 프롬프트 주요 내용**:
- 항상 `{userLanguage}`로 응답
- 물류 전문 용어 (B/L, FCL/LCL, 운임, 통관) 사용
- 마크다운 서식 사용 금지 — 평문 + 줄바꿈만 허용
- 회사 내부 데이터(화물, 고객) 조작 금지

**환경 변수**: `ANTHROPIC_API_KEY` 필수 (미설정 시 500 반환)

### 1-3. 봇 메시지 트리거 — useMessages (`src/hooks/useMessages.ts`)

```ts
// 메시지 전송 후 isBotRoom 조건 시 bot-respond 호출
if (isBotRoom) {
  setIsBotTyping(true)
  await supabase.functions.invoke('bot-respond', {
    body: { roomId, userMessage: content, userLanguage }
  })
  setIsBotTyping(false)
}
```

- `isBotRoom`: `room_members` 중 `is_bot === true`인 멤버가 있는 방
- `isBotTyping` 상태를 ChatWindow로 노출

### 1-4. 봇 UI (`src/components/chat/MessageBubble.tsx`, `MessageList.tsx`, `Avatar.tsx`)

| 컴포넌트 | 변경 |
|---------|------|
| `Avatar.tsx` | `isBot` prop → 로봇 아이콘 아바타 렌더링 |
| `MessageBubble.tsx` | sender.is_bot 시 "AI" 배지 표시 |
| `MessageList.tsx` | `isBotTyping` prop → 점 3개 타이핑 인디케이터 표시 |

**타이핑 인디케이터**: CSS 애니메이션 dot-bounce 3개 점이 순차 점프.

### 1-5. MenuRail 봇 라우팅 (`src/components/layout/MenuRail.tsx`, `src/pages/ChatPage.tsx`)

- MenuRail에서 봇 아이콘 클릭 시 `/chat?bot=1` 라우팅
- `ChatPage.tsx`에서 `?bot=1` 파라미터 감지 → 봇 방 자동 진입

### 1-6. react-markdown 시도 후 제거

```
feat: 봇 메시지 마크다운 렌더링 (react-markdown)  → f31328f
fix: react-markdown 제거, 봇 메시지 plain text      → 16b8094
```

react-markdown 적용 시 XSS·스타일 충돌 문제로 즉시 롤백.  
봇 시스템 프롬프트에서 마크다운 사용 자체를 금지하는 방식으로 해결.

---

## 2. Phase 캘린더 — 6개국 공휴일 월 뷰

### 2-1. useHolidays 훅 (`src/hooks/useHolidays.ts`)

공휴일 데이터 로딩 + 캐시 관리:

- **API**: nager.date Public Holidays API (`/api/v3/PublicHolidays/{year}/{countryCode}`)
- **캐시**: `localStorage` 연 단위 캐시 (`holidays_{country}_{year}`)
- **UZ(우즈베키스탄) 폴백**: nager.date 미지원(204) → 8개 고정 공휴일 정적 배열로 대체

```ts
const UZ_FALLBACK_HOLIDAYS = [
  { date: '2026-01-01', localName: "Yangi yil" },
  { date: '2026-03-21', localName: "Navro'z" },
  // ... 8개
]
```

### 2-2. CalendarGrid (`src/components/calendar/CalendarGrid.tsx`)

CSS Grid 기반 월 뷰 캘린더:

| 기능 | 구현 |
|------|------|
| 요일 헤더 | Mon~Sun (월요일 시작, date-fns `startOfWeek` localeWeek) |
| 오늘 강조 | 배경색 + 텍스트 굵게 |
| 공휴일 dot | 날짜 하단 컬러 dot |
| Hover 툴팁 | 공휴일 이름 표시 (CSS variable `--bg-2` 사용, `--ink-1` 제거) |

**버그 수정**: 툴팁 색상에 미정의 CSS 변수 `--ink-1` 사용 → `text-primary` 클래스로 교체 (`3246f29`).

### 2-3. CalendarPage (`src/components/calendar/CalendarPage.tsx`)

- **탭**: KR · US · RU · UZ · CN · JP 6개국 국기 이모지 포함
- **기본 탭**: 로그인 사용자 `preferred_language` 기반 자동 선택
  - `ko` → KR, `en` → US, `ru` → RU, `uz` → UZ, `zh` → CN, `ja` → JP
- **월 이동**: `<` / `>` 버튼으로 전월·익월 이동
- **i18n 추가**: `calendarTitle`, `noHolidays`, `loadError`, `today` 6개 언어 대응

### 2-4. ChatPage 라우팅 통합 (`src/pages/ChatPage.tsx`, `src/components/layout/ChatSidebar.tsx`)

- `ChatSidebar.tsx`에서 캘린더 항목의 "Coming Soon" 제거 → 실제 기능 활성화
- `ChatPage.tsx`에 `activeSection === 'calendar'` 분기 추가
- 모바일에서 `showChat` 조건 확장 (캘린더 선택 시 패널 표시)

---

## 3. 이메일 원클릭 승인/거절

### 3-1. approve-user Edge Function (`supabase/functions/approve-user/index.ts`)

관리자가 이메일 링크 클릭만으로 신규 가입 승인·거절 처리:

```
GET /functions/v1/approve-user?token={jwt}&action=approve
GET /functions/v1/approve-user?token={jwt}&action=reject
```

**JWT 토큰 구조**: `{ userId, email, action }` — 서비스 롤 키로 서명, 24시간 만료.

**approve 처리**:
1. `profiles.status = 'approved'` 업데이트
2. 사용자에게 승인 안내 이메일 발송 (Resend API)
3. 브라우저에 HTML 완료 페이지 반환

**reject 처리**:
1. `profiles.status = 'rejected'` 업데이트
2. 사용자에게 거절 안내 이메일 발송
3. 브라우저에 HTML 완료 페이지 반환

**HTML 인코딩 수정** (`0011f67`): `TextEncoder` UTF-8 명시적 지정으로 한글 깨짐 방지.

### 3-2. send-signup-notification 수정 (`supabase/functions/send-signup-notification/index.ts`)

관리자 알림 이메일에 원클릭 승인/거절 버튼 추가:

```html
<!-- 이메일 본문에 추가된 버튼 -->
<a href="{approveUrl}" style="background:#22c55e; ...">✅ 승인</a>
<a href="{rejectUrl}" style="background:#ef4444; ...">❌ 거절</a>
```

- `FROM_EMAIL` 도메인 수정: `send.mtlb.co.kr` → `mtlb.co.kr` (`051a34b`)
- 버튼 URL: `approve-user` Edge Function에 토큰 포함한 링크

---

## 4. 대시보드 버그 수정

### 4-1. 하단 카드 짤림 (`e3430e1`)

**증상**: 대시보드 Row 3 카드가 화면 하단에서 잘림.

**원인**: 대시보드 컨테이너 `overflow: hidden` + `height: 100%` 구조에서 Row 3가 뷰포트 밖으로 밀림.

**수정**:
```tsx
// 카드 내부 스크롤 영역에 overflow-y-auto + minHeight 적용
<div className="overflow-y-auto" style={{ minHeight: 0 }}>
```

### 4-2. 카드 높이 조정 (`8486325`)

| 카드 | 변경 |
|------|------|
| 해운지수 (ShippingIndexCard) | 높이 `200px` 고정 |
| 글로벌무역량 (TradeVolumeCard) | 높이 `220px` 고정 |

### 4-3. vite:preloadError 자동 새로고침 (`d089400`)

**증상**: 배포 후 기존 탭에서 청크 파일 URL이 바뀌어 `vite:preloadError` 발생.

**수정**: `main.tsx` 또는 진입점에서 전역 에러 핸들러 추가:

```ts
window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})
```

---

## 5. 번역 로직 단순화

### 5-1. 수신 메시지 번역 언어 고정 (`089c0a2`, `6d142da`)

**v2.4의 접근**: ChatWindow에서 `get_target_language` RPC로 `targetLanguage` 계산 → prop으로 전달.

**v2.5의 변경**: `targetLanguage` prop 제거. `MessageBubble` 내부에서 항상 `viewer.preferred_language`로 직접 결정.

```ts
// Before (v2.4): targetLanguage prop 의존
const myLanguage = isOwn
  ? profile.preferred_language ?? 'ko'
  : (targetLanguage && targetLanguage !== 'none')
    ? targetLanguage
    : profile.preferred_language ?? 'ko'

// After (v2.5): viewer profile에서 직접
const myLanguage = profile.preferred_language ?? 'ko'
// isOwn 메시지는 isTranslatable = false로 별도 처리
```

**이유**: targetLanguage prop 전달 구조가 복잡하고 빌드 에러를 유발. viewer의 preferred_language가 항상 올바른 번역 대상이므로 단순화.

---

## 6. PostgREST 오류 수정

### 6-1. messages↔profiles FK 모호성 (`85e759f`)

**증상**: `messages` 조회 시 `"Could not embed because more than one relationship was found"` 오류.

**원인**: `messages` 테이블에 `sender_id`와 다른 FK가 모두 `profiles(id)`를 참조해 관계 모호성 발생.

**수정**: 쿼리에 FK 명시:
```ts
// Before
.select('*, sender:profiles(*)')

// After
.select('*, sender:profiles!messages_sender_id_fkey(*)')
```

### 6-2. 빈 채널 fetch .single() → .maybeSingle() (`d378089`)

**증상**: 채널이 없는 방 진입 시 PostgREST `PGRST116` 오류 (exactly one row expected).

**수정**: 결과가 0건일 수 있는 쿼리에서 `.single()` → `.maybeSingle()` 교체.

### 6-3. 메시지 메인창 표시 회귀 (`687bf29`)

이모지 반응 기능 작업 중 메시지 표시 쿼리가 누락되어 메인 채팅창이 빈 화면으로 표시되는 회귀 수정.

---

## 7. 파일 변경 목록

### 신규 생성

| 파일 | 설명 |
|------|------|
| `supabase/functions/bot-respond/index.ts` | AI 봇 응답 Edge Function (Haiku 4.5) |
| `supabase/functions/approve-user/index.ts` | 이메일 원클릭 승인/거절 Edge Function |
| `src/hooks/useHolidays.ts` | 공휴일 데이터 훅 (nager.date API + localStorage 캐시) |
| `src/components/calendar/CalendarGrid.tsx` | CSS Grid 월 뷰 캘린더 |
| `src/components/calendar/CalendarPage.tsx` | 6개국 공휴일 캘린더 페이지 |

### 주요 수정

| 파일 | 수정 내용 |
|------|-----------|
| `src/types/database.ts` | `is_bot` 필드 추가 (Profile Row/Insert/Update) |
| `src/types/chat.ts` | `MessageWithSender`, `RoomListItem` — `is_bot` 포함 |
| `src/hooks/useMessages.ts` | 봇 방 감지, isBotTyping 상태, bot-respond 트리거 |
| `src/components/chat/MessageBubble.tsx` | AI 배지, 번역 로직 단순화 |
| `src/components/chat/MessageList.tsx` | isBotTyping 인디케이터 렌더링 |
| `src/components/ui/Avatar.tsx` | isBot prop → 로봇 아이콘 |
| `src/components/layout/MenuRail.tsx` | 봇 아이콘 활성화, 봇 방 라우팅 |
| `src/components/layout/ChatSidebar.tsx` | 캘린더 Coming Soon 제거 |
| `src/pages/ChatPage.tsx` | calendar 섹션 분기, 모바일 조건 확장 |
| `src/lib/i18n.ts` | 캘린더 관련 i18n 키 추가 (6개 언어) |
| `supabase/functions/send-signup-notification/index.ts` | 승인/거절 버튼 추가, FROM_EMAIL 도메인 수정 |

---

## 8. Supabase 배포 명령어

```powershell
$env:SUPABASE_ACCESS_TOKEN='<token>'
$REF = 'zidkckbabtajpgkhxmfm'

# Edge Function 배포
npx supabase functions deploy bot-respond --project-ref $REF --no-verify-jwt
npx supabase functions deploy approve-user --project-ref $REF --no-verify-jwt
npx supabase functions deploy send-signup-notification --project-ref $REF --no-verify-jwt

# 환경 변수 설정 (bot-respond용)
npx supabase secrets set ANTHROPIC_API_KEY=<key> --project-ref $REF
```

---

## 9. 테스트 체크리스트

### AI 봇 채팅
- [ ] MenuRail 봇 아이콘 클릭 → 봇 채팅방 진입 확인
- [ ] 메시지 전송 후 타이핑 인디케이터(점 3개) 표시 확인
- [ ] 봇 응답 메시지에 "AI" 배지 + 로봇 아바타 표시 확인
- [ ] 봇 응답이 사용자의 preferred_language로 반환되는 확인
- [ ] Rate limit: 1분 10회 초과 시 응답 없음 확인
- [ ] ANTHROPIC_API_KEY 미설정 시 오류 메시지 표시 확인

### Phase 캘린더
- [ ] 6개국 탭 (KR/US/RU/UZ/CN/JP) 전환 확인
- [ ] 로그인 언어에 맞는 기본 탭 자동 선택 확인
- [ ] 공휴일 있는 날짜에 dot 표시 확인
- [ ] dot hover 시 공휴일 이름 툴팁 표시 확인
- [ ] 오늘 날짜 강조 표시 확인
- [ ] < > 버튼으로 월 이동 확인
- [ ] UZ 탭 폴백 데이터 8개 공휴일 표시 확인

### 이메일 원클릭 승인/거절
- [ ] 신규 가입 시 관리자 알림 이메일에 승인/거절 버튼 확인
- [ ] 승인 버튼 클릭 → profiles.status = 'approved' + 완료 페이지 확인
- [ ] 거절 버튼 클릭 → profiles.status = 'rejected' + 완료 페이지 확인
- [ ] 만료 토큰(24시간 초과) 접근 시 오류 페이지 확인
- [ ] 한글 포함 이메일 HTML 인코딩 정상 확인

### 대시보드
- [ ] Row 3 카드 하단 짤림 없이 표시 확인
- [ ] 해운지수 카드 200px, 글로벌무역량 220px 높이 확인
- [ ] 배포 후 기존 탭 새로고침 시 vite:preloadError 자동 복구 확인

### 번역
- [ ] 수신 메시지가 viewer의 preferred_language로 번역 확인
- [ ] 내 발신 메시지에 번역 표시 없음 확인
