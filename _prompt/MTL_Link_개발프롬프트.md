# MTL Link 개발 프롬프트

> v1 원본 → v2 보강 → v2.1 메뉴바·음성번역 → v2.2 추가 기능까지 통합한 최종본.
> 최종 업데이트: 2026-05-02
> 이 문서 한 개로 전체 개발을 진행한다.

---

## 0. 현재 구현 완료 상태 (2026-05-02)

> 이 섹션은 현재까지 구현 완료된 내용을 요약한다. §5~§32는 설계 원본.

### 구현 완료된 컴포넌트 / 서비스 / 훅 전체 목록

**Pages**
- `LoginPage.tsx` — 이메일/비밀번호 로그인
- `ChangePasswordPage.tsx` — 첫 로그인 비밀번호 변경
- `ChatPage.tsx` — 메인 채팅 페이지
- `AdminPage.tsx` — 관리자 직원 관리 + 가입 신청 승인/거절
- `SignUpPage.tsx` — 셀프 가입 신청 (v2.2)
- `PendingPage.tsx` — 가입 신청 대기 안내 (v2.2)
- `RejectedPage.tsx` — 가입 거절 안내 (v2.2)

**Layout**
- `AppLayout.tsx`, `Sidebar.tsx`, `ChatWindow.tsx`, `ProtectedRoute.tsx`
- `SidebarTabs.tsx` — 채팅방 / 친구 탭 전환 (v2.2)

**Chat Components**
- `RoomList.tsx`, `RoomListItem.tsx` — 방 목록
- `MessageList.tsx` — 메시지 렌더링 (가상 스크롤링 없음, 페이지네이션)
- `MessageBubble.tsx` — 메시지 버블 (음성번역 토글, 텍스트자동번역, 답장인용)
- `MessageInput.tsx` — 텍스트 입력창
- `MessageActionBar.tsx` — 이모지·파일·음성·OCR 버튼 바
- `MessageMenu.tsx` — 메시지 우클릭/호버 메뉴 (수정·삭제·답장)
- `MessageEditInput.tsx` — 인라인 메시지 수정
- `MessageSearchBar.tsx` — 방 내 검색 바 (v2.2)
- `GlobalSearchPanel.tsx` — 전체 검색 패널 (v2.2)
- `QuotedMessage.tsx` — 인용 답장 원본 표시
- `ReplyPreview.tsx` — 입력 중 답장 대상 미리보기
- `ReadReceipt.tsx` — 읽음 표시 컴포넌트
- `NewRoomModal.tsx`, `UserPicker.tsx` — 방 생성
- `DeleteRoomModal.tsx`, `LeaveRoomModal.tsx` — 방 삭제·나가기
- `RoomMenu.tsx` — 방 헤더 ⋮ 메뉴
- `TranslationLanguageModal.tsx` — 번역 언어 설정
- `DragDropZone.tsx` — 드래그앤드롭
- `AttachmentPreview.tsx`, `PendingFilesPreview.tsx` — 첨부 미리보기
- `ImageModal.tsx` — 이미지 확대 모달 (v1.5)
- `FilePreview.tsx` — PDF·파일 미리보기 (v1.5)
- `LinkPreviewCard.tsx` — 링크 OG 카드 (v1.5)
- `OcrButton.tsx` — OCR 번역 버튼 (v2.2)
- `FriendsList.tsx`, `FriendItem.tsx`, `FriendProfileModal.tsx` — 친구·연락처 (v2.2)
- `DeleteMessageModal.tsx` — 메시지 삭제 확인

**Voice**
- `VoiceRecorderButton.tsx`, `RecordingIndicator.tsx`, `VoicePermissionModal.tsx`

**Emoji**
- `EmojiPickerPopup.tsx`

**UI**
- `Button.tsx`, `Input.tsx`, `Modal.tsx`, `Avatar.tsx`, `Toast.tsx`, `Spinner.tsx`
- `LanguageSwitcher.tsx` — 6개 언어 UI 전환 (v2.2)
- `NotificationToggle.tsx`, `NotificationPrompt.tsx` — 브라우저 알림

**Stores**
- `roomStore.ts` — 방 목록 상태
- `messageStore.ts` — 메시지 상태 + `setTranslation`

**Services**
- `authService.ts`, `profileService.ts`, `roomService.ts`
- `messageService.ts` — 텍스트·파일 메시지 전송
- `storageService.ts`, `adminService.ts`
- `translationService.ts` — 텍스트 자동 번역 API 호출 (v2.2)
- `voiceMessageService.ts` — 음성 번역 메시지 전송
- `ocrService.ts` — OCR 번역 메시지 전송 (v2.2)
- `searchService.ts` — 글로벌 메시지 검색 (v2.2)
- `friendsService.ts` — 친구/직원 목록 (v2.2)

**Hooks**
- `useAuth.ts`, `useRooms.ts`, `useMessages.ts`
- `useRealtimeMessages.ts`, `useRealtimeRooms.ts`
- `useSignedUrl.ts`, `useToast.ts`
- `useMicrophonePermission.ts`, `useMediaRecorder.ts`
- `useReadStatus.ts` — 읽음 상태 관리 (v1.5)
- `usePresence.ts` — 사용자 온라인 상태 (v2.2)
- `useMessageTranslation.ts` — 텍스트 자동 번역 훅 (v2.2)
- `useMessageSearch.ts` — 방 내 메시지 검색 훅 (v2.2)
- `useGlobalMessageMonitor.ts` — 브라우저 알림 모니터

**Contexts**
- `AuthContext.tsx`
- `ThemeContext.tsx` — 다크/라이트 테마 (v2.2)

**Lib**
- `supabase.ts`, `fileValidation.ts`, `linkify.ts`, `date.ts`, `errors.ts`, `logger.ts`
- `i18n.ts` — react-i18next 6개 언어 설정 (v2.2)

**Edge Functions (총 6개)**
- `admin-create-user/` — 직원 추가
- `voice-translate/` — 음성 STT + 번역
- `translate-text/` — 텍스트 자동 번역 (v2.2)
- `ocr-translate/` — OCR + 번역 (v2.2)
- `fetch-link-preview/` — 링크 미리보기 (v1.5)
- `send-signup-notification/` — 가입 신청 알림 (v2.2)

---

## 1. 역할 지정

너는 시니어 풀스택 개발자다. React, Vite, TypeScript, Tailwind CSS, Supabase (Auth·Postgres·Realtime·Storage·Edge Functions), OpenAI Whisper, Anthropic Claude를 사용해 웹 기반 사내 메신저를 개발한다.

MoveTalk과는 **별도의 Supabase 프로젝트**로 운영하는 독립 웹 메신저다.

---

## 2. 프로젝트 목표

직원들이 로그인해서 1:1 또는 그룹 채팅을 하고, 텍스트·이미지·문서·링크를 주고받으며, **음성으로 말하면 상대방 언어로 자동 번역되어 전송**되고, 모든 메시지와 첨부파일이 방별로 저장되는 웹 기반 사내 메신저.

---

## 3. 기술 스택

