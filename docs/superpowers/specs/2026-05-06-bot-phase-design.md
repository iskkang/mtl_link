# Phase 봇: MTL 도우미 설계 문서

**날짜**: 2026-05-06  
**범위**: 봇 진입점 활성화 + 봇 1:1 대화방 + Anthropic Haiku API 연결  
**접근법**: Approach 1 (클라이언트 트리거 + Edge Function)  
**라우팅 결정**: Approach B (handleSelectRoom 재활용 → activeSection = 'chat' 전환)

---

## 1. DB 마이그레이션

파일: `supabase/migrations/<ts>_bot_user.sql`

### 변경 사항

**1-1. `is_bot` 컬럼 추가**
```sql
ALTER TABLE profiles
  ADD COLUMN is_bot boolean NOT NULL DEFAULT false;
```

**1-2. `auto_join_channels` 트리거 재정의**

봇 프로필이 INSERT될 때 채널 자동 가입을 건너뛰도록 수정.  
기존 `is_default = true` 조건은 그대로 유지.

```sql
CREATE OR REPLACE FUNCTION public.auto_join_channels()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_bot THEN RETURN NEW; END IF;
  INSERT INTO room_members (room_id, user_id, role)
  SELECT id, NEW.id, 'member'
  FROM rooms
  WHERE room_type = 'channel' AND is_default = true
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**1-3. `auth.users`에 봇 row 삽입**
```sql
INSERT INTO auth.users (
  id, email, encrypted_password, role, aud, created_at, updated_at, email_confirmed_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'bot@mtl.internal', '', 'authenticated', 'authenticated',
  now(), now(), now()
) ON CONFLICT (id) DO NOTHING;
```

**1-4. `profiles`에 봇 row 삽입**
```sql
INSERT INTO profiles (id, email, name, is_bot, status, preferred_language, must_change_password)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'bot@mtl.internal', 'MTL 도우미',
  true, 'active', 'ko', false
) ON CONFLICT (id) DO NOTHING;
```

---

## 2. 타입 & 상수

### `src/types/database.ts`

`profiles` 테이블의 Row / Insert / Update 타입에 `is_bot: boolean` 추가.

### `src/constants/bot.ts` (신규)

```ts
export const BOT_USER_ID = '00000000-0000-0000-0000-000000000001'
```

UUID 하드코딩 분산 금지. 클라이언트 전체에서 이 상수만 사용.

---

## 3. 봇 방 라우팅

**라우팅 결정**: Approach B — `handleSelectRoom()` 재활용.  
봇 아이콘 클릭 → 봇 방 생성/조회 → `handleSelectRoom(roomId)` → `activeSection = 'chat'` 전환 + ChatWindow 열기.

### `ChatPage.tsx`

`onSectionChange={setActiveSection}` 직접 전달을 `handleSectionChange`로 교체:

```ts
const handleSectionChange = async (s: Section) => {
  if (s === 'bots') {
    const { data } = await supabase.rpc('get_or_create_direct_room', {
      p_target_user_id: BOT_USER_ID
    })
    handleSelectRoom(data) // data는 UUID 직접 반환 (※ data.room_id 아님)
    return
  }
  setActiveSection(s)
}
```

> **중요**: `get_or_create_direct_room` RPC는 `uuid`를 직접 반환한다. `data.room_id`가 아닌 `data`를 사용해야 한다.

`botRoomId` 별도 상태 불필요. `handleSelectRoom`이 `selectedRoomId` 설정 + `showChat = true` + `activeSection = 'chat'` 전환을 모두 담당.

### `MenuRail.tsx`

- `bots`를 PLACEHOLDER 배열에서 제거
- DAILY 섹션 하단에 독립 봇 버튼으로 추가 (muted opacity 제거 → 활성화)
- 클릭 시 `onSectionChange('bots')` 호출

### `MoreSheet.tsx` (모바일)

- 봇 항목 추가: lucide `Bot` 아이콘 + "MTL 도우미" 텍스트
- 클릭 → `onSectionChange('bots')` 동일 흐름

---

## 4. Edge Function

파일: `supabase/functions/bot-respond/index.ts`

### 입력

```ts
interface BotRequest {
  roomId: string
  userMessage: string
  userLanguage: string  // profile.preferred_language
}
```

### 처리 흐름

1. `SUPABASE_SERVICE_ROLE_KEY`로 Supabase 클라이언트 생성
2. 봇 방 검증: `room_members`에 `BOT_USER_ID` 존재 확인 (봇 방이 아니면 400 반환)
3. 봇 루프 방지: 트리거 메시지 발신자가 봇이면 즉시 return
4. Rate limit: 최근 1분 내 봇 메시지 수 ≥ 10이면 429 반환
5. 최근 10개 메시지 로드 (text 타입, `deleted_at IS NULL`) → 컨텍스트로 전달
6. Anthropic Haiku 4.5 API 호출
7. 봇 응답을 `messages`에 INSERT

### Anthropic API 설정

```ts
model: 'claude-haiku-4-5-20251001'
max_tokens: 800
system: <시스템 프롬프트 (userLanguage 치환)>
messages: [최근 10개 + 현재 userMessage]
```

### 시스템 프롬프트

```
You are MTL Assistant, an AI helper for MTL Link — an internal communication
platform for a freight forwarding and logistics company.

Your role:
- Answer questions about logistics, freight, customs, shipping, and trade
- Help with task management and internal Q&A
- Assist with understanding company communications

