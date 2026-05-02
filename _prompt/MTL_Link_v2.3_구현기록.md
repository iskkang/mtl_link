# MTL Link v2.3 구현 기록

> 이 세션에서 추가·수정된 기능 전체를 기록한다.  
> 작성일: 2026-05-02  
> 대상 브랜치: `main`

---

## 0. 세션 요약

| 분류 | 내용 |
|------|------|
| UI 개선 | 언어 코드 → 국가 깃발 이모지 전환, 모바일 반응형 |
| 알림 | Web Push (VAPID + Service Worker) 완전 구현 |
| 번역 | 시스템 프롬프트 단순화, DB 캐시 직접 조회 버그 수정 |
| PWA | 아이콘·manifest·설치 배너·설치 안내 페이지 |
| 기타 | 메시지 버블 깃발 중복 제거, 음성 메시지 UI 정리 |

---

## 1. UI 개선 — 깃발 이모지 + 모바일 반응형

### 1-1. 깃발 유틸리티 (`src/lib/langFlags.ts`)

언어 코드를 국가 깃발 이모지로 변환하는 유틸리티를 새로 추가했다.

```ts
export const LANG_FLAGS: Record<string, string> = {
  ko: '🇰🇷', en: '🇬🇧', ru: '🇷🇺', uz: '🇺🇿', zh: '🇨🇳', ja: '🇯🇵',
}
export const getLangFlag = (lang: string) => LANG_FLAGS[lang] ?? '🌐'
```

적용 위치:
- `ChatWindow.tsx` — 헤더 언어 버튼, 부제목 상태 표시
- `MessageBubble.tsx` — 타임스탬프 옆 번역 방향 배지
- `RoomListItem.tsx` — 방 목록 언어 배지

### 1-2. 메시지 버블 깃발 중복 제거

이전에는 버블 **내부**와 **타임스탬프 옆** 두 곳에 깃발이 표시됐다.  
버블 내부의 `{/* 번역 방향 깃발 배지 */}` 블록을 삭제하고 타임스탬프 옆에만 유지했다.

2단 레이아웃 원문 텍스트에 `opacity: 0.55` 추가 → 번역문과 원문의 시각적 계층 구분.

### 1-3. 모바일 반응형 수정

| 파일 | 변경 내용 |
|------|-----------|
| `ChatWindow.tsx` | Light/Dark 토글 `hidden md:flex` (모바일에서 숨김) |
| `MessageBubble.tsx` | 버블 최대 너비 `max-w-[85%] md:max-w-[70%]`, 행 패딩 `px-2 md:px-3` |
| `MessageActionBar.tsx` | 액션바 패딩 `px-2 md:px-3 py-1 md:py-1.5` |
| `MessageInput.tsx` | `paddingBottom: max(0.5rem, env(safe-area-inset-bottom))` — iOS 노치 대응 |
| `src/index.css` | `.safe-bottom` 유틸리티 클래스 추가 |

---

## 2. Web Push 알림

### 2-1. VAPID 키 생성

```bash
npx web-push generate-vapid-keys
```

생성된 키를 `.env.local`에 저장:

```
VITE_VAPID_PUBLIC_KEY=BF3GQjtRYPZ2S2ch...
```

Supabase 환경변수 등록:

```powershell
$env:SUPABASE_ACCESS_TOKEN='...'
npx supabase secrets set VAPID_PUBLIC_KEY=... --project-ref zidkckbabtajpgkhxmfm
npx supabase secrets set VAPID_PRIVATE_KEY=... --project-ref zidkckbabtajpgkhxmfm
npx supabase secrets set VAPID_SUBJECT=mailto:iskang@mtlb.co.kr --project-ref zidkckbabtajpgkhxmfm
```

### 2-2. DB 마이그레이션

```sql
-- supabase/migrations/20260503200000_push_subscriptions.sql
create table public.push_subscriptions (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh   text not null,
  auth     text not null,
  created_at timestamptz not null default now(),
  unique(user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
```

### 2-3. 구현 파일

| 파일 | 역할 |
|------|------|
| `public/sw.js` | Service Worker — push 수신, notificationclick 처리, install/activate/fetch (PWA 캐싱) |
| `src/services/pushNotificationService.ts` | 브라우저 구독 등록/해제, DB upsert |
| `supabase/functions/send-push-notification/index.ts` | Deno Edge Function — 방 멤버에게 푸시 발송 |
| `src/types/database.ts` | `push_subscriptions` 테이블 타입 추가 |

### 2-4. 핵심 버그 수정

- **Chrome AES 인코딩 오류**: `sendNotification()` 에 `{ contentEncoding: 'aes128gcm' }` 옵션 추가
- **TypeScript 타입 오류**: `urlBase64ToUint8Array` 반환형을 `Uint8Array<ArrayBuffer>`로 고정 (for 루프 방식)
- `npm:web-push@3.6.7` 버전 고정 (Deno)

---

## 3. 번역 시스템 개선

### 3-1. 시스템 프롬프트 단순화

기존의 "물류 전문 번역가" 프롬프트가 일반 메시지("안녕하세요" 등)에 대해 영어 거절 메시지를 반환하는 문제가 있었다.