```text
React 18 + Vite + TypeScript (strict)
Tailwind CSS
React Router v6
@supabase/supabase-js v2
Lucide React
date-fns + date-fns-tz
react-hook-form + zod
Zustand
react-i18next (ko 우선)
emoji-picker-react
MediaRecorder API (브라우저 기본)
OpenAI Whisper API   ← Edge Function 내부에서만
Anthropic Claude Haiku ← Edge Function 내부에서만
```

---

## 4. 개발 원칙

1. 코드는 실제 실행 가능한 수준으로 작성한다.
2. 파일 단위로 명확하게 작성한다.
3. DB 비즈니스 로직은 트리거·함수를 신뢰하고 클라이언트에서 중복 처리하지 않는다.
4. **Service Role Key는 프론트엔드에 절대 넣지 않는다** (Edge Function 전용).
5. **OpenAI·Anthropic API Key도 Edge Function 시크릿에만** 보관.
6. UI는 WhatsApp Web 유사한 다크모드 기반.
7. 모바일 네이티브 앱이 아니라 웹앱으로 개발한다.
8. **모든 비동기 작업은 try/catch + 에러 처리 + 로딩 상태**를 갖춘다.
9. `any` 사용 금지. 타입 안전성 우선.
10. **음성 파일은 Edge Function 메모리에서만 처리. DB·Storage 저장 금지.**

---

## 5. v1 필수 기능

### 인증
- 이메일/비밀번호 로그인 · 로그아웃
- 첫 로그인 시 비밀번호 변경 강제 (`profiles.must_change_password`)
- 비로그인 사용자는 모든 페이지 차단

### 사용자
- 직원 프로필 조회 (이름·부서·직급·아바타)
- 직원 목록 조회 (active만)

### 채팅방
- 1:1 채팅방 (`get_or_create_direct_room` 함수)
- 그룹 채팅방 (`create_group_room` 함수)
- 방 목록 최근순 + 안 읽은 카운트
- 방별 참여자 표시

### 메시지
- 텍스트 메시지 전송 (최대 4,000자)
- Optimistic UI + Realtime 동기화
- 본인 메시지 soft delete

### 메뉴바 (v2.1)
- 입력창 위 액션 바: 이모지 · 파일 · 음성번역 버튼
- 채팅 영역 드래그앤드롭 파일 업로드

### 첨부파일
- 이미지·문서·압축파일 업로드 (확장자 + MIME + 크기 3중 검증)
- 최대 5개 / Signed URL 다운로드
- 이미지 썸네일 / 파일 카드 UI

### 음성 번역 (v2.1)
- 마이크 버튼 → 녹음 → STT(Whisper) → 번역(Claude) → 메시지 전송
- 최대 60초 녹음
- 메시지 버블에 "원본 보기" 토글

### 번역 설정 (v2.1)
- 수신자별 번역 언어 설정 모달
- 그룹방 owner의 default 언어 설정

### 링크
- URL 자동 감지 → `<a>` 태그, 새 탭 열기

### 관리자
- `/admin` 페이지: 직원 추가(Edge Function) · 비활성화

---

## 5-2. v2.2 추가 구현 기능 (현재 완료)

### 텍스트 자동 번역
- 수신 메시지의 `source_language`가 내 `preferred_language`와 다를 때 `translate-text` Edge Function 호출
- `useMessageTranslation` 훅: 세션 캐시(`Map`) + 중복 요청 방지 → `messageStore.setTranslation` 저장
- 메시지 버블에 번역문 2단 레이아웃 (원본 italic 회색 + 구분선 + 번역)

### OCR 번역
- `OcrButton.tsx`: 메뉴바에 OCR 아이콘 버튼 추가
- 이미지 선택 → `ocrService.sendOcrTranslation()` → `ocr-translate` Edge Function → `text_translated` 메시지 insert
- 지원 형식: JPG, PNG, WEBP, GIF (최대 10MB)

### 메시지 검색 (카카오톡 스타일)
- `MessageSearchBar.tsx`: 채팅창 상단에 검색 바 토글
- `useMessageSearch`: 300ms debounce, 현재 방 메시지에서 클라이언트 사이드 필터링
- content + content_original + _translatedText 모두 검색
- 이전/다음 내비게이션, 하이라이트 스크롤

### 전체 채팅 검색
- `GlobalSearchPanel.tsx`: 사이드바 검색 아이콘 → 전체 패널
- `searchService.ts`: Supabase DB 쿼리 (참여한 방만, RLS 보장)

### 친구/연락처 탭
- `SidebarTabs.tsx`: 사이드바에 채팅방 / 직원 탭 전환
- `FriendsList.tsx`, `FriendItem.tsx`: 활성 직원 목록, 부서·직급 표시
- `FriendProfileModal.tsx`: 직원 프로필 + 1:1 채팅 시작 버튼

### 회원가입 신청 흐름
- `SignUpPage.tsx`: 이메일·이름·부서·직급 입력 → `signup_requests` 테이블에 pending 저장
- `send-signup-notification` Edge Function: 관리자에게 알림 메일
- `AdminPage.tsx`: 신청 목록 표시, 승인(→ admin-create-user) / 거절 처리
- 승인 후 `PendingPage.tsx` / 거절 후 `RejectedPage.tsx` 안내

### 다크/라이트 테마
- `ThemeContext.tsx`: `localStorage` 저장, 사이드바 하단 토글
- Tailwind `dark:` 클래스 전체 적용

### 6개 언어 UI
- `i18n.ts`: ko/en/ru/zh/ja/uz 번역 파일
- `LanguageSwitcher.tsx`: 사이드바 하단 언어 선택 드롭다운

### 사용자 프레즌스
- `usePresence.ts`: Supabase Realtime Presence channel
- 사이드바 아바타 옆 초록 점 표시

### 읽음 표시 (v1.5)
- `ReadReceipt.tsx`: 1:1 방 ✓✓ 파란 체크 / 그룹방 읽은 인원 숫자
- `useReadStatus.ts`: `room_members.last_read_at` 기준, Realtime broadcast 갱신

### 답장 인용 (v1.5)
- `messages.reply_to_id` 컬럼 (FK → messages.id)
- `QuotedMessage.tsx`: 인용 박스 표시
- `ReplyPreview.tsx`: 입력 중 답장 대상 미리보기 바

---

## 6. 현재 미구현 기능 (v3 예정)

음성·영상통화(WebRTC), AI 요약, 메시지 반응(이모지), @멘션, 스레드 답글, 그룹방 멤버별 언어 override, TTS, 모바일 네이티브 앱.

---

## 7. 폴더 구조 (현재 실제 구조)

