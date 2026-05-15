# @mtl/fesco-tracker

MTL Link FESCO 트래킹 추론 엔진. FESCO 공개 API를 호출해 컨테이너 상태를 자동 판정하고, 도착지별 SLA 룰에 따라 신호등을 결정합니다.

## 핵심 기능

- **공개 API 통합** — FESCO `my.fesco.com/api/v2/lk/tracking` 호출 (토큰 옵션)
- **자동 region 매핑** — 도시명/국가명 → 운영 region 변환 (벨라루스/우즈벡/러시아 내륙 등)
- **단계 추론** — 부산 출항 / 해상 / 블라디 통관 / TSR / 도착 5단계 자동 판별
- **SLA 룰 체크** — region별 통관·발차 기준 자동 비교
- **신호등 결정** — green / yellow / red / unknown

## 설치

```bash
npm install @mtl/fesco-tracker
```

## 5분 시작

```typescript
import { trackContainer } from '@mtl/fesco-tracker';

const result = await trackContainer('FESU5332167');

if (!result) {
  console.log('컨테이너를 찾을 수 없습니다');
} else {
  console.log(`${result.signal === 'red' ? '🔴' : result.signal === 'yellow' ? '🟡' : '🟢'} ${result.message}`);
  // → 🟡 TSR 운송 중 — 50km 남음 (도착 임박)
}
```

## 더 자세한 사용

```typescript
import { FescoClient, transformFescoContainer } from '@mtl/fesco-tracker';

const client = new FescoClient({
  // token: process.env.FESCO_TOKEN, // 옵션
  language: 'en',
  timeoutMs: 15000,
});

// 여러 컨테이너 한 번에 조회
const response = await client.trackByNumbers([
  'FESU5332167',
  'BMOU4891889',
  'MSCU7723814',
]);

for (const container of response.data) {
  const tracking = transformFescoContainer(container);

  console.log(tracking.containerNumber, tracking.signal, tracking.message);

  // 룰 체크 결과 활용
  if (tracking.ruleCheck.overallStatus === 'critical') {
    await notifyOperator(tracking); // 알림 발송 로직
  }
}
```

## region 룰 커스터마이징

`src/domain/rules.ts`의 `REGION_RULES` 객체만 수정하면 됩니다. 운영 경험으로 기준을 조정하세요.

```typescript
BELARUS: {
  region: 'BELARUS',
  label: '벨라루스',
  customs:   { normalDays: 8,  warningDays: 10, criticalDays: 12 },
  departure: { normalDays: 10, warningDays: 13, criticalDays: 15 },
}
```

## 도시 매핑 추가

새 노선이 생기면 `CITY_TO_REGION`에 한 줄 추가:

```typescript
export const CITY_TO_REGION = {
  // ...
  'tashkent': 'UZBEKISTAN',
  'newCity': 'KAZAKHSTAN', // 추가
};
```

## 출력 데이터 구조

`CommonTracking` 객체의 주요 필드:

```typescript
{
  containerNumber: 'FESU5332167',
  region: 'BELARUS',
  phase: 'ON_TSR',
  phaseDetail: 'RAILWAY_MOVING',
  signal: 'yellow',
  message: 'TSR 운송 중 — 50km 남음 (도착 임박)',

  // 시간점 4개
  departureFromBusan: { planned, actual, isOverdue, delayDays },
  arrivalAtVladivostok: { ... },
  departureFromVladivostok: { ... },
  arrivalAtDestination: { ... },

  // 룰 체크
  ruleCheck: {
    appliedRule: { region, customs, departure },
    customsDaysElapsed: 12,
    customsLimit: 8,
    customsStatus: 'completed',
    departureDaysElapsed: 12,
    departureLimit: 10,
    departureStatus: 'completed',
    overallStatus: 'normal',
    notes: ['통관 12일 (기준 8일) — 사후 초과', ...],
  },

  // 현재 위치 (가장 최근 이벤트)
  currentLocation: {
    name: 'Shabany',
    operation: 'Wagon has left the station',
    transport: 'FESCO Minsk Shuttle',
    remainingKm: 50,
    totalKm: 10059,
    progressPercent: 100,
  },

  // 세그먼트 + 이벤트 배열
  segments: [...],
  events: [...],
}
```

## 알림 트리거 예시

```typescript
async function checkAndNotify(containerNumbers: string[]) {
  const client = new FescoClient();
  const res = await client.trackByNumbers(containerNumbers);

  for (const c of res.data) {
    const t = transformFescoContainer(c);

    // 🔴 즉시 알림
    if (t.signal === 'red') {
      await slack.send(`긴급: ${t.containerNumber} — ${t.message}`);
    }

    // 🟡 일일 다이제스트에 포함
    if (t.signal === 'yellow') {
      await dailyDigest.add(t);
    }
  }
}
```

## 개발

```bash
npm install
npm test         # 단위 테스트 (31개)
npm run demo     # 실데이터로 추론 결과 출력
npm run lint     # TypeScript 타입 체크
npm run build    # dist/ 빌드
```

## 검증된 실데이터 시나리오

- ✅ `BMOU4891889` — 부산→우즈벡, 항해 시작 직후 (events 비어있음)
- ✅ `FESU5332167` — 부산→벨라루스, TSR 마지막 50km (events 풍부)
- ✅ 다양한 region 매핑 (도시명 + 국가명 폴백)
- ✅ 룰 미적용 케이스 (UNKNOWN region)
- ✅ null 안전 처리 (destinationDate 미정, remainingDistance null 등)

## 향후 확장 가능성

- **Maersk, MSC, Shipsgo 어댑터** — 동일한 `CommonTracking` 인터페이스로 변환
- **캐싱 레이어** — Redis 또는 in-memory TTL 캐시
- **재시도 + 백오프** — 일시 장애 자동 복구
- **휴일 캘린더** — 영업일 기준 카운트 (러시아·벨라루스·우즈벡)
- **운영팀 피드백 학습** — false positive 케이스 모아 룰 자동 조정