두 Edge Function 모두 단순 번역 프롬프트로 교체:

```
You are a translator. Translate from {src} to {tgt}.
- Output ONLY the translated text
- ALWAYS output the translation
- Translate casual messages naturally too
```

적용 파일:
- `supabase/functions/translate-text/index.ts`
- `supabase/functions/voice-translate/providers/claude.ts`

### 3-2. DB 번역 캐시 직접 조회 (핵심 버그 수정)

**증상**: DB `message_translations`에 번역이 정상 저장돼 있어도 UI에 표시 안 됨.

**원인**: `MSG_SELECT`에 `message_translations` join이 없어 매번 Edge Function을 호출했고, Edge Function이 실패하면 번역이 표시되지 않았다.

**수정 내용**:

1. `MSG_SELECT`에 translations join 추가:
```ts
// src/stores/messageStore.ts
export const MSG_SELECT = `
  *,
  sender:profiles!sender_id(id, name, avatar_url),
  attachments:message_attachments(*),
  reply_message:reply_to_id(...),
  translations:message_translations(language, translated_text)  // ← 추가
`
```

2. `MessageWithSender` 타입에 `translations` 필드 추가:
```ts
// src/types/chat.ts
translations?: { language: string; translated_text: string }[]
```

3. `upsertMessage`에서 translations 보존 (Realtime 원시 payload로 덮어쓰기 방지):
```ts
translations: incoming.translations ?? next[idIdx].translations,
```

4. `useMessageTranslation` 번역 조회 우선순위 변경:
```
① 메모리 캐시 → ② message.translations (DB join) → ③ Edge Function 호출
```

---

## 4. PWA 완전 구현

### 4-1. 아이콘 생성

`sharp` 패키지로 `public/mtl-logo.png`에서 자동 생성:

```bash
npm install -D sharp
node scripts/generate-pwa-icons.cjs
```

생성된 파일:
- `public/icons/icon-{72,96,128,144,152,192,384,512}x*.png` (흰 배경)
- `public/icons/maskable-{...}x*.png` (navy `#1e293b` 배경, 10% 여백)
- `public/apple-touch-icon.png` (180×180)
- `public/favicon-32x32.png`, `public/favicon-16x16.png`

### 4-2. manifest.webmanifest

```json
{
  "name": "MTL Link",
  "short_name": "MTL Link",
  "display": "standalone",
  "background_color": "#1e293b",
  "theme_color": "#1e293b",
  "icons": [
    { "src": "/icons/icon-192x192.png", "purpose": "any" },
    { "src": "/icons/maskable-192x192.png", "purpose": "maskable" },
    { "src": "/icons/icon-512x512.png", "purpose": "any" },
    { "src": "/icons/maskable-512x512.png", "purpose": "maskable" }
  ]
}
```

### 4-3. index.html PWA 메타태그

```html
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="theme-color" content="#1e293b" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="MTL Link" />
```

### 4-4. Service Worker PWA 캐싱 (`public/sw.js`)

```js
const CACHE_NAME = 'mtl-link-v1'
const PRECACHE = ['/', '/manifest.webmanifest', '/icons/icon-192x192.png', ...]

self.addEventListener('install',  e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE))) })
self.addEventListener('activate', e => { e.waitUntil(/* 이전 캐시 삭제 */ ... .then(() => self.clients.claim())) })
self.addEventListener('fetch',    e => { /* 캐시 우선, 오프라인 fallback */ })
```

### 4-5. 설치 유도 배너 (`src/components/ui/InstallBanner.tsx`)

`beforeinstallprompt` 이벤트를 가로채 인앱 설치 배너를 표시한다.  
`localStorage.install-banner-dismissed === 'true'` 또는 이미 standalone 모드이면 숨긴다.

```tsx
window.addEventListener('beforeinstallprompt', handler)
// "설치" 버튼 → deferredPrompt.prompt()
// "닫기" 버튼 → localStorage.setItem('install-banner-dismissed', 'true')
```

`App.tsx`에 `<InstallBanner />` 마운트.  
`main.tsx`에 `appinstalled` 이벤트 핸들러 추가.

---

## 5. PWA 설치 안내 페이지 (`/install`)

### 5-1. 라우트

```tsx
// src/routes.tsx — 로그인 불필요
<Route path="/install" element={<InstallPage />} />
```

### 5-2. 페이지 구성 (`src/pages/InstallPage.tsx`)

| 섹션 | 내용 |
|------|------|
| 언어 선택 | 상단 6개 언어 버튼 (탭 즉시 전환) |
| 카카오톡 경고 | 항상 표시. KakaoTalk UA 감지 시 빨간색, 일반 시 주황색 |
| Android / iPhone 탭 | 탭 전환으로 각 3단계 설치 가이드 |
| QR 코드 | `qrcode.react` 클라이언트 렌더링, `window.location.origin/install` 인코딩 |
| 앱으로 이동 | `/login` 링크 버튼 |

```tsx
// KakaoTalk 감지
const isKakaoTalk = /KAKAOTALK/i.test(navigator.userAgent)
```