```text
mtl-link/
  .env.example / .env.local         # gitignore
  package.json
  vite.config.ts / tailwind.config.js / tsconfig.json
  index.html / vercel.json
  supabase/
    config.toml
    migrations/                     # DB 설계서 §14 참고 (28개 파일)
    functions/
      admin-create-user/index.ts
      voice-translate/index.ts + providers/whisper.ts + providers/claude.ts
      translate-text/index.ts       # v2.2
      ocr-translate/index.ts        # v2.2
      fetch-link-preview/index.ts   # v1.5
      send-signup-notification/index.ts  # v2.2
      .env                          # OPENAI_API_KEY, ANTHROPIC_API_KEY, ADMIN_EMAIL
    seed.sql
  src/
    main.tsx / App.tsx / routes.tsx
    lib/
      supabase.ts / fileValidation.ts / linkify.ts
      date.ts / errors.ts / logger.ts
      i18n.ts                       # v2.2: 6개 언어 react-i18next
    types/
      database.ts                   # supabase gen types 자동 생성
      chat.ts                       # MessageWithSender, ReplyRef, RoomListItem 등
    contexts/
      AuthContext.tsx
      ThemeContext.tsx               # v2.2: 다크/라이트 테마
    stores/
      roomStore.ts
      messageStore.ts               # setTranslation 포함
    pages/
      LoginPage.tsx / ChangePasswordPage.tsx / ChatPage.tsx / AdminPage.tsx
      SignUpPage.tsx                 # v2.2: 가입 신청
      PendingPage.tsx                # v2.2: 승인 대기
      RejectedPage.tsx               # v2.2: 거절 안내
    components/
      layout/
        AppLayout.tsx / Sidebar.tsx / ChatWindow.tsx / ProtectedRoute.tsx
      chat/
        RoomList.tsx / RoomListItem.tsx
        SidebarTabs.tsx              # v2.2: 채팅방·친구 탭
        MessageList.tsx
        MessageBubble.tsx            # 음성번역 토글·텍스트자동번역·답장인용
        MessageInput.tsx
        MessageActionBar.tsx         # 이모지·파일·음성·OCR 버튼 바
        MessageMenu.tsx              # 수정·삭제·답장 메뉴
        MessageEditInput.tsx         # 인라인 수정
        MessageSearchBar.tsx         # v2.2: 방 내 검색
        GlobalSearchPanel.tsx        # v2.2: 전체 검색 패널
        QuotedMessage.tsx            # v1.5: 인용 박스
        ReplyPreview.tsx             # v1.5: 답장 미리보기
        ReadReceipt.tsx              # v1.5: 읽음 표시
        DragDropZone.tsx
        AttachmentPreview.tsx / PendingFilesPreview.tsx
        ImageModal.tsx               # v1.5: 이미지 확대 모달
        FilePreview.tsx              # v1.5: PDF·파일 미리보기
        LinkPreviewCard.tsx          # v1.5: 링크 OG 카드
        OcrButton.tsx                # v2.2: OCR 번역 버튼
        TranslationLanguageModal.tsx
        NewRoomModal.tsx / UserPicker.tsx
        DeleteRoomModal.tsx / LeaveRoomModal.tsx / RoomMenu.tsx
        DeleteMessageModal.tsx
        FriendsList.tsx / FriendItem.tsx / FriendProfileModal.tsx  # v2.2
      emoji/
        EmojiPickerPopup.tsx
      voice/
        VoiceRecorderButton.tsx / RecordingIndicator.tsx / VoicePermissionModal.tsx
      ui/
        Button.tsx / Input.tsx / Modal.tsx / Avatar.tsx
        Toast.tsx / Spinner.tsx / EmptyState.tsx
        LanguageSwitcher.tsx         # v2.2: 언어 전환
        NotificationToggle.tsx / NotificationPrompt.tsx  # v1.5
    services/
      authService.ts / profileService.ts / roomService.ts
      messageService.ts / storageService.ts / adminService.ts
      translationService.ts         # 텍스트 자동 번역 API 호출
      voiceMessageService.ts        # 음성 번역
      ocrService.ts                 # v2.2: OCR 번역
      searchService.ts              # v2.2: 글로벌 검색
      friendsService.ts             # v2.2: 직원 목록
    hooks/
      useAuth.ts / useRooms.ts / useMessages.ts
      useRealtimeMessages.ts / useRealtimeRooms.ts
      useSignedUrl.ts / useToast.ts
      useMicrophonePermission.ts / useMediaRecorder.ts
      useReadStatus.ts             # v1.5: 읽음 상태
      usePresence.ts               # v2.2: 온라인 상태
      useMessageTranslation.ts     # v2.2: 텍스트 자동 번역
      useMessageSearch.ts          # v2.2: 방 내 검색
      useGlobalMessageMonitor.ts   # v1.5: 브라우저 알림
```

---

## 8. 환경변수

`.env.example`:
```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_NAME=MTL Link
VITE_ENV=development
```

`supabase/functions/.env` (Edge Function 전용):
```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=     # admin-create-user
SUPABASE_ANON_KEY=
OPENAI_API_KEY=                # voice-translate Whisper
ANTHROPIC_API_KEY=             # voice-translate Claude
```

> 프론트엔드에 절대 넣으면 안 되는 것: `SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`

---

## 9. Supabase 클라이언트 (`src/lib/supabase.ts`)

```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) throw new Error('Missing Supabase environment variables');

export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  realtime: { params: { eventsPerSecond: 10 } },
});
```

타입 자동 생성:
```bash
npx supabase gen types typescript --project-id <ref> > src/types/database.ts
```

마이그레이션 적용 후 재생성 필수 (특히 v2.1 마이그레이션 후).

---

## 10. 핵심 타입 (`src/types/chat.ts`)

```ts
import type { Database } from './database';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Room = Database['public']['Tables']['rooms']['Row'];
export type RoomMember = Database['public']['Tables']['room_members']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type Attachment = Database['public']['Tables']['message_attachments']['Row'];
export type TranslationPreference = Database['public']['Tables']['translation_preferences']['Row'];

export interface MessageWithSender extends Message {
  sender: Pick<Profile, 'id' | 'name' | 'avatar_url'> | null;
  attachments: Attachment[];
  _localId?: string;
  _status?: 'sending' | 'sent' | 'failed';
}

export interface RoomListItem extends Room {
  members: Pick<Profile, 'id' | 'name' | 'avatar_url'>[];
  unread_count: number;
  is_pinned: boolean;
  last_read_at: string | null;
}
```

---

## 11. UI 요구사항

### 전체 레이아웃
- 좌우 2단: 좌측 방 목록 / 우측 채팅창
- 다크모드 기반 WhatsApp Web 느낌
- 모바일: 방 목록 ↔ 채팅창 페이지 단위 전환

### 좌측 사이드바
- 내 프로필 + 로그아웃
- 새 채팅 버튼
- 방 목록 (이름·마지막 메시지·시간·아이콘·안 읽은 뱃지)

### 우측 채팅창
- 상단: 방 이름 + 번역 언어 표시 (클릭 시 설정 모달)
- 메시지 영역 (무한 스크롤)
- **메뉴바**: 이모지 · 파일 · 음성번역 버튼
- 하단: 텍스트 입력창 + 전송 버튼

### 메시지 버블
- 본인: 오른쪽 정렬, 녹색 배경
- 타인: 왼쪽 정렬, 회색 배경, 이름·아바타
- 시간 표시 (호버 시 절대 시각 툴팁)
- URL 자동 링크화
- 이미지 썸네일 / 파일 카드
- 전송 중: 흐릿 + 시계 / 실패: 빨간 테두리 + 재시도
- **voice_translated 메시지**: "원본 보기" 토글 + `🎤 KO→EN` 표시

