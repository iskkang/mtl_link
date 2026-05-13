# MINT 아침 브리핑 — Phase 1 MVP Design Spec

**Date:** 2026-05-13  
**Branch:** main  
**Status:** Approved, ready for implementation plan

---

## 0. 목표

매일 KST 08:30에 MINT 봇이 사용자별로 지난 24시간 메시지를 GPT-4o-mini로 분석하여 4개 카테고리(deadline / action / pending / alert) 브리핑 카드를 MINT DM 방에 전송. 사용자의 `preferred_language` 에 맞춰 6개 언어로 출력.

---

## 1. 범위 (이번 PR)

| 영역 | 변경 |
|------|------|
| DB | 마이그레이션 4개 + RPC 1개 |
| Edge Function | `supabase/functions/daily-briefing/` (신규) |
| Client | `src/components/mint/BriefingCard.tsx` (신규), `MessageBubble.tsx` 분기 추가 |
| i18n | `src/lib/i18n.ts` — `briefing.*` 키 8개 × 6언어 |
| Static asset | `/public/mint-logo-avatar.svg` (이미 생성됨, 경로 확인 필요) |

---

## 2. DB 마이그레이션

### Migration 1: rooms — mint_dm 타입 추가

```sql
-- rooms.room_type CHECK 확장
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_room_type_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_room_type_check
  CHECK (room_type IN ('direct', 'group', 'channel', 'mint_dm'));

-- group_room_name_required: mint_dm은 name 없어도 됨
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS group_room_name_required;
ALTER TABLE public.rooms ADD CONSTRAINT group_room_name_required CHECK (
  (room_type IN ('group', 'channel') AND name IS NOT NULL AND length(trim(name)) > 0)
  OR room_type IN ('direct', 'mint_dm')
);
```

### Migration 2: messages — mint_briefing 타입 + payload 컬럼

```sql
-- message_type CHECK 확장
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN (
    'text', 'image', 'file', 'link',
    'system', 'voice_translated', 'text_translated', 'mint_briefing'
  ));

-- payload JSONB 컬럼 추가
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS payload JSONB;
```

### Migration 3: ai_briefings 테이블

```sql
CREATE TABLE IF NOT EXISTS public.ai_briefings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  briefing_date      DATE NOT NULL,
  items              JSONB NOT NULL DEFAULT '[]'::jsonb,
  message_count      INT DEFAULT 0,
  model              TEXT DEFAULT 'gpt-4o-mini',
  tokens_used        INT,
  generated_at       TIMESTAMPTZ DEFAULT NOW(),
  delivered_at       TIMESTAMPTZ,
  delivered_message_id UUID,
  feedback_score     INT,
  feedback_at        TIMESTAMPTZ,
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

### Migration 4: 봇 rename + avatar 업데이트 + get_user_related_messages RPC

```sql
-- 봇 rename
UPDATE public.profiles
SET
  name       = 'MINT',
  avatar_url = '/mint-logo-avatar.svg'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- RPC: 본인 관련 메시지 수집 (SECURITY DEFINER — 서비스 역할로 실행)
CREATE OR REPLACE FUNCTION get_user_related_messages(
  p_user_id UUID,
  p_since   TIMESTAMPTZ,
  p_limit   INT DEFAULT 200
)
RETURNS TABLE (
  id           UUID,
  room_id      UUID,
  room_name    TEXT,
  sender_id    UUID,
  sender_name  TEXT,
  content      TEXT,
  created_at   TIMESTAMPTZ
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
    AND m.message_type = 'text'        -- 일반 메시지만 (NULL IN 버그 수정)
    AND m.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM room_members rm
      WHERE rm.room_id = m.room_id AND rm.user_id = p_user_id
    )
    AND p.is_bot = FALSE               -- 봇 발신 메시지 제외
  ORDER BY m.created_at DESC
  LIMIT p_limit;
END;
$$;
```

---

## 3. Edge Function

### 파일 구조

```
supabase/functions/daily-briefing/
  locales.ts   ← 6개 언어 locale map
  index.ts     ← 메인 핸들러
