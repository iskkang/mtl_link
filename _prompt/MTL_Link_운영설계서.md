# MTL Link 운영설계서

> 신규 문서. 환경 분리, 배포, 모니터링, 백업, 계정 관리 등 운영에 필요한 사항을 정리.

---

## 1. 문서 목적

기획서·DB설계서·개발프롬프트가 *"무엇을 만들지"*에 집중한다면, 이 문서는 *"만든 것을 어떻게 운영할지"*를 다룬다. v1 출시 전에 모두 결정·구축되어 있어야 한다.

---

## 2. 환경 분리

### 2.1 환경 구성

| 환경 | 목적 | Supabase 프로젝트 | Vercel 프로젝트 | 도메인 |
|---|---|---|---|---|
| **local** | 개발자 PC | Supabase CLI (Docker) | `npm run dev` | localhost:5173 |
| **dev** | 통합 테스트 | `mtl-messenger-dev` | `mtl-messenger-dev` | dev-messenger.{도메인} |
| **prod** | 실제 운영 | `mtl-messenger-prod` | `mtl-messenger` | messenger.{도메인} |

> 파일럿 단계에서는 비용 절감을 위해 `dev`를 생략하고 local + prod만 운영해도 된다. 단 마이그레이션은 반드시 local에서 검증 후 prod에 적용.

### 2.2 환경변수 관리

**Vercel**:
- Project Settings → Environment Variables
- `Production` / `Preview` / `Development` 분리
- `VITE_*` 접두사가 붙은 변수만 클라이언트 번들에 포함됨
- Service Role Key는 절대 등록하지 않는다 (Edge Function 환경변수에만)

**Supabase Edge Functions**:
- Dashboard → Edge Functions → Secrets
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` 등록

---

## 3. 로컬 개발 환경

### 3.1 사전 요구사항

```text
Node.js 20 LTS
Docker Desktop (Supabase local용)
Supabase CLI (npm i -g supabase)
Git
```

### 3.2 초기 세팅

```bash
git clone <repo>
cd mtl-link

# 의존성 설치
npm install

# Supabase 로컬 시작
supabase start

# 마이그레이션 적용 (start 시 자동 적용되지만 명시적으로)
supabase db reset

# 시드 데이터 (선택)
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/seed.sql

# 환경변수 복사
cp .env.example .env.local
# .env.local에 supabase start 출력값 복사

# 개발 서버
npm run dev
```

`supabase start` 출력 중 다음 값을 `.env.local`에 복사:
- `API URL` → `VITE_SUPABASE_URL`
- `anon key` → `VITE_SUPABASE_ANON_KEY`

### 3.3 Edge Function 로컬 테스트

```bash
supabase functions serve admin-create-user --env-file ./supabase/functions/.env

# 별도 터미널에서 테스트
curl -X POST http://localhost:54321/functions/v1/admin-create-user \
  -H "Authorization: Bearer <세션토큰>" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@mtl.com","name":"테스트","department":"영업","position":"사원"}'
```

---

## 4. 배포 (Vercel)

### 4.1 Vercel 프로젝트 연결

1. Vercel 대시보드 → New Project
2. GitHub 저장소 연결
3. Framework Preset: **Vite**
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Environment Variables 등록 (다음 §4.2)

### 4.2 Vercel 환경변수

**Production 전용**:
```env
VITE_SUPABASE_URL=https://<prod-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<prod-anon-key>
VITE_APP_NAME=MTL Link
VITE_ENV=production
```

**Preview/Development 전용**:
```env
VITE_SUPABASE_URL=https://<dev-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<dev-anon-key>
VITE_APP_NAME=MTL Link (DEV)
VITE_ENV=preview
```

### 4.3 커스텀 도메인

1. Vercel → Project → Settings → Domains
2. `messenger.{도메인}` 추가
3. DNS A 레코드 또는 CNAME 등록 (Vercel 안내대로)
4. SSL 자동 발급 확인

### 4.4 빌드 설정

`vercel.json`:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

### 4.5 배포 흐름

```text
개발자 → feature 브랜치 → PR
        ↓
   Vercel Preview 자동 빌드 → 동작 확인
        ↓
   main 머지 → Vercel Production 자동 배포
        ↓
   배포 후 Smoke Test (§9.3)
```

---

## 5. 마이그레이션 운영

### 5.1 절대 원칙

- **운영 DB에 직접 SQL 치지 않는다.**
- 모든 변경은 `supabase/migrations/` 파일로 관리.
- 파일명은 타임스탬프 prefix로 정렬됨: `YYYYMMDDHHMMSS_<설명>.sql`

### 5.2 새 마이그레이션 추가

```bash
# 새 마이그레이션 파일 생성
supabase migration new add_message_reactions

# 생성된 파일에 SQL 작성
# supabase/migrations/20260501120000_add_message_reactions.sql

# 로컬에서 검증
supabase db reset

# dev 환경에 적용
supabase link --project-ref <dev-ref>
supabase db push