### 메뉴바 (v2.1)
```text
입력창 위에 고정 36px 바:
[ 😀 이모지 ] [ 📎 파일 ] [ 🎤 음성번역  수신자: EN ]
```

녹음 중 상태:
```text
[ ✕ 취소 ] [ ● 00:12  ■ 정지 ]
```

---

## 12. 파일 업로드 정책

```text
허용 이미지: jpg, jpeg, png, webp  (최대 10MB)
허용 문서:   pdf, doc, docx, xls, xlsx, csv, ppt, pptx  (최대 30MB)
허용 압축:   zip  (최대 50MB)
한 메시지:   최대 5개 첨부
차단:        exe, bat, cmd, js, msi, scr, ps1, vbs, sh, jar, com
Storage 경로: chat-files/{room_id}/{message_id}/{timestamp}_{file_name}
```

---

## 13. 파일 검증 (`src/lib/fileValidation.ts`)

```ts
const IMAGE_TYPES: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'],
};
const DOCUMENT_TYPES: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'text/csv': ['csv'],
  'application/vnd.ms-powerpoint': ['ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
};
const ARCHIVE_TYPES: Record<string, string[]> = {
  'application/zip': ['zip'], 'application/x-zip-compressed': ['zip'],
};
const SIZE_LIMITS = { image: 10 * 1024 * 1024, document: 30 * 1024 * 1024, archive: 50 * 1024 * 1024 };
const BLOCKED = ['exe','bat','cmd','js','msi','scr','ps1','vbs','sh','jar','com'];

export type AttachmentKind = 'image' | 'document' | 'archive';
export interface ValidationResult { ok: boolean; kind?: AttachmentKind; error?: string; }

export function validateFile(file: File): ValidationResult {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (BLOCKED.includes(ext)) return { ok: false, error: `차단된 확장자: .${ext}` };

  const check = (types: Record<string, string[]>, kind: AttachmentKind, limit: number) => {
    const exts = types[file.type];
    if (!exts) return null;
    if (!exts.includes(ext)) return { ok: false, error: '확장자와 파일 형식이 일치하지 않습니다' };
    if (file.size > limit) return { ok: false, error: `최대 ${limit/1024/1024}MB를 초과합니다` };
    return { ok: true, kind } as ValidationResult;
  };

  return check(IMAGE_TYPES, 'image', SIZE_LIMITS.image)
    ?? check(DOCUMENT_TYPES, 'document', SIZE_LIMITS.document)
    ?? check(ARCHIVE_TYPES, 'archive', SIZE_LIMITS.archive)
    ?? { ok: false, error: '지원하지 않는 파일 형식입니다' };
}

export function validateFiles(files: File[]) {
  if (!files.length) return { ok: false, error: '파일이 없습니다' };
  if (files.length > 5) return { ok: false, error: '한 번에 최대 5개까지 첨부할 수 있습니다' };
  const results = files.map(validateFile);
  const failed = results.find(r => !r.ok);
  if (failed) return { ok: false, error: failed.error, results };
  return { ok: true, results };
}
```

---

## 14. Realtime 구독 패턴 (`src/hooks/useRealtimeMessages.ts`)

4가지 함정 해결: (1) 본인 메시지 중복 (2) 방 변경 시 구독 누수 (3) 첨부파일 race (4) 재연결 누락

```ts
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useMessageStore } from '../stores/messageStore';
import type { Message, Attachment } from '../types/chat';

export function useRealtimeMessages(roomId: string | null) {
  const { upsertMessage, addAttachment, refetchSinceLastSeen } = useMessageStore();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`room:${roomId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const msg = payload.new as Message;
          upsertMessage(roomId, { ...msg, _status: 'sent', sender: null, attachments: [] });
        })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_attachments', filter: `room_id=eq.${roomId}` },
        (payload) => addAttachment(roomId, (payload.new as Attachment).message_id, payload.new as Attachment))
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const msg = payload.new as Message;
          upsertMessage(roomId, { ...msg, _status: 'sent', sender: null, attachments: [] });
        })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') refetchSinceLastSeen(roomId).catch(console.error);
        if (err) console.error('Realtime error:', err);
      });

    channelRef.current = channel;
    return () => { channel.unsubscribe(); channelRef.current = null; };
  }, [roomId, upsertMessage, addAttachment, refetchSinceLastSeen]);
}
```

### Dedupe 로직 (`stores/messageStore.ts`)

```ts
upsertMessage: (roomId, incoming) => set((state) => {
  const list = state.messagesByRoom[roomId] ?? [];
  const idIdx = list.findIndex(m => m.id === incoming.id);
  if (idIdx >= 0) {
    const next = [...list];
    next[idIdx] = { ...next[idIdx], ...incoming, attachments: next[idIdx].attachments };
    return { messagesByRoom: { ...state.messagesByRoom, [roomId]: next } };
  }
  if (incoming._localId) {
    const localIdx = list.findIndex(m => m._localId === incoming._localId);
    if (localIdx >= 0) {
      const next = [...list];
      next[localIdx] = { ...next[localIdx], ...incoming };
      return { messagesByRoom: { ...state.messagesByRoom, [roomId]: next } };
    }
  }
  return {
    messagesByRoom: {
      ...state.messagesByRoom,
      [roomId]: [...list, incoming].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    },
  };
}),
```

---

## 15. 메시지 전송 로직 (`src/services/messageService.ts`)

### 15.1 텍스트 메시지 (Optimistic UI)

```ts
export async function sendTextMessage(roomId: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('메시지가 비어있습니다');
  if (trimmed.length > 4000) throw new Error('메시지는 4,000자 이내로 입력하세요');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증되지 않았습니다');

  const localId = crypto.randomUUID();
  useMessageStore.getState().upsertMessage(roomId, {
    id: localId, _localId: localId, _status: 'sending',
    room_id: roomId, sender_id: user.id, message_type: 'text', content: trimmed,
    created_at: new Date().toISOString(), edited_at: null, deleted_at: null,
    content_original: null, source_language: null, target_language: null, translation_provider: null,
    sender: null, attachments: [],
  });

  try {
    const { data, error } = await supabase.from('messages')
      .insert({ room_id: roomId, sender_id: user.id, message_type: 'text', content: trimmed })
      .select().single();
    if (error) throw error;
    useMessageStore.getState().upsertMessage(roomId, { ...data, _localId: localId, _status: 'sent', sender: null, attachments: [] });
  } catch (err) {
    useMessageStore.getState().updateStatus(roomId, localId, 'failed');
    throw err;
  }
}
```

### 15.2 파일 메시지

```ts
export async function sendFileMessage(roomId: string, files: File[], caption?: string) {
  const validation = validateFiles(files);
  if (!validation.ok) throw new Error(validation.error);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증되지 않았습니다');

  const isImage = validation.results!.every(r => r.kind === 'image');
  const { data: msg, error: msgErr } = await supabase.from('messages')
    .insert({ room_id: roomId, sender_id: user.id, message_type: isImage ? 'image' : 'file', content: caption ?? null })
    .select().single();
  if (msgErr) throw msgErr;

  const results = await Promise.allSettled(files.map(async (file, idx) => {
    const safe = file.name.replace(/[^\w.\-가-힣]/g, '_');
    const path = `${roomId}/${msg.id}/${Date.now()}_${idx}_${safe}`;
    const { error: upErr } = await supabase.storage.from('chat-files').upload(path, file, { contentType: file.type });
    if (upErr) throw upErr;
    const { error: attErr } = await supabase.from('message_attachments').insert({
      message_id: msg.id, room_id: roomId, uploaded_by: user.id,
      file_name: file.name, file_path: path, file_size: file.size, mime_type: file.type,
      attachment_type: validation.results![idx].kind!,
    });
    if (attErr) throw attErr;
  }));

  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length > 0) throw new Error(`${failed.length}개 파일 업로드 실패`);
}
```

---

## 16. Signed URL 캐싱 (`src/hooks/useSignedUrl.ts`)

```ts
const cache = new Map<string, { url: string; expiresAt: number }>();
const TTL_MS = 50 * 60 * 1000;