```

### locales.ts

6개 언어 (`ko | en | zh | ja | ru | uz`) 각각에 대해:
- `systemPrompt` — GPT에게 전달할 언어별 지시문 (COMMON_RULES + 출력 언어 지정)
- `greeting(name)` — 전송 메시지 인사말
- `summary(msgCount, itemCount)` — 전송 메시지 요약 문구

`getLocale(lang)` 함수가 `preferred_language` 를 받아 해당 locale 반환. null/undefined/미지원 언어는 `ko` fallback.

### index.ts 핵심 플로우

```
Deno.serve(async (req) => {
  1. Authorization: Bearer 헤더 체크
  2. today = new Date().toISOString().split('T')[0]
  3. profiles WHERE is_bot = false 전체 조회 (id, name, preferred_language)
  
  for each user:
    a. ai_briefings에 today 브리핑 이미 있으면 skip
    b. get_user_related_messages RPC (since 24h ago, limit 200)
    c. 메시지 없으면 skip
    d. getLocale(user.preferred_language)
    e. GPT-4o-mini 호출:
       - model: 'gpt-4o-mini'
       - messages: [system: locale.systemPrompt, user: formatted messages]
       - response_format: { type: 'json_object' }
       - temperature: 0.2
    f. items = parsed.items || []  → 0개면 skip
    g. INSERT ai_briefings
    h. getOrCreateMintRoom(supabase, user.id)
       → rooms WHERE room_type = 'mint_dm' + room_members WHERE user_id = user.id
       → 없으면 INSERT rooms(room_type='mint_dm') + INSERT room_members × 2
    i. INSERT messages:
       - message_type: 'mint_briefing'
       - payload: {
           briefing_id, locale, greeting, summary,
           message_count, items
         }
       - content: locale.greeting(user.name)  ← fallback text
    j. UPDATE ai_briefings SET delivered_at, delivered_message_id
})
```

**중요 수정사항 (spec 대비):**
- `serve` import (std) → `Deno.serve` (네이티브, 기존 bot-respond 패턴)
- `MINT_BOT_USER_ID` env var → 하드코드 `'00000000-0000-0000-0000-000000000001'`

### 환경 변수

```bash
supabase secrets set OPENAI_API_KEY=sk-xxxxx
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 는 자동 주입
```

---

## 4. Cron

```sql
SELECT cron.schedule(
  'mint-daily-briefing',
  '30 23 * * *',   -- KST 08:30 = UTC 23:30
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_functions_url', true) || '/daily-briefing',
    -- app.supabase_functions_url = VITE_SUPABASE_URL + '/functions/v1' (대시보드에서 설정)
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Rollback: `SELECT cron.unschedule('mint-daily-briefing');`

---

## 5. 클라이언트

### BriefingCard.tsx (신규)

`src/components/mint/BriefingCard.tsx`

- `payload.greeting` / `payload.summary` — Edge Function이 이미 사용자 언어로 렌더링한 문자열
- 카테고리 라벨 — `t('briefing.category.{category}')` (i18n)
- "채팅 보기" / "전체 일정 보기" — `t('briefing.viewChat')` / `t('briefing.viewAll')`
- 프라이버시 문구 — `t('briefing.privacy')` + `t('briefing.learnMore')`
- 👍/👎 피드백 — `supabase.from('ai_briefings').update({ feedback_score })` via `briefing_id`
- "채팅 보기" 클릭 → `chatEvents.emitNavigateToMessage(source_room_id, source_message_id)` 발행

**주의:** 앱에 `/channels/{id}` URL 라우트가 없음. 방 전환은 ChatPage의 `setSelectedRoomId` + `setHighlightMessageId` 상태로 동작. `navigate()` 사용 불가.

### chatEvents 확장 (신규)

`src/lib/aiEvents.ts` 에 방 점프 이벤트 추가:

```ts
type NavigateToMessageHandler = (roomId: string, messageId: string) => void
const navigateToMessageHandlers = new Set<NavigateToMessageHandler>()

export const chatEvents = {
  onNavigateToMessage:   (fn: NavigateToMessageHandler) => { navigateToMessageHandlers.add(fn); return () => { navigateToMessageHandlers.delete(fn) } },
  emitNavigateToMessage: (roomId: string, messageId: string) => navigateToMessageHandlers.forEach(fn => fn(roomId, messageId)),
}
```

`ChatPage.tsx` 에서 구독 추가:
```tsx
useEffect(() => {
  return chatEvents.onNavigateToMessage((roomId, messageId) => {
    handleSelectRoom(roomId)
    setHighlightMessageId(messageId)
  })
}, [])
```

### MessageBubble.tsx 수정

함수 본문 최상단(기존 렌더 전)에 분기 추가:

```tsx
if (message.message_type === 'mint_briefing' && message.payload) {
  return <BriefingCard payload={message.payload as BriefingPayload} />
}
```

### MINT 봇 아바타 렌더링

MessageBubble에서 아바타 렌더링 시 기존 `BOT_USER_ID` 상수 사용 (`src/constants/bot.ts` import):

```tsx
import { BOT_USER_ID } from '../../constants/bot'

{message.sender_id === BOT_USER_ID ? (
  <div className="w-9 h-9 rounded-lg bg-[#f0fdfa] border border-[#ccfbf1] flex items-center justify-center flex-shrink-0">
    <img src="/mint-logo-avatar.svg" alt="MINT" className="w-7 h-7" />
  </div>
) : (
  <Avatar ... />  // 기존 일반 사용자 아바타
)}
```

**사이즈:** 36×36 (w-9 h-9) — 다른 사용자 아바타와 동일.

**SVG 검증:** 구현 시 `/public/mint-logo-avatar.svg` polygon 좌표가 viewBox(0 0 200 200) 가장자리(약 20~180)까지 뻗어 있는지 확인. 그렇지 않으면 다음 좌표로 교체:
```xml
<polygon points="100,20 50,100 100,100" fill="#5eead4"/>
<polygon points="100,20 150,100 100,100" fill="#14b8a6"/>
<polygon points="50,100 100,180 100,100" fill="#0d9488"/>
<polygon points="150,100 100,180 100,100" fill="#134e4a"/>
<line x1="100" y1="20" x2="100" y2="180" stroke="#fff" stroke-width="5"/>
```

### i18n 추가 키 (8개 × 6언어)

| 키 | ko | en | zh | ja | ru | uz |
|----|-----|-----|-----|-----|-----|-----|
| `briefing.category.deadline` | 마감 | Deadline | 截止 | 締切 | Срок | Muddat |
| `briefing.category.action` | 할일 | Action | 待办 | やること | Задача | Vazifa |
| `briefing.category.pending` | 회신 대기 | Pending | 等待回复 | 返信待ち | Ожидание | Kutilmoqda |
| `briefing.category.alert` | 리스크 | Alert | 风险 | リスク | Риск | Xavf |
| `briefing.viewChat` | 채팅 보기 | View chat | 查看聊天 | チャットを見る | Открыть | Chatni ko'rish |
| `briefing.viewAll` | 전체 일정 보기 | View all | 查看全部 | すべて見る | Все события | Hammasini ko'rish |
| `briefing.privacy` | 본인 관련 메시지(DM·멘션·본인 발신)만 분석합니다 | Only your accessible messages are analyzed | 仅分析您可访问的消息 | 自分宛のメッセージのみ分析します | Анализируются только ваши сообщения | Faqat siz kira oladigan xabarlar tahlil qilinadi |
| `briefing.learnMore` | 자세히 | Learn more | 详情 | 詳細 | Подробнее | Batafsil |

### TypeScript 타입 업데이트

`src/types/database.ts` — 3곳의 `message_type` union에 `'mint_briefing'` 추가:
- Row type (line ~208)
- Insert type (line ~232)
- Update type (line ~256)

---

## 6. 검증 체크리스트

### DB
- [ ] `ai_briefings` 테이블 생성 확인
- [ ] `rooms.room_type` 에 'mint_dm' 포함
- [ ] `messages.message_type` 에 'mint_briefing' 포함, `payload` 컬럼 존재
- [ ] RPC `get_user_related_messages` — 본인 관련 메시지만 반환, 봇 메시지 제외
- [ ] cron job 등록: `SELECT * FROM cron.job;`

### Edge Function
- [ ] 수동 트리거 → ai_briefings row 생성
- [ ] MINT DM 방에 mint_briefing 메시지 도착
- [ ] `preferred_language='zh'` 사용자 → 중국어 브리핑
- [ ] `preferred_language='ru'` 사용자 → 러시아어 브리핑
- [ ] `preferred_language=NULL` 사용자 → 한국어 fallback
- [ ] `delivered_message_id` 가 messages.id 참조

### UI
- [ ] MINT DM 방에서 BriefingCard 렌더링
- [ ] 4가지 카테고리 색상 배지 표시
- [ ] 카테고리 라벨이 로그인 사용자 UI 언어로 표시
- [ ] "채팅 보기" → 원본 메시지로 점프
- [ ] 👍/👎 → `ai_briefings.feedback_score` 저장
- [ ] MINT 아바타 36×36, mint 배경, 로고 식별 가능
- [ ] 다른 사용자 아바타와 시각 균형

### 프라이버시
- [ ] 본인 미멤버 채널 메시지 미포함
- [ ] 봇 발신 메시지 미포함
- [ ] 다른 사용자 간 private DM 미분석

---

## 7. 롤백

```sql
SELECT cron.unschedule('mint-daily-briefing');
```

Edge Function 비활성화: Supabase Dashboard → Functions → daily-briefing → Pause.  
DB 테이블은 그대로 유지 가능 (다른 기능에서 참조하지 않음).

---

## 8. Phase 2 백로그

- 우선순위 학습 (feedback 데이터 → 프롬프트 튜닝)
- `/mint/briefings` — 과거 브리핑 히스토리 페이지
- 브리핑 시간 사용자 커스터마이즈
- 주간 리포트 (매주 월요일)
- deadline 항목 캘린더 자동 등록
