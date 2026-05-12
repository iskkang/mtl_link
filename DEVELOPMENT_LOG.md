# MTL Link — 개발 기록

> 최종 업데이트: 2026-05-12  
> 저장소: https://github.com/iskkang/mtl_link  
> 스택: React + TypeScript + Vite · Supabase (PostgreSQL + Realtime + Edge Functions) · Claude AI API

---

## 목차

1. [v0 — 프로젝트 초기 세팅](#v0--프로젝트-초기-세팅)
2. [Phase 1–4 — 디자인 시스템 & 레이아웃](#phase-14--디자인-시스템--레이아웃)
3. [v2.1–v2.5 — 메시지 핵심 기능](#v21v25--메시지-핵심-기능)
4. [v2.6–v2.8 — 메시지 확장](#v26v28--메시지-확장)
5. [v2.9–v2.13 — 알림 & 안정화](#v29v213--알림--안정화)
6. [v2.14–v2.16 — 핀 / 검색 / 번역 개선](#v214v216--핀--검색--번역-개선)
7. [v2.17–v2.19 — 상태 표시 / 파일 자료실 / 공지](#v217v219--상태-표시--파일-자료실--공지)
8. [v2.20–v2.22 — 채널 시스템 & RAG AI](#v220v222--채널-시스템--rag-ai)
9. [v2.23–v2.25 — 채널 요약봇 / 링크 미리보기 / MINT 리브랜딩](#v223v225--채널-요약봇--링크-미리보기--mint-리브랜딩)
10. [AI 기능 상세](#ai-기능-상세)
11. [대시보드](#대시보드)
12. [인프라 & PWA](#인프라--pwa)

---

## v0 — 프로젝트 초기 세팅

| 커밋 | 내용 |
|------|------|
| `d573ce4` | **MTL Link v0.1 초기 커밋** — 기본 채팅 앱 뼈대, Supabase 연결, 회원가입/로그인 |
| `7e92034` | 파일 미리보기 · 링크 미리보기 초기 구현 |
| `32061c1` | 관리자 회원가입 알림 이메일 (Resend + Edge Function) |

---

## Phase 1–4 — 디자인 시스템 & 레이아웃

### Phase 1 — 디자인 토큰 & UI 프리미티브
- Flexport 스타일 컬러 시스템 마이그레이션 (`--ink`, `--surface` 토큰 체계)
- 다크모드 위계 재정립, 아이콘·텍스트 가독성 개선

### Phase 2A — 3-컬럼 데스크톱 레이아웃
- **MenuRail** (좌측 아이콘 탐색) + **ChatSidebar** + 메인 채팅 영역
- 모바일 하단 탭바 + **MoreSheet** 슬라이드업 시트

### Phase 2B — ChatHeader 분리
- ChatHeader 컴포넌트 분리, 헤더 메뉴(테마/알림/언어/나가기/삭제)

### Phase 3 — 메시지 영역 시각 정돈
- 모바일 롱프레스 액션 시트, i18n 보완, MessageActionBar 문자열 추출

### Phase 4 — 로고 · Empty State · 파비콘
- LogoBox 컴포넌트, Empty State 통일, PWA 파비콘 추가

---

## v2.1–v2.5 — 메시지 핵심 기능

| 기능 | 내용 |
|------|------|
| **자동 번역** | 수신 메시지를 viewer의 `preferred_language` 기준으로 Claude Haiku 번역 · DB 캐시 저장 |
| **번역 2단 레이아웃** | 원본 italic 회색 + 구분선 + 번역 |
| **읽음 표시** | 1:1 채팅 ✓✓ / 그룹 숫자 표시 · Realtime Broadcast 방식 |
| **답장 인용** | 메시지 인용 박스, 발신자 이름 표시 |
| **메시지 수정/삭제** | 컨텍스트 메뉴 → 수정·삭제 |
| **방 나가기/삭제** | 헤더 ⋮ 메뉴, 멤버 1명 이하 시 자동 삭제 트리거 |
| **메시지 검색** | 카카오톡 스타일, 첨부 파일명·번역문 검색 |
| **이모지 반응** | `message_reactions` 테이블, Realtime 동기화 |
| **Web Push 알림** | VAPID + Service Worker, 백그라운드 알림 |
| **후속 추적** | 질문 자동 감지, 24시간 미답변 알림 |
| **액션 아이템(할 일)** | 메시지 → 할 일 전환, 마감일 관리, 자동 리마인더 |
| **요청 탭** | 사이드바 통합형, 카카오톡 스타일 |
| **멘션** | `messages.mentions`, 번역 placeholder, 푸시 prefix |
| **채널 가시성** | 공개/비공개 채널 탐색 모달 |
| **6개 언어 i18n** | 한국어·영어·러시아어·우즈베크어·중국어(간체·번체) |

---

## v2.6–v2.8 — 메시지 확장

| 버전 | 기능 |
|------|------|
| **v2.6** | **메시지 전달(Forward)** — forwardMessage 서비스, DB 타입 · i18n 기반 구축 |
| **v2.7** | **이미지 업로드 자동 압축** — 업로드 전 클라이언트 리사이즈 |
| — | **음성 메시지** — 녹음, Whisper STT, 수신자 언어로 자동 번역 표시 |
| — | **파일 업로드** — 드래그앤드롭, OCR 번역, 미리보기 |
| — | **스레드** — Slack 스타일, 모든 답글이 스레드로 통합 |

---

## v2.9–v2.13 — 알림 & 안정화

| 버전 | 기능 |
|------|------|
| **v2.9** | 알림 설정 UI, 키워드 하이라이팅 |
| **v2.10** | 알림 중복 · 카운트 이중 증가 수정, markAsRead race condition 해결 |
| **v2.11** | DND(방해금지) + 키워드 알림 설정 UI 완성 |
| **v2.12** | PWA Service Worker — 아이콘, manifest, 설치 배너 |
| **v2.13** | 디버그 로그 제거, 통합 패치 정리 |

주요 수정:
- SW 비실행 시 푸시 알림 미수신 핫픽스
- 방 정렬 comparator 통일 (최신 메시지 기준 내림차순)
- 앱 활성 중 in-app 사운드/진동 복원

---

## v2.14–v2.16 — 핀 / 검색 / 번역 개선

### v2.14 — 메시지 핀 & 번역 용어집

| 기능 | 내용 |
|------|------|
| **메시지 핀** | `pinned_messages` 테이블, 헤더 아이콘, 핀 패널 UI, 메시지 점프 |
| **번역 용어집** | `translate-text` Edge Function에 물류 전문 용어집 동적 주입 |
| **텍스트 부분 선택·복사** | 메시지 텍스트 일부 선택 + 복사 지원 |

### v2.15 — 프로필 사진 & 코드 스플리팅

| 기능 | 내용 |
|------|------|
| **프로필 사진 업로드** | Supabase Storage, 아바타 색상 선택기 |
| **ChatPage 코드 스플리팅** | 번들 908 kB → 449 kB |

### v2.16 — 검색 UX 개선

- 검색 인덱스 추가, 첨부 파일명 검색 백엔드
- 번역 매칭 아이콘 직관성 개선, 검색 UI 첨부 필터

---

## v2.17–v2.19 — 상태 표시 / 파일 자료실 / 공지

### v2.17 — 온라인 상태 & 상태 메시지

| 기능 | 내용 |
|------|------|
| **Presence 시스템** | `presence_status` DB 스키마, `presenceService`, `useUserStatus` 훅 |
| **StatusDot** | 멤버 목록·채팅 헤더에 온라인 상태 표시 |
| **StatusDropdown** | 상태 메시지 설정 UI |
| **Realtime 동기화** | DND + Realtime 구독 통합 |

### v2.18 — 파일 자료실

- 파일 업로드·다운로드 데이터 레이어
- 파일 자료실 UI (목록, 카테고리), 클릭 동작

### v2.19 — 공지 시스템

- `announcements` 테이블 타입 정의
- `announcementService` + `useAnnouncements` 훅
- AnnouncementsPanel UI
- 관리자 공지 작성 · 삭제

---

## v2.20–v2.22 — 채널 시스템 & RAG AI

### v2.20 — 채널 시스템

| 기능 | 내용 |
|------|------|
| **채널 생성** | 관리자 전용 생성, 비관리자 안내 메시지 |
| **채널 참여/탈퇴** | 참여 중인 채널 클릭 시 해당 방으로 이동 |
| **채널 삭제** | 삭제 후 리스트 즉시 제거 |
| **채널 헤더 버튼** | ChannelsPanel 헤더 + 버튼으로 채널 생성 |
| **채널 번역** | viewer 기준 자동 번역, 자기 멘션 보라색 강조 |

### v2.21 — 내부 지식 AI

- `knowledge_base` 테이블 참조 → `ai-chat` Edge Function 연동
- 관리자 KB 항목 승인 UI

### v2.22 — RAG (Retrieval-Augmented Generation)

| 단계 | 내용 |
|------|------|
| **B** | 파일 파싱 + 임베딩 서비스 (Excel 단일 시트, PDF) |
| **C** | 파일 업로드 UI, PDF 지원 (`pdfjs-dist` 로컬 워커) |
| **D** | `ai-chat` 벡터 검색 교체 (`match_knowledge` RPC) |
| **Admin** | HS코드·KB 항목 일괄 승인 버튼 |

---

## v2.23–v2.25 — 채널 요약봇 / 링크 미리보기 / MINT 리브랜딩

### v2.23 — 채널 대화 요약봇 & AI 이름 변경

- **채널 요약봇** — 채널 대화 내용을 AI가 요약
- AI 이름 **MARVIS** 부여, 접속 국가별 언어 자동 감지
- Rate Finder 페이지 — DB 직접 쿼리, 국경 필터, MenuRail 이동

### v2.24 — URL 링크 미리보기

- `fetch-link-preview` Edge Function (CORS 포함)
- 채팅 메시지 내 URL 자동 감지 → OG 미리보기 카드 표시

### v2.25 — MINT 리브랜딩

- AI 봇 이름 **MARVIS → MINT**
- 메신저 내 로고: `mint-logo.svg` (다이아몬드 아이콘)
- 사이드바 메뉴 아이콘: `mint-favicon.svg` (4색 다이아몬드)
- 환영 화면: `mint-logo-wordmark.svg` (아이콘 + MINT 텍스트 통합)
- `MintIcon` 컴포넌트 교체 (`MarvisIcon` re-export 유지)
- 6개 Supabase AI Edge Function 시스템 프롬프트 업데이트

---

## AI 기능 상세

### Phase 0 — AI MVP

Claude AI API 연결, 기본 채팅 세션 아키텍처 (Claude 스타일 독립 세션).

### Phase 1-A — 견적 체크리스트 & 메시지 작성

| 기능 | Edge Function |
|------|---------------|
| 견적 체크리스트 | `ai-quotation` — 고객 문의 분석, 누락 항목 자동 식별 |
| 메시지 작성 | `ai-message` — 상황 기반 물류 전문 메시지 초안 생성 |

### Phase 1-B — 운송 모드 추천 & 통관 리스크

| 기능 | Edge Function |
|------|---------------|
| 운송 모드 추천 | `ai-transport` — 물류 조건 입력 → 최적 운송 수단 추천 |
| 통관 리스크 분석 | `ai-customs` — 품목·국가 기준 위험도 평가 |

### Phase 2 — HS코드 & 지식 베이스

- HS코드 레퍼런스 데이터 임포트 + 검색 통합
- `knowledge_base` DB + 관리자 승인 플로우

### Phase 3 — 화물 추적 헬퍼

- 화물 번호 자동 인식 → 운송사 조회 → `ai-tracking-message` Edge Function으로 추적 안내문 자동 생성

### 전체 AI 아키텍처

```
사용자 입력
    ↓
AiQuickActions (퀵 액션 선택)
    ↓
ai-chat / ai-quotation / ai-message / ai-transport / ai-customs / ai-tracking-message
(Supabase Edge Function)
    ↓
Claude API (Haiku / Sonnet)
    ↓
knowledge_base 벡터 검색 (match_knowledge RPC)
    ↓
응답 반환
```

**지원 언어 자동 감지:** 한국어 · 영어 · 러시아어 · 우즈베크어 · 중국어(간체·번체)

---

## 대시보드

| 단계 | 내용 |
|------|------|
| **D-1A** | 데스크톱 대시보드 5개 카드 초기 구현 |
| **해운지수** | surff.kr Edge Function 스크래핑 → 실데이터 |
| **업계 뉴스** | ksg.co.kr RSS 파싱 |
| **세계 지도** | SVG 월드맵, 드래그 패닝, 권역별 혼잡도 |
| **FBX 운임지수** | Supabase DB 방식으로 전환 (SPA 스크래핑 대체) |
| **티커** | 권역별 혼잡도 실시간 티커 |
| **항구 혼잡도** | mtl-port-congestion-monitor 별도 Supabase 연동 |
| **글로벌 물동량** | EconDB 클라이언트 직접 fetch |
| **받은 요청 카드** | 다국어 번역 + 스크롤 + count 배지 |

---

## 인프라 & PWA

| 항목 | 내용 |
|------|------|
| **Supabase Edge Functions** | ai-chat, ai-quotation, ai-message, ai-transport, ai-customs, ai-tracking-message, fetch-link-preview, bot-respond, translate-text, send-signup-notification, approve-user, voice-translate |
| **Realtime** | Supabase Realtime 구독 (메시지, 읽음 표시, 반응, 채널) |
| **PWA** | Service Worker, Web Push (VAPID), 설치 배너, 오프라인 캐시 |
| **인증** | Supabase Auth, 토큰 만료 자동 로그아웃 |
| **이메일** | Resend (send.mtlb.co.kr 도메인), 관리자 알림 · 승인/거절 원클릭 |
| **배포** | Vercel (캐시 제어 헤더 설정) |
| **코드 스플리팅** | ChatPage lazy load → 번들 908 kB → 449 kB |

---

## 버전 요약

| 버전 | 핵심 기능 |
|------|-----------|
| v0.1 | 초기 채팅 앱 |
| v2.3 | 할 일, 후속 추적, PWA |
| v2.6 | 메시지 전달 |
| v2.7 | 이미지 압축 |
| v2.9–v2.11 | 알림 시스템 완성 |
| v2.14 | 핀, 번역 용어집 |
| v2.15 | 프로필 사진, 코드 스플리팅 |
| v2.16 | 검색 개선 |
| v2.17 | 온라인 상태·상태 메시지 |
| v2.18 | 파일 자료실 |
| v2.19 | 공지 시스템 |
| v2.20 | 채널 시스템 |
| v2.21 | 내부 지식 AI |
| v2.22 | RAG (벡터 검색) |
| v2.23 | 채널 요약봇, Rate Finder |
| v2.24 | URL 링크 미리보기 |
| v2.25 | MINT 리브랜딩 |