export async function getSignedFileUrl(filePath: string): Promise<string> {
  const cached = cache.get(filePath);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from('chat-files').createSignedUrl(filePath, 3600);
  if (error || !data) throw error ?? new Error('Signed URL 생성 실패');
  cache.set(filePath, { url: data.signedUrl, expiresAt: Date.now() + TTL_MS });
  return data.signedUrl;
}
```

---

## 17. 공통 에러 처리 (`src/lib/errors.ts`)

```ts
import type { PostgrestError } from '@supabase/supabase-js';

export function getErrorMessage(err: unknown): string {
  if (!err) return '알 수 없는 오류';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && 'message' in err) return String((err as {message: unknown}).message);
  return '알 수 없는 오류';
}

export function isRLSError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as PostgrestError;
  return e.code === 'PGRST301' || !!e.message?.includes('row-level security');
}

export function getUserFriendlyMessage(err: unknown): string {
  const msg = getErrorMessage(err);
  if (isRLSError(err)) return '권한이 없습니다';
  if (msg.includes('JWT expired')) return '세션이 만료되었습니다. 다시 로그인해주세요';
  if (msg.includes('Network')) return '네트워크 오류. 연결을 확인해주세요';
  if (msg.includes('413')) return '파일이 너무 큽니다';
  return msg;
}
```

---

## 18. 엣지 케이스 대응

| 케이스 | 대응 |
|---|---|
| 1:1 방 동시 중복 생성 | `get_or_create_direct_room()` DB 함수가 항상 동일 방 반환 |
| 메시지 입력 중 방 전환 | 입력값을 zustand에 방별 draft로 보관 |
| 첨부 업로드 중 이탈 | `beforeunload` 경고 |
| 네트워크 끊김 후 복귀 | Realtime SUBSCRIBED 이벤트에서 마지막 시각 이후 재조회 |
| 동일 사용자 두 탭 | Realtime 각각 구독 — dedupe 처리로 중복 메시지 없음 |
| JWT 만료 | `onAuthStateChange`로 감지, 자동 갱신 |
| 마이크 권한 거부 | VoicePermissionModal 표시 |
| 음성 60초 초과 | 자동 정지 + 토스트 |
| Whisper/Claude API 오류 | 토스트로 사용자 안내, 메시지 전송 안 됨 |
| 첨부 일부 업로드 실패 | 성공한 것만 저장, 실패 개수 토스트 |

---

## 19. 메뉴바 컴포넌트 (v2.1) — `src/components/chat/MessageActionBar.tsx`

```tsx
import { Smile, Paperclip } from 'lucide-react';
import { useState, useRef } from 'react';
import { EmojiPickerPopup } from '../emoji/EmojiPickerPopup';
import { VoiceRecorderButton } from '../voice/VoiceRecorderButton';
import { validateFiles } from '../../lib/fileValidation';
import { sendFileMessage } from '../../services/messageService';
import { useToast } from '../../hooks/useToast';

interface Props {
  roomId: string;
  disabled?: boolean;
  onEmojiSelect: (emoji: string) => void;
  targetLanguage: string | null;
}

export function MessageActionBar({ roomId, disabled, onEmojiSelect, targetLanguage }: Props) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const result = validateFiles(files);
    if (!result.ok) { toast.error(result.error ?? '파일 검증 실패'); return; }
    try { await sendFileMessage(roomId, files); }
    catch { toast.error('파일 전송 실패'); }
    finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-t border-gray-700 bg-gray-800">
      <div className="relative">
        <button type="button" disabled={disabled} aria-label="이모티콘"
          onClick={() => setEmojiOpen(v => !v)}
          className="p-2 rounded-md hover:bg-gray-700 text-gray-400 hover:text-gray-200 disabled:opacity-40">
          <Smile size={18} />
        </button>
        {emojiOpen && (
          <EmojiPickerPopup
            onSelect={e => { onEmojiSelect(e); setEmojiOpen(false); }}
            onClose={() => setEmojiOpen(false)}
          />
        )}
      </div>

      <button type="button" disabled={disabled} aria-label="파일 첨부"
        onClick={() => fileInputRef.current?.click()}
        className="p-2 rounded-md hover:bg-gray-700 text-gray-400 hover:text-gray-200 disabled:opacity-40">
        <Paperclip size={18} />
      </button>
      <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileSelect} />

      <VoiceRecorderButton roomId={roomId} targetLanguage={targetLanguage} disabled={disabled || !targetLanguage} />

      {targetLanguage && targetLanguage !== 'none' && (
        <span className="ml-auto text-xs text-blue-400">
          번역: {targetLanguage.toUpperCase()}
        </span>
      )}
    </div>
  );
}
```

---

## 20. 이모지 피커 (v2.1) — `src/components/emoji/EmojiPickerPopup.tsx`

```tsx
import { useEffect, useRef } from 'react';
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react';

export function EmojiPickerPopup({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', esc); };
  }, [onClose]);

  return (
    <div ref={ref} className="absolute bottom-12 left-0 z-50 shadow-lg rounded-md overflow-hidden">
      <EmojiPicker theme={Theme.DARK} emojiStyle={EmojiStyle.NATIVE}
        onEmojiClick={d => onSelect(d.emoji)} height={360} width={320} />
    </div>
  );
}
```

---

## 21. 음성 녹음 훅 (v2.1)

### `src/hooks/useMicrophonePermission.ts`

```ts
import { useEffect, useState } from 'react';
export type MicPermissionState = 'unknown' | 'granted' | 'denied' | 'prompt';

export function useMicrophonePermission() {
  const [state, setState] = useState<MicPermissionState>('unknown');
  useEffect(() => {
    if (!navigator.permissions) { setState('prompt'); return; }
    navigator.permissions.query({ name: 'microphone' as PermissionName })
      .then(s => { setState(s.state as MicPermissionState); s.onchange = () => setState(s.state as MicPermissionState); })
      .catch(() => setState('prompt'));
  }, []);

  const request = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setState('granted');
      return true;
    } catch { setState('denied'); return false; }
  };
  return { state, request };
}
```

### `src/hooks/useMediaRecorder.ts` (핵심 부분)

```ts
// 최대 60초 제한 + Blob 반환
const MAX_MS = 60_000;