### 5-3. 다국어 (i18n)

6개 언어 모두 install 전용 키 추가:  
`installTitle`, `installAndroid`, `installIphone`,  
`installAndStep{1,2,3}`, `installIosStep{1,2,3}`,  
`installKakaoTitle`, `installKakaoDesc`,  
`installQrTitle`, `installQrDesc`, `installGoApp`

---

## 6. 패키지 추가

```json
// package.json — dependencies
"qrcode.react": "^3.x"

// devDependencies
"sharp": "^0.x"
```

---

## 7. Supabase 배포 명령어

```powershell
$env:SUPABASE_ACCESS_TOKEN='<token>'
$REF = 'zidkckbabtajpgkhxmfm'

# 환경변수 등록 (최초 1회)
npx supabase secrets set VAPID_PUBLIC_KEY=BF3GQjtR... --project-ref $REF
npx supabase secrets set VAPID_PRIVATE_KEY=Lc9cLOX... --project-ref $REF
npx supabase secrets set VAPID_SUBJECT=mailto:iskang@mtlb.co.kr --project-ref $REF

# DB 마이그레이션
npx supabase db push --project-ref $REF

# Edge Function 배포
npx supabase functions deploy send-push-notification --project-ref $REF --no-verify-jwt
npx supabase functions deploy translate-text         --project-ref $REF --no-verify-jwt
npx supabase functions deploy voice-translate        --project-ref $REF --no-verify-jwt
```

---

## 8. 파일 변경 목록

### 신규 생성

| 파일 | 설명 |
|------|------|
| `src/lib/langFlags.ts` | 언어 → 깃발 이모지 유틸리티 |
| `src/services/pushNotificationService.ts` | 브라우저 Push 구독 서비스 |
| `src/components/ui/InstallBanner.tsx` | PWA 설치 유도 배너 |
| `src/pages/InstallPage.tsx` | `/install` 설치 안내 페이지 |
| `public/manifest.webmanifest` | PWA manifest |
| `public/sw.js` (확장) | Service Worker (push + PWA 캐싱) |
| `public/icons/` | 아이콘 18개 (일반 + maskable) |
| `public/apple-touch-icon.png` | iOS 아이콘 |
| `public/favicon-32x32.png` | 파비콘 32px |
| `public/favicon-16x16.png` | 파비콘 16px |
| `scripts/generate-pwa-icons.cjs` | sharp 기반 아이콘 생성 스크립트 |
| `supabase/functions/send-push-notification/index.ts` | Push 발송 Edge Function |
| `supabase/migrations/20260503200000_push_subscriptions.sql` | push_subscriptions 테이블 |

### 주요 수정

| 파일 | 수정 내용 |
|------|-----------|
| `src/types/chat.ts` | `MessageWithSender.translations` 필드 추가 |
| `src/stores/messageStore.ts` | MSG_SELECT translations join, upsertMessage 보존 |
| `src/hooks/useMessageTranslation.ts` | DB 번역 우선 조회, deps 정리 |
| `src/components/chat/MessageBubble.tsx` | 깃발 중복 제거, 원문 opacity, 반응형 패딩 |
| `src/components/chat/MessageActionBar.tsx` | 모바일 패딩 반응형 |
| `src/components/chat/MessageInput.tsx` | iOS safe-area-inset-bottom |
| `src/components/layout/ChatWindow.tsx` | Light/Dark 토글 모바일 숨김, 깃발 헤더 |
| `src/App.tsx` | `<InstallBanner />` 마운트 |
| `src/main.tsx` | appinstalled 이벤트 핸들러 |
| `src/routes.tsx` | `/install` 라우트 추가 |
| `src/lib/i18n.ts` | install 페이지 번역 키 6개 언어 추가 |
| `index.html` | PWA 메타태그 추가 |
| `supabase/functions/translate-text/index.ts` | 시스템 프롬프트 단순화 |
| `supabase/functions/voice-translate/providers/claude.ts` | 시스템 프롬프트 단순화 |

---

## 9. 테스트 체크리스트

### 번역
- [ ] Info(zh) 화면에서 ko 메시지가 중국어 2단으로 표시되는지
- [ ] 새로고침 후에도 DB에서 바로 번역 표시되는지 (Edge Function 호출 없이)
- [ ] 일반 인사말("안녕하세요")이 번역되는지 (메타 응답 없이)

### Web Push
- [ ] 알림 권한 허용 후 `push_subscriptions` 테이블에 row 생성 확인
- [ ] 다른 기기에서 메시지 수신 시 Push 알림 도착
- [ ] 앱 미사용 중(백그라운드) 알림 도착

### PWA
- [ ] 안드로이드 Chrome에서 "MTL Link 앱 설치" 배너 표시
- [ ] 설치 후 홈 화면 아이콘 확인 (navy 배경 + 로고)
- [ ] 설치된 앱 실행 시 주소창 없이 풀스크린 실행
- [ ] `/install` 접근 시 로그인 없이 설치 가이드 표시
- [ ] 6개 언어 전환 정상 동작
- [ ] QR 코드 스캔으로 `/install` 접근 가능