Guidelines:
- Always respond in {userLanguage}
- Be concise and professional, but friendly
- Use industry-standard logistics terminology (B/L, FCL/LCL, freight rates, customs)
- If you don't know something specific to this company, say so clearly
- Never make up specific shipment, client, or internal data

Company context: International freight forwarding company handling FCL/LCL,
customs clearance, B/L management, and freight rate negotiations.
```

### 봇 메시지 INSERT

```ts
{
  room_id: roomId,
  sender_id: BOT_USER_ID,
  content: anthropicResponse,
  message_type: 'text',
  source_language: userLanguage  // 번역 스킵
}
```

### Rate Limit 구현

```ts
const { data: recentBotMessages } = await db
  .from('messages')
  .select('id')
  .eq('room_id', roomId)
  .eq('sender_id', BOT_USER_ID)
  .gte('created_at', new Date(Date.now() - 60000).toISOString())

if (recentBotMessages.length >= 10) {
  return new Response('rate limit', { status: 429 })
}
```

### Supabase Secret 설정

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

---

## 5. useMessages.ts 변경

### `isBotRoom` 도출

```ts
const isBotRoom = roomMembers.some(m => m.user?.is_bot)
```

### 봇 트리거 (send 후)

```ts
if (isBotRoom) {
  setBotTyping(true)
  try {
    await supabase.functions.invoke('bot-respond', {
      body: {
        roomId,
        userMessage: content,
        userLanguage: profile?.preferred_language ?? 'ko'
      }
    })
  } finally {
    setBotTyping(false)
  }
}
```

Edge Function 오류(API 키 없음, 네트워크 오류, 429 등) 시 타이핑 인디케이터만 사라지고 사용자에게 별도 에러 표시 없음. 내부 도구 특성상 허용.

클라이언트에서 send하는 메시지는 항상 현재 사용자(봇 아님)이므로 발신자 체크 불필요.  
봇 루프 방지는 Edge Function 내부에서 처리.

### 반환값 추가

```ts
return { ..., isBotTyping, isBotRoom }
```

---

## 6. 타이핑 인디케이터

### `MessageList.tsx`

- `isBotTyping: boolean` prop 추가
- 목록 하단 조건부 렌더링:

```tsx
{isBotTyping && (
  <div className="bot-typing-indicator px-4 py-2 text-sm" style={{ color: 'var(--side-mute)' }}>
    {t('botTyping')}
  </div>
)}
```

### i18n (`src/lib/i18n.ts`)

`botTyping` 키 6개 언어 추가:

| 언어 | 번역 |
|------|------|
| ko   | MTL 도우미가 입력 중... |
| en   | MTL Assistant is typing... |
| ru   | MTL Ассистент печатает... |
| zh   | MTL助手正在输入... |
| ja   | MTLアシスタントが入力中... |
| uz   | MTL Yordamchi yozmoqda... |

---

## 7. 봇 시각 구분

### `Avatar.tsx`

- `is_bot?: boolean` prop 추가
- `is_bot === true`이면 아바타 이미지 대신 lucide `Bot` 아이콘 (브랜드 색)

### `MessageBubble.tsx`

- `message.sender?.is_bot === true` 감지
- 수신 말풍선(`isOwn === false`) 좌측에 brand 색 2px 세로 선 추가
- 발신자명 옆에 작은 "AI" 뱃지 (텍스트, brand 색 배경)

---

## 8. 채널 멤버 목록

봇이 채널에 auto_join 되지 않으므로(트리거 제외 처리) 추가 필터 불필요.  
DM 방의 멤버 목록(ChatHeader)에서 `is_bot = true` 멤버는 "MTL 도우미"로 표시됨 (이름이 이미 구분).

---

## 만지지 말 것

- 멘션 / 스레드 / 이모지 반응 / 공지 배너
- 자동 번역 핵심 로직 (봇 source_language 설정으로 자동 처리)
- Realtime 구독 (봇 메시지도 기존 구독으로 자동 수신)
- 채널 가시성 / 채널 탐색 모달

---

## 확인 체크리스트

### DB
- [ ] `is_bot` 컬럼 추가 + 봇 프로필 생성 확인
- [ ] `auto_join_channels` 트리거에 is_bot 제외 조건 확인
- [ ] 봇이 채널에 자동 가입되지 않음 확인

### 봇 방 라우팅
- [ ] 데스크톱 MenuRail 봇 아이콘 활성화 (opacity 정상)
- [ ] 클릭 시 봇 1:1 대화방 생성 + 진입
- [ ] 두 번 클릭해도 중복 방 생성 안 됨 (get_or_create)
- [ ] 모바일 MoreSheet에서 봇 진입 가능

### 대화
- [ ] 메시지 전송 후 "MTL 도우미가 입력 중..." 표시
- [ ] 5~15초 이내 봇 응답 도착
- [ ] 봇 메시지가 수신 말풍선 + Bot 아바타 + "AI" 뱃지로 표시
- [ ] 봇 메시지가 번역 처리 안 됨 (source_language = userLanguage)
- [ ] Rate limit 동작 (1분 10회 초과 시 거부)
- [ ] 봇 루프 없음

### 회귀
- [ ] 기존 DM/채널/스레드/멘션 정상
- [ ] 채널 멤버 목록에 봇 미표시
- [ ] 빌드 통과

---

## 배포 순서

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy bot-respond
supabase db push  # 마이그레이션 적용
npm run build
git add -A
git commit -m "phase 봇: MTL 도우미 + Haiku API + 타이핑 인디케이터"
git push origin main
```