export function useMediaRecorder() {
  // state: 'idle' | 'recording' | 'processing'
  // start(onAutoStop?) → boolean
  // finish() → Promise<Blob | null>
  // cancel() → void
  // elapsedMs: number
  // ... (전체 구현은 개발 변경분 §7.2 참고)
}
```

---

## 22. 음성 번역 서비스 (v2.1) — `src/services/voiceMessageService.ts`

```ts
export async function sendVoiceTranslatedMessage({ roomId, audioBlob, targetLanguage }: {
  roomId: string; audioBlob: Blob; targetLanguage: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // 1. Edge Function 호출
  const formData = new FormData();
  formData.append('audio', audioBlob, 'voice.webm');
  formData.append('target_language', targetLanguage);
  formData.append('room_id', roomId);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session');

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-translate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`Voice translate failed: ${await res.text()}`);
  const result = await res.json();

  // 2. messages insert
  const { data, error } = await supabase.from('messages').insert({
    room_id: roomId, sender_id: user.id,
    message_type: targetLanguage === 'none' ? 'text' : 'voice_translated',
    content: targetLanguage === 'none' ? result.original_text : result.translated_text,
    content_original: targetLanguage === 'none' ? null : result.original_text,
    source_language: result.source_language,
    target_language: result.target_language,
    translation_provider: 'claude',
  }).select().single();
  if (error) throw error;

  useMessageStore.getState().upsertMessage(roomId, { ...data, sender: null, attachments: [], _status: 'sent' });
  return data;
}
```

---

## 23. Edge Function: voice-translate

`supabase/functions/voice-translate/index.ts`:

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { transcribeWithWhisper } from './providers/whisper.ts';
import { translateWithClaude } from './providers/claude.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return err('Unauthorized', 401);

    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return err('Unauthorized', 401);

    const form = await req.formData();
    const audio = form.get('audio');
    const targetLanguage = String(form.get('target_language') ?? '');
    const roomId = String(form.get('room_id') ?? '');

    if (!(audio instanceof File)) return err('audio required', 400);
    if (!['ko','en','ru','zh','ja','uz','none'].includes(targetLanguage)) return err('invalid target_language', 400);
    if (!roomId) return err('room_id required', 400);

    // 방 멤버 검증
    const { data: member } = await userClient.from('room_members')
      .select('id').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
    if (!member) return err('Not a room member', 403);

    // STT
    const audioBuffer = await audio.arrayBuffer();
    const sttResult = await transcribeWithWhisper(audioBuffer);

    // 번역
    let translatedText = sttResult.text;
    if (targetLanguage !== 'none' && sttResult.language !== targetLanguage) {
      translatedText = await translateWithClaude({ text: sttResult.text, sourceLanguage: sttResult.language, targetLanguage });
    }

    // audioBuffer 참조 해제 (GC)
    return new Response(JSON.stringify({
      ok: true,
      original_text: sttResult.text,
      translated_text: translatedText,
      source_language: sttResult.language,
      target_language: targetLanguage === 'none' ? sttResult.language : targetLanguage,
      provider: 'claude',
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return err(String(e instanceof Error ? e.message : e), 500);
  }
});

function err(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  });
}
```

`supabase/functions/voice-translate/providers/whisper.ts`:

```ts
export async function transcribeWithWhisper(audio: ArrayBuffer) {
  const apiKey = Deno.env.get('OPENAI_API_KEY')!;
  const form = new FormData();
  form.append('file', new Blob([audio], { type: 'audio/webm' }), 'voice.webm');
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions',
    { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form });
  if (!res.ok) throw new Error(`Whisper: ${await res.text()}`);
  const d = await res.json();
  return { text: String(d.text ?? '').trim(), language: normLang(String(d.language ?? 'en')) };
}
function normLang(l: string) {
  const m: Record<string,string> = { korean:'ko', english:'en', russian:'ru', chinese:'zh', japanese:'ja', ko:'ko', en:'en', ru:'ru', zh:'zh', ja:'ja' };
  return m[l.toLowerCase()] ?? 'en';
}
```

`supabase/functions/voice-translate/providers/claude.ts`:

```ts
const LANGS: Record<string,string> = { ko:'Korean', en:'English', ru:'Russian', zh:'Chinese', ja:'Japanese', uz:'Uzbek' };

export async function translateWithClaude({ text, sourceLanguage, targetLanguage }: { text: string; sourceLanguage: string; targetLanguage: string }) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'x-api-key': apiKey, 'anthropic-version':'2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `Translate ${LANGS[sourceLanguage]??sourceLanguage} to ${LANGS[targetLanguage]??targetLanguage}. Preserve business tone and proper nouns (company names, port names, product codes). Output ONLY the translated text.`,
      messages: [{ role: 'user', content: text }],
    }),
  });
  if (!res.ok) throw new Error(`Claude: ${await res.text()}`);
  const d = await res.json();
  return String(d?.content?.[0]?.text ?? '').trim();
}
```

---

## 24. MessageBubble — 원본/번역 토글 (v2.1)

```tsx
import { useState } from 'react';
import { Mic, Globe } from 'lucide-react';
import { linkifyText } from '../../lib/linkify';
import type { MessageWithSender } from '../../types/chat';

export function MessageBubble({ message, isOwn }: { message: MessageWithSender; isOwn: boolean }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const isVoice = message.message_type === 'voice_translated';
  const display = showOriginal && message.content_original ? message.content_original : message.content;

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}>
        {!isOwn && message.sender && (
          <span className="text-xs text-gray-400 mb-1">{message.sender.name}</span>
        )}
        <div className={`px-3 py-2 rounded-lg text-sm whitespace-pre-wrap break-words ${isOwn ? 'bg-emerald-700 text-white' : 'bg-gray-700 text-gray-100'}`}>
          {linkifyText(display ?? '').map((p, i) =>
            typeof p === 'string' ? <span key={i}>{p}</span>
            : <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="underline">{p.href}</a>
          )}
          {showOriginal && message.content_original && (
            <div className="mt-2 pt-2 border-t border-white/20 text-xs opacity-90">
              <div className="opacity-70 mb-0.5">번역</div>
              <div>{message.content}</div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {isVoice && (
            <>
              <button onClick={() => setShowOriginal(v => !v)}
                className="text-xs px-2 py-0.5 rounded-full border border-gray-600 text-gray-400 hover:text-gray-200 hover:bg-gray-700">
                {showOriginal ? '번역만 보기' : '원본 보기'}
              </button>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Mic size={11} /> 음성
              </span>
              {message.source_language && message.target_language && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Globe size={11} />
                  {message.source_language.toUpperCase()} → {message.target_language.toUpperCase()}
                </span>
              )}
            </>
          )}
          <span className="text-xs text-gray-500" title={new Date(message.created_at).toLocaleString()}>
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}
```

---

