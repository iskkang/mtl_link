# MTL Link v2.4 구현 기록

> 이 세션에서 추가·수정된 기능 전체를 기록한다.  
> 작성일: 2026-05-05  
> 대상 브랜치: `main`  
> 기준: v2.3 이후 커밋 (`01cb0b1` ~ `b8478c4`)

---

## 0. 세션 요약

| 분류 | 내용 |
|------|------|
| 대시보드 레이아웃 | 3-Row CSS Grid 전면 개편, GreetingWeatherCard 신규, PortTop5→Top10 |
| 지도 | react-simple-maps 교체, 드래그 패닝, 클리핑 수정 |
| FBX 티커 | 권역별혼잡도 → 12개 항로 운임지수, Python 스크래퍼, DB 방식 전환 |
| 번역 | 자동번역 구조적 버그 수정 (targetLanguage prop 전달) |
| 받은 요청 카드 | 다국어 번역, 스크롤 영역, count 배지, null 처리 |

---

## 1. 대시보드 레이아웃 전면 개편

### 1-1. GreetingWeatherCard 신규 (`src/components/dashboard/GreetingWeatherCard.tsx`)

기존의 `GreetingCard` + `WeatherCard`를 하나의 블렌드 그라디언트 카드로 통합했다.

**레이아웃 구조:**
- `prefix` (이름): 1줄
- `body` (시간대별 인사 멘트): 1줄  
- 날씨 정보: 1줄

**시간대별 한국어 인사 8구간** (i18n 대신 직접 적용):

| 시간 | 인사 문구 |
|------|-----------|
| 5–7시 | 일찍 시작하시네요, |
| 7–9시 | 좋은 아침이에요, |
| 9–12시 | 좋은 오전이에요, |
| 12–14시 | 점심 맛있게 드셨나요, |
| 14–17시 | 오후도 화이팅이에요, |
| 17–19시 | 하루 수고하셨어요, |
| 19–22시 | 좋은 저녁이에요, |
| 22시~ | 오늘도 수고하셨어요, |

**그라디언트**: `linear-gradient 135deg 3-stop` (인사색 시작 → 인사색 중간 → 날씨색 끝)

### 1-2. Dashboard.tsx 레이아웃 (`src/pages/Dashboard.tsx`)

```
Row 1 (1fr): GreetingWeatherCard | 받은요청 | 해운지수
Row 2 (2fr): PortMapCard(col-span-2) | 글로벌무역량 + 업계뉴스 (우측 스택)
Row 3 (1fr): PortTop10(col-span-2) | 재해재난
```

CSS Grid `row-span`으로 업계뉴스 카드를 col3 전체 높이로 확장:

```tsx
// Dashboard.tsx
<div className="row-span-2 ...">
  <TradeVolumeCard />
  <NewsCard className="flex-1" />
</div>
```

### 1-3. PortTop5Card → PortTop10Card

`src/components/dashboard/PortTop5Card.tsx` 내부에서 Top10 표시로 변경:
- 표시 항목 수를 5 → 10으로 확대
- 레이아웃 `col-span-2`로 확장

---

## 2. 지도 — react-simple-maps 교체 + 드래그 패닝

### 2-1. react-simple-maps 교체 (`src/components/dashboard/PortMapCard.tsx`)

기존 SVG 직접 렌더링에서 `react-simple-maps` + Natural Earth 110m GeoJSON으로 교체:

```tsx
import { ComposableMap, Geographies, Geography, Graticule, Marker } from 'react-simple-maps'

const GEO_URL = 'https://cdn.jsdelivr.net/...' // Natural Earth 110m
const projection = "geoNaturalEarth1"
```

- `Graticule` 그리드 라인으로 해양 경계 시각화
- `scale: 210`, `viewBox: "0 0 960 500"`, `preserveAspectRatio: "xMidYMid slice"`

**추가 패키지:**
```json
"react-simple-maps": "^3.x",
"d3-geo": "^3.x"
```

### 2-2. 마우스 드래그 패닝

드래그로 지도를 상하좌우로 이동할 수 있게 구현:

```tsx
const [offset, setOffset] = useState({ x: 0, y: -80 }) // 초기 y=-80 (아시아/유럽 항구 중심)
const [isDragging, setIsDragging] = useState(false)
const dragStart = useRef<{ x: number; y: number } | null>(null)

// mousedown: dragStart 저장
// mousemove: offset 업데이트, isDragging = true
// mouseup/mouseleave: 드래그 종료
// cursor: isDragging ? 'grabbing' : 'grab'
```

**드래그 중 마커 툴팁 비활성화**: `isDragging` 상태일 때 hover 이벤트 차단.

### 2-3. 드래그 클리핑 수정

inner div를 `position: absolute` + `aspect-ratio: 960/500`으로 변경해  
SVG가 컨테이너 높이에 종속되지 않고 위아래 드래그가 가능하도록 수정:

```tsx
// Before: position:relative → SVG가 잘림
// After:
<div style={{ position: 'absolute', width: '100%', aspectRatio: '960/500', ... }}>
  <ComposableMap ... />
</div>
```

---

## 3. FBX 운임지수 티커

### 3-1. RegionalTicker 전환 (`src/components/dashboard/RegionalTicker.tsx`)

권역별 혼잡도 데이터에서 **FBX 12개 항로 운임지수**로 교체:

| 표시 항목 | 설명 |
|-----------|------|
| 코드 | FBX01~FBX23 등 항로 코드 |
| 항로명 | Global, China–NA West, China–EU 등 |
| 가격 ($) | USD/40ft |
| 등락률 (%) | 주간 변동, 양수=초록, 음수=빨강 |

캐시 TTL: 6시간 (`6 * 60 * 60 * 1000`)

**폴백**: FBX 데이터 실패 시 권역별 혼잡도 데이터로 자동 전환.

### 3-2. dashboard-data Edge Function (`supabase/functions/dashboard-data/index.ts`)

`type=fbx` 쿼리 파라미터 핸들러 추가:

```ts
// Phase 1: fbx_rates 테이블 직접 조회 (DB 방식)
const { data } = await supabase.from('fbx_rates').select('*').order('order_index')
```

기존 Freightos HTML 파싱 방식(SPA 스크래핑) → **Supabase DB 직접 조회 방식으로 전환**.

### 3-3. fbx_rates 테이블 마이그레이션

```sql
-- supabase/migrations/20260505000000_fbx_rates.sql
create table public.fbx_rates (
  id          uuid primary key default gen_random_uuid(),
  route_code  text not null unique,   -- FBX01, FBX02 ...
  route_name  text not null,
  price_usd   numeric,
  change_pct  numeric,               -- 주간 등락률 (%)
  order_index integer,
  updated_at  timestamptz default now()
);
```

시드 데이터: 12개 주요 항로 초기값 포함.

### 3-4. Python 스크래퍼 (`fbx_scraper/`)

독립 실행 Python 스크래퍼 추가:

| 파일 | 역할 |
|------|------|
| `scraper.py` | requests → playwright 폴백, argparse CLI, logging |
| `route_map.py` | `ROUTE_MAP` / `ROUTE_ORDER` 상수 |
| `requirements.txt` | 의존성 목록 |
| `README.md` | cron 예시, FBX API 대안 안내 |

**Supabase 업서트 옵션**:
```bash
python scraper.py --supabase --supabase-url URL --supabase-key KEY
```

---

## 4. 자동번역 구조적 버그 수정

### 4-1. 증상 및 원인

**증상**: 채팅방에서 자동번역이 작동하지 않음.

**원인**: `MessageBubble`이 번역 대상 언어를 `profile.preferred_language ?? 'ko'`로만 결정하고 있었다.  
중국어 사용자의 `preferred_language`가 null인 경우 `myLanguage = 'ko'`가 되어  
`source_language('ko') === myLanguage('ko')` 조건으로 `isTranslatable = false` → 번역 미트리거.

**근본 원인**: `ChatWindow`에서 이미 `get_target_language` RPC로 올바른 번역 대상 언어를 구해  
`targetLanguage` 상태로 관리하고 있었으나, 이 값이 `MessageList`/`MessageBubble`에 전달되지 않는 구조적 문제.

### 4-2. 수정 내용

| 파일 | 수정 |
|------|------|
| `src/components/layout/ChatWindow.tsx` | `MessageList`에 `targetLanguage` prop 전달 |
| `src/components/chat/MessageList.tsx` | `targetLanguage` prop 수신 → `MessageBubble`에 전달 |
| `src/components/chat/MessageBubble.tsx` | `myLanguage` 계산 로직 개선 |

**개선된 myLanguage 계산 로직**:

```ts
// 내 메시지: profile 언어 사용 (자기 메시지 번역 방지)
// 상대 메시지: targetLanguage 우선, 'none'/미설정 시 profile 언어 폴백
const myLanguage = isOwn
  ? profile.preferred_language ?? 'ko'
  : (targetLanguage && targetLanguage !== 'none')
    ? targetLanguage
    : profile.preferred_language ?? 'ko'
```

---

## 5. 받은 요청 카드 (RequestsCard) 개선

### 5-1. 다국어 번역 추가 (`src/components/dashboard/RequestsCard.tsx`)

요청 메시지를 로그인 사용자의 `preferred_language`로 자동 번역:

**번역 조회 우선순위**:
1. DB join (`message_translations`) 캐시 우선
2. 없으면 Edge Function (`translate-text`) 병렬 호출

**null source_language 처리**: 레거시 메시지에서 `source_language`가 null인 경우 `'ko'`로 간주.  
`myLang === 'ko'`이면 번역 불필요 → 즉시 단락 처리.

### 5-2. requestService.ts 쿼리 확장

```ts
// src/services/requestService.ts
SELECT *,
  source_language,   // 추가
  message_translations(language, translated_text)  // JOIN 추가
FROM messages
WHERE ...
```