# prod 환경에 적용 (충분한 검증 후)
supabase link --project-ref <prod-ref>
supabase db push
```

### 5.3 위험한 마이그레이션 체크리스트

다음 변경은 운영 적용 전에 반드시 점검:

- [ ] 컬럼 삭제 → 백업 + 단계적 롤아웃 (먼저 deprecate, 다음 배포에서 삭제)
- [ ] NOT NULL 추가 → 기존 데이터 채우기 SQL 선행
- [ ] 인덱스 생성 → 큰 테이블이면 `create index concurrently`
- [ ] RLS 정책 변경 → dev 환경에서 모든 시나리오 검증
- [ ] 함수 시그니처 변경 → 클라이언트 호출 코드 동시 배포

### 5.4 롤백 정책

Supabase는 자동 롤백 기능이 없다. 다음 방식으로 대응:

- **데이터 변경 없는 DDL** → 역방향 마이그레이션 작성·적용
- **데이터 변경 동반** → Supabase Pro 자동 백업에서 PITR(Point-in-Time Recovery) 복원

---

## 6. 백업 정책

### 6.1 Supabase 자동 백업 (Pro 이상)

- **Daily backups**: 매일 자동 백업, 7일 보관
- **PITR (Point-in-Time Recovery)**: 2분 단위 복원, 7일 (Pro), 28일 (Team)

### 6.2 추가 백업 (사내 규정 대응)

월 1회 수동으로 추가 백업을 받는다.

```bash
# DB 덤프
supabase db dump --linked > backups/$(date +%Y%m%d)_db.sql

# Storage 백업 (파일 다운로드)
# Supabase는 Storage 일괄 백업 CLI를 제공하지 않으므로 스크립트 작성
node scripts/backup-storage.js
```

`scripts/backup-storage.js` 예시는 별도로 작성 (Service Role Key로 모든 객체 listing 후 다운로드).

### 6.3 백업 보관 위치

- 회사 NAS 또는 사내 백업 서버
- 외부 클라우드(S3 등)로 추가 미러링 검토

### 6.4 복원 훈련

분기 1회, dev 환경에 운영 백업을 복원해 데이터 일치 여부 확인.

---

## 7. 계정 관리

### 7.1 신규 직원 합류 절차

1. **인사팀**: 입사 확정 → 메신저 관리자에게 통보 (이름, 회사 이메일, 부서, 직급)
2. **관리자**: `/admin` 페이지에서 *"직원 추가"* 클릭
3. **시스템**:
   - Edge Function `admin-create-user` 호출
   - 임시 비밀번호 생성
   - `must_change_password = true`
   - 가입 완료 메일 발송 (임시 비밀번호 포함)
4. **신규 직원**: 메일 수신 → 로그인 → 비밀번호 변경 화면 → 새 비밀번호 설정

### 7.2 직원 퇴사 절차

1. **인사팀**: 퇴사 통보 → 관리자에게 전달
2. **관리자**: `/admin`에서 해당 직원 *"비활성화"* 클릭
3. **시스템**:
   - `profiles.status = 'inactive'`
   - 새 메시지 작성 차단 (RLS 또는 클라이언트 가드)
   - 직원 목록에서 숨김
   - 기존 메시지·방은 유지 (감사 추적용)
4. **30일 후** (선택): 관리자가 완전 삭제 (`auth.users` 삭제 → cascade)

### 7.3 비밀번호 분실

- 관리자가 `/admin`에서 *"비밀번호 재설정"* 클릭
- Edge Function이 새 임시 비밀번호 발급, `must_change_password = true`
- 직원에게 메일 발송

> Supabase의 *"비밀번호 재설정 이메일"* 기능은 v1.5에서 검토 (자가 재설정).

### 7.4 관리자 권한 부여

DB에서 직접 update (관리자가 다른 관리자에게 직접 못 줌, 의도된 제한):

```sql
update public.profiles set is_admin = true where email = 'newadmin@mtl.com';
```

이 작업은 회사 정책에 따라 시스템 책임자만 수행한다.

---

## 8. 모니터링

### 8.1 Supabase 대시보드

매일 또는 주간으로 확인:

- **Database** → CPU·메모리 사용률
- **Database** → 슬로우 쿼리 (Reports → Query Performance)
- **Auth** → 신규/활성 사용자
- **Storage** → 사용량 (요금제 한도 대비)
- **Realtime** → 동시 연결 수
- **Logs** → 에러 로그

### 8.2 클라이언트 에러 추적

권장: **Sentry** 또는 **Logtail** 통합 (v1.5).

v1에서는 최소한 다음을 확보:
- 브라우저 콘솔 에러 → 사용자가 캡처해서 제보
- Vercel Analytics (무료) → 트래픽·웹 vitals

### 8.3 알림 설정

- Supabase Dashboard → Project Settings → Integrations → Slack/Discord 웹훅
- 알림 대상:
  - Database CPU 80% 이상 지속
  - Storage 용량 80% 이상
  - 인증 실패 급증 (브루트포스 의심)

### 8.4 정기 점검 체크리스트

**주간**:
- [ ] Storage 사용량 추이
- [ ] 활성 사용자 수
- [ ] 슬로우 쿼리 발생 여부

**월간**:
- [ ] 백업 정상 작동 확인
- [ ] dev 환경에 운영 백업 복원 테스트
- [ ] 만료된 임시 비밀번호 정리
- [ ] 비활성 사용자 정리 검토

**분기**:
- [ ] 의존성 업데이트 (`npm audit`, `npm outdated`)
- [ ] Supabase 플랜 적정성 검토
- [ ] 보안 점검 (RLS 정책, Storage 정책)

---

## 9. 보안 운영

### 9.1 비밀번호 정책

- 최소 8자
- 영문 대소문자 + 숫자 + 특수문자 1개씩 포함
- 기존 비밀번호와 동일 불가
- 클라이언트 + Supabase Auth 정책 양쪽 적용

### 9.2 세션·토큰

- Access Token 1시간 만료
- Refresh Token 7일 만료
- 다중 디바이스 로그인 허용 (메신저 특성상 자연스러움)
- 강제 로그아웃은 `auth.users` 토큰 무효화로 처리

### 9.3 Smoke Test (배포 직후 5분)

1. [ ] `https://messenger.{도메인}` 접속 → 로그인 화면
2. [ ] 테스트 계정 로그인 → 채팅 페이지 진입
3. [ ] 방 목록 정상 로드
4. [ ] 메시지 전송 → 1초 내 표시
5. [ ] 다른 탭에서 동일 방 → Realtime 수신 확인
6. [ ] 이미지 업로드 → 썸네일 표시
7. [ ] 파일 다운로드
8. [ ] 로그아웃