## 25. 번역 언어 설정 모달 (v2.1) — `TranslationLanguageModal.tsx`

```tsx
const LANGUAGES = [
  { code: 'ko', name: '한국어' }, { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' }, { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' }, { code: 'uz', name: "O'zbek" },
  { code: 'none', name: '번역 안 함' },
];

export function TranslationLanguageModal({ toUserId, toUserName, currentLanguage, onSaved, onClose }:
  { toUserId: string; toUserName: string; currentLanguage: string; onSaved: (l: string) => void; onClose: () => void }) {
  const [selected, setSelected] = useState(currentLanguage);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('translation_preferences').upsert(
      { from_user_id: user.id, to_user_id: toUserId, target_language: selected },
      { onConflict: 'from_user_id,to_user_id' }
    );
    onSaved(selected);
    onClose();
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-5 w-80" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-medium mb-4">{toUserName}에게 번역 언어</h3>
        <div className="space-y-1 mb-4">
          {LANGUAGES.map(l => (
            <label key={l.code} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-700 cursor-pointer">
              <input type="radio" name="lang" value={l.code} checked={selected === l.code} onChange={e => setSelected(e.target.value)} />
              <span className="text-sm">{l.name}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded hover:bg-gray-700">취소</button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-sm rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">저장</button>
        </div>
      </div>
    </div>
  );
}
```

---

## 26. 관리자 기능 — Edge Function 호출

### `supabase/functions/admin-create-user/index.ts` (핵심 흐름)

```ts
// 1. 호출자의 is_admin 검증
// 2. auth.admin.createUser()로 신규 사용자 생성
// 3. profiles에 이름·부서·직급·must_change_password=true 설정
// 4. 임시 비밀번호 메일 발송
```

### `src/services/adminService.ts`

```ts
export async function createUser(input: { email: string; name: string; department?: string; position?: string }) {
  const { data, error } = await supabase.functions.invoke('admin-create-user', { body: input });
  if (error) throw error;
  return data as { ok: true; user_id: string; temp_password: string };
}
```

---

## 27. 보호 라우트

```tsx
export function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">로딩 중...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.must_change_password) return <Navigate to="/change-password" replace />;
  if (adminOnly && !profile?.is_admin) return <Navigate to="/" replace />;
  return <Outlet />;
}
```

라우터:
```tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route element={<ProtectedRoute />}>
    <Route path="/change-password" element={<ChangePasswordPage />} />
    <Route path="/" element={<ChatPage />} />
  </Route>
  <Route element={<ProtectedRoute adminOnly />}>
    <Route path="/admin" element={<AdminPage />} />
  </Route>
</Routes>
```

---

## 28. 구현 순서

### Step 1. 인프라 (1일)
1. Supabase 프로젝트 생성 (MoveTalk과 별도)
2. 마이그레이션 17개 적용 (`supabase db push`)
3. Storage 버킷 생성
4. Edge Function 시크릿 3개 등록
5. Edge Functions 2개 배포
6. 첫 관리자 계정 수동 생성 (SQL: `update profiles set is_admin=true`)

### Step 2. 프로젝트 세팅 (반나절)
- Vite + TS + Tailwind, 환경변수, `database.ts` 자동 생성

### Step 3. 인증 (1일)
- AuthContext, LoginPage, ChangePasswordPage, ProtectedRoute

### Step 4. 기본 레이아웃 (반나절)
- AppLayout, Sidebar, ChatWindow (빈 상태)

### Step 5. 방 목록 + 메시지 (2일)
- roomService, messageService
- Realtime 구독, optimistic UI

### Step 6. 방 생성 (1일)
- NewRoomModal, UserPicker
- 1:1 / 그룹 모두 DB 함수 경유

### Step 7. 메뉴바 + 파일 (2일)
- MessageActionBar (이모지·파일·음성 버튼)
- fileValidation, sendFileMessage, DragDropZone

### Step 8. 음성 번역 (2일)
- useMicrophonePermission, useMediaRecorder
- VoiceRecorderButton, RecordingIndicator
- voiceMessageService (Edge Function 연동)
- MessageBubble 원본/번역 토글
- TranslationLanguageModal

### Step 9. 관리자 (1일)
- AdminPage, AddUserModal → admin-create-user 함수 호출

### Step 10. 배포·테스트 (1일)
- Vercel 환경변수, 도메인 설정
- RLS 검증, 5명 동시 테스트
- 보안 체크: API 키 노출 없음 확인

---

## 29. 개발 시 주의사항

- DB에 파일 바이너리 저장 금지 (Storage 사용)
- 메시지 삭제는 soft delete (`deleted_at`)
- direct room은 반드시 `get_or_create_direct_room()` 함수로만
- RLS는 처음부터 켜고 개발
- Service Role Key는 절대 클라이언트에 두지 않음
- Storage bucket은 private + Signed URL
- **음성 파일은 Edge Function 메모리에서만 처리**
- Realtime 채널은 반드시 unsubscribe (메모리 누수)
- Optimistic UI는 항상 reconciliation과 함께
- 타임존은 UTC 저장 + 클라이언트 변환 (KST 하드코딩 금지)
- 마이그레이션은 SQL 에디터 직접 실행 금지 — 파일로만 관리

---

## 30. 첫 작업 요청 예시

```text
MTL Link를 React + Vite + TypeScript + Tailwind + Supabase로 개발해줘.

먼저 인프라부터.

1. supabase/migrations/ 아래에 DB 설계서 §14의 마이그레이션 17개 작성
2. supabase/functions/admin-create-user/index.ts 작성
3. supabase/functions/voice-translate/ (index.ts + providers/) 작성
4. README.md: supabase init → db push → functions deploy 명령어 정리

그 다음 프론트엔드 기본:
- package.json, vite.config.ts, tailwind.config.js, tsconfig.json
- src/lib/supabase.ts
- src/main.tsx, App.tsx, routes.tsx
- src/contexts/AuthContext.tsx
- src/components/layout/ProtectedRoute.tsx
- src/pages/LoginPage.tsx, ChangePasswordPage.tsx, ChatPage.tsx (placeholder), AdminPage.tsx (placeholder)

조건:
- TypeScript strict 모드
- must_change_password 분기 처리
- 다크모드 기반 UI
- npm install부터 npm run dev까지 README에 정리
```

---

## 31. 완료 기준 (현재 상태)

### v1 기본 기능
- [x] 로그인 / 첫 로그인 비밀번호 변경
- [x] 1:1 방 생성 (중복 방지 검증)
- [x] 그룹 방 생성
- [x] 텍스트 메시지 실시간 송수신 (Optimistic UI)
- [x] 이미지·문서 첨부 및 다운로드
- [x] URL 자동 링크
- [x] 이모지 피커 동작
- [x] 파일 첨부 메뉴바 버튼 동작
- [x] 드래그앤드롭 파일 업로드
- [x] 마이크 녹음 → 번역 → 메시지 전송
- [x] 음성 파일 서버 미저장 확인
- [x] 원본/번역 토글 버튼 동작
- [x] 수신자별 번역 언어 설정
- [x] 관리자 직원 추가 (Edge Function)
- [x] RLS: 참여하지 않은 방 접근 차단 확인
- [x] API 키 클라이언트 미노출 확인
- [x] Vercel 배포