### 5-3. DashboardCard 컴포넌트 확장 (`src/components/dashboard/DashboardCard.tsx`)

```tsx
interface DashboardCardProps {
  badge?: number      // 헤더 우측 숫자 배지 (건수 표시)
  scrollable?: boolean // true 시 내부 스크롤 영역 활성화
}
```

**RequestsCard 변경**:
- `slice(0, 3)` 제거 → scrollable 영역으로 전체 목록 표시
- 헤더에 `badge={items.length}` 표시 (0건 시 미표시)

---

## 6. 파일 변경 목록

### 신규 생성

| 파일 | 설명 |
|------|------|
| `src/components/dashboard/GreetingWeatherCard.tsx` | 인사말+날씨 통합 카드 |
| `fbx_scraper/scraper.py` | FBX 운임지수 Python 스크래퍼 |
| `fbx_scraper/route_map.py` | 항로 코드·이름 상수 |
| `fbx_scraper/requirements.txt` | Python 의존성 |
| `fbx_scraper/README.md` | 사용법·cron 예시 |
| `supabase/migrations/20260505000000_fbx_rates.sql` | fbx_rates 테이블 |

### 주요 수정

| 파일 | 수정 내용 |
|------|-----------|
| `src/pages/Dashboard.tsx` | 3-Row CSS Grid 레이아웃, row-span, GreetingWeatherCard 적용 |
| `src/components/dashboard/PortMapCard.tsx` | react-simple-maps 교체, 드래그 패닝, 클리핑 수정 |
| `src/components/dashboard/RegionalTicker.tsx` | FBX 티커로 전환, 폴백 추가 |
| `src/components/dashboard/GreetingWeatherCard.tsx` | 3줄 레이아웃, 3-stop 그라디언트, 8구간 인사 |
| `src/components/dashboard/PortTop5Card.tsx` | Top10 표시, col-span-2 확장 |
| `src/components/dashboard/DashboardCard.tsx` | badge, scrollable prop 추가 |
| `src/components/dashboard/RequestsCard.tsx` | 다국어 번역, 스크롤, count 배지, null 처리 |
| `src/services/requestService.ts` | source_language + translations JOIN 추가 |
| `src/components/layout/ChatWindow.tsx` | targetLanguage → MessageList 전달 |
| `src/components/chat/MessageList.tsx` | targetLanguage prop 추가 전달 |
| `src/components/chat/MessageBubble.tsx` | myLanguage 계산 로직 개선 |
| `supabase/functions/dashboard-data/index.ts` | type=fbx 핸들러, fbx_rates 조회 추가 |
| `package.json` | `react-simple-maps`, `d3-geo` 추가 |

---

## 7. 패키지 추가

```json
// dependencies
"react-simple-maps": "^3.x",
"d3-geo": "^3.x"
```

---

## 8. Supabase 배포 명령어

```powershell
$env:SUPABASE_ACCESS_TOKEN='<token>'
$REF = 'zidkckbabtajpgkhxmfm'

# DB 마이그레이션 (fbx_rates 테이블)
npx supabase db push --project-ref $REF

# Edge Function 배포
npx supabase functions deploy dashboard-data --project-ref $REF --no-verify-jwt
```

---

## 9. 테스트 체크리스트

### 대시보드 레이아웃
- [ ] Row 1: 인사말+날씨 | 받은요청 | 해운지수 3열 배치 확인
- [ ] Row 2: 지도(2/3) | 글로벌무역+뉴스 스택(1/3) 배치 확인
- [ ] Row 3: PortTop10(2/3) | 재해재난(1/3) 배치 확인
- [ ] 뉴스 카드가 row-span-2로 col3 전체 높이 차지 확인

### 지도
- [ ] 세계 지도가 자연스러운 투영법(geoNaturalEarth1)으로 표시
- [ ] 마우스 드래그로 지도 이동 동작 (커서 grab)
- [ ] 드래그 중 마커 툴팁 비활성화 확인
- [ ] 지도가 위아래로 클리핑 없이 이동 가능

### FBX 티커
- [ ] 상단 티커에 FBX 12개 항로 운임지수 표시
- [ ] 양수 등락률 초록, 음수 빨강 색상 확인
- [ ] FBX 데이터 실패 시 권역별 혼잡도로 폴백 확인
- [ ] 6시간 캐시 동작 확인

### 자동번역
- [ ] preferred_language가 null인 중국어 사용자 채팅방 번역 동작 확인
- [ ] targetLanguage가 'none'인 경우 profile 언어 폴백 확인
- [ ] 내 메시지에 번역이 표시되지 않음 확인

### 받은 요청 카드
- [ ] 카드 헤더에 건수 배지 표시 확인
- [ ] 전체 목록 스크롤 동작 확인 (slice 제거)
- [ ] 사용자 언어로 메시지 내용 번역 표시 확인
- [ ] source_language가 null인 레거시 메시지 정상 처리 확인
- [ ] ko 사용자 번역 단락 (Edge Function 호출 없음) 확인