### 9.4 보안 사고 대응

| 사고 유형 | 대응 |
|---|---|
| 의심스러운 로그인 시도 | Supabase Auth 로그 확인 → 해당 계정 일시 비활성화 |
| Anon Key 유출 의심 | Supabase Settings에서 anon key 재발급 → 환경변수 갱신 → 재배포 |
| Service Role Key 유출 | **즉시** Supabase Dashboard에서 재발급 → Edge Function 환경변수 갱신 |
| 데이터 유출 의심 | RLS 정책 즉시 검토 + 운영로그 분석 + 사내 보고 |
| Storage 공개 노출 | bucket을 private로 변경 + 이미 발급된 signed URL은 만료 대기 |

---

### 9.5 음성 번역 보안 가이드

- **매우 민감한 정보(고객 개인정보, 금융, 계약 조건)는 음성 번역 사용 금지**
- 음성·텍스트가 OpenAI(Whisper) 및 Anthropic(Claude) 외부 API로 일시적으로 전송됨
- 각 API 제공자는 학습에 사용하지 않으나, 회사의 외부 데이터 전송 정책 확인 필요
- 의심스러운 사용 패턴은 Edge Function 로그로 감사 가능

---

## 10. 운영 비용 추정

| 항목 | 비용 (월) | 비고 |
|---|---:|---|
| Supabase Pro | $25 | DB·Realtime·Auth·Storage 100GB |
| Vercel Pro | $20 | 팀 협업, 분석. v1은 Hobby($0)로 시작 가능 |
| 도메인 | ~$1 | 회사 도메인 활용 시 무료 |
| 메일 발송 (Resend) | $0~$20 | v1 무료 티어로 충분 |
| OpenAI Whisper STT | ~$8 | 50명 × 일5회 × 15초 × 22일 ≈ 23시간/월 |
| Anthropic Claude Haiku 번역 | ~$2 | 건당 약 200토큰 × 월 5,500건 |
| **합계 (v1 기본)** | **~$25** | Vercel Hobby + Supabase Pro |
| **합계 (음성번역 포함)** | **~$35** | 기본 + 음성번역 $10 |
| **합계 (50명 안정 운영)** | **~$55~80** | Vercel Pro 추가 시 |

> 사용자 50명 메신저 기준으로 충분히 합리적인 수준.

---

## 11. 향후 확장 시 운영 영향

| v1.5/v2 기능 | 운영 영향 |
|---|---|
| 메시지 검색 | 인덱스 크기 증가, Storage가 아닌 DB 디스크 확인 |
| 링크 미리보기 | 외부 OG 메타 fetch → Edge Function 추가 + 무한루프·SSRF 방지 |
| AI 번역·요약 | Anthropic/OpenAI API 비용 추가, 모니터링 필요 |
| 모바일 PWA | 푸시 알림 시 VAPID 키 관리 |
| 화물·프로젝트 연동 | MoveTalk과 데이터 공유 시 인증 토큰 교환 방식 설계 필요 |

---

## 12. 인수인계 체크리스트

운영 담당자 변경 시 전달할 정보:

- [ ] Supabase 프로젝트 URL·소유자 권한 이전
- [ ] Vercel 프로젝트 권한 이전
- [ ] 도메인 DNS 관리 권한
- [ ] GitHub 저장소 권한
- [ ] 관리자 계정 (`is_admin = true` 사용자) 인계
- [ ] 백업 위치 및 복원 절차 안내
- [ ] 본 운영설계서 + 기획서·DB설계서·개발프롬프트 4개 문서 전달
- [ ] 알림 채널(Slack/Discord) 권한
- [ ] 메일 발송 서비스 계정
- [ ] 사용자 문의 대응 가이드라인