### v1.5 기능
- [x] 이미지 클릭 시 모달 확대
- [x] PDF 인라인 미리보기
- [x] URL OG 링크 카드 표시
- [x] 메시지 읽음 표시 (1:1 ✓✓ / 그룹 숫자)
- [x] 메시지 수정 (5분 이내, 인라인)
- [x] 메시지 삭제 (soft delete)
- [x] 답장 인용 기능
- [x] 방 나가기 / 삭제 (헤더 ⋮ 메뉴)
- [x] 브라우저 알림 (다른 탭 새 메시지)
- [x] 현재 방 메시지 검색 (이전/다음 내비)
- [x] 전체 채팅 글로벌 검색 패널

### v2.2 신규 기능
- [x] 수신 텍스트 메시지 자동 번역 (내 언어 설정 기준)
- [x] 이미지 OCR 추출 + 번역 메시지 전송
- [x] 친구/연락처 탭 (직원 목록, 프로필, 1:1 채팅)
- [x] 6개 언어 UI 전환 (ko/en/ru/zh/ja/uz)
- [x] 회원가입 신청 → 관리자 승인/거절
- [x] 다크/라이트 테마 토글
- [x] 사용자 온라인 프레즌스

### 미구현 (v3 예정)
- [ ] 메시지 반응 (이모지 👍 ❤️)
- [ ] @멘션
- [ ] 스레드 답글
- [ ] 음성·영상통화 (WebRTC)
- [ ] 모바일 네이티브 앱

---

## 32. v1.5 개발 프롬프트

v1 완료 후 아래 순서대로 진행한다.

---

### 32.1 1단계 — 파일·링크 미리보기 (DB 변경 없음)

```
아래 기능을 추가해라.

1. 파일 미리보기
   - 이미지 메시지 클릭 시 모달로 크게 보기
   - 모달 안에서 이전/다음 이미지 전환
   - ESC 또는 외부 클릭으로 닫기
   - PDF는 iframe으로 인라인 미리보기
   - 다운로드 버튼 유지

2. 링크 미리보기 카드
   - 메시지에 URL이 있으면 fetch-link-preview Edge Function 호출
   - OG 메타데이터(제목·설명·이미지·도메인) 추출
   - message_links 테이블에 저장
   - 메시지 버블 아래에 카드 형태로 표시
   - 카드 클릭 시 새 탭에서 열기

새로 만들 파일:
- supabase/functions/fetch-link-preview/index.ts
- src/components/chat/ImageModal.tsx
- src/components/chat/LinkPreviewCard.tsx
- src/components/chat/FilePreview.tsx

수정할 파일:
- MessageBubble.tsx — 링크 카드, 이미지 모달 연결
- FileMessage.tsx — PDF 인라인 미리보기 추가

마이그레이션:
- message_links 테이블 추가 (DB설계서 §19.4)
```

---

### 32.2 2단계 — 읽음 표시·메시지 수정·반응

```
아래 기능을 추가해라.

1. 읽음 표시
   - 1:1 방에서 상대방이 읽으면 메시지 옆에 체크 아이콘 표시
   - 읽으면 파란 체크, 안 읽으면 회색 체크 (WhatsApp 스타일)
   - room_members.last_read_at 기준으로 처리
   - 그룹방은 읽은 인원 수 표시 (예: "읽음 3")

2. 메시지 수정
   - 내 메시지에 호버 시 수정 버튼 표시
   - 클릭 시 메시지 버블이 인라인 수정 모드로 전환
   - 5분 이내만 수정 가능
   - 수정된 메시지에 "(수정됨)" 표시
   - RLS 정책: DB설계서 §19.6 적용

3. 메시지 반응
   - 메시지 호버 시 이모지 반응 버튼 표시
   - 자주 쓰는 이모지 6개 빠른 선택 (👍 ❤️ 😂 😮 😢 🙏)
   - 전체 이모지 피커도 열 수 있게
   - 반응 클릭 시 취소/추가 토글
   - 메시지 아래에 반응 이모지 + 카운트 표시
   - Realtime으로 즉시 반영

새로 만들 파일:
- src/components/chat/MessageReactions.tsx
- src/components/chat/MessageEditInput.tsx
- src/hooks/useReadReceipts.ts

수정할 파일:
- MessageBubble.tsx — 읽음 체크, 수정 버튼, 반응 표시

마이그레이션:
- message_reactions 테이블 (DB설계서 §19.1)
- messages_update_own_5min RLS 정책 (DB설계서 §19.6)
```

---

### 32.3 3단계 — 브라우저 알림·검색·멘션·스레드

```
아래 기능을 추가해라.

1. 브라우저 알림
   - 앱 진입 시 Notification API 권한 요청
   - 다른 탭에 있을 때 새 메시지 오면 푸시 알림
   - 알림 클릭 시 해당 방으로 이동
   - 내가 보낸 메시지와 현재 보고 있는 방은 알림 안 보냄
   - 알림 설정 토글 (사용자별 on/off)

2. 메시지 검색
   - 사이드바 검색창 활성화
   - 키워드 입력 시 실시간 검색 (debounce 300ms)
   - 전체 방 검색 또는 현재 방만 검색 토글
   - 검색 결과에 발신자·방 이름·시간 표시
   - 결과 클릭 시 해당 방·메시지로 이동
   - search_messages DB 함수 사용 (DB설계서 §19.7)

3. 멘션(@)
   - 메시지 입력 중 @ 입력 시 직원 목록 팝업
   - 이름 검색으로 필터링
   - 선택 시 @이름 텍스트 삽입 + 하이라이트
   - 메시지 전송 시 message_mentions 테이블에 저장
   - 멘션된 사용자에게 브라우저 알림 발송
   - 사이드바에서 안 읽은 멘션 배지 표시

4. 스레드 답글
   - 메시지 호버 시 "답글" 버튼 표시
   - 클릭 시 우측에 스레드 패널 슬라이드인
   - 스레드 패널에서 답글 작성
   - 원본 메시지에 "답글 N개" 표시
   - 스레드도 Realtime 구독
   - 스레드 안에서도 멘션·반응·파일 첨부 가능

새로 만들 파일:
- src/hooks/useBrowserNotifications.ts
- src/components/chat/SearchPanel.tsx
- src/components/chat/MentionPicker.tsx
- src/components/chat/ThreadPanel.tsx
- src/components/chat/ThreadMessage.tsx

수정할 파일:
- Sidebar.tsx — 검색창 활성화
- MessageInput.tsx — @ 감지 + MentionPicker 연결
- MessageBubble.tsx — 스레드 버튼, 답글 수 표시
- ChatWindow.tsx — ThreadPanel 슬라이드인
- useRealtimeMessages.ts — 스레드 메시지 구독 추가

마이그레이션:
- messages.thread_id, reply_count 컬럼 (DB설계서 §19.2)
- message_mentions 테이블 (DB설계서 §19.3)
- read_receipts 테이블 (DB설계서 §19.5)
```
