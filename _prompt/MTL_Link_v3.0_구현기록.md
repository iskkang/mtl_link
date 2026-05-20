# MTL Link v3.0 구현 기록

> 이 세션에서 추가·수정된 기능 전체를 기록한다.  
> 작성일: 2026-05-19  
> 대상 브랜치: `main`  
> 기준: v2.6 이후 커밋 (`deb7dc9` ~ `4b9fe10`, 2026-05-19)

---

## 0. 세션 요약

| 분류 | 내용 |
|------|------|
| 컨테이너 알림 이메일 | RED/선박 지연 alert 발생 시 Resend API로 즉시 이메일 발송 |
| 주간 리포트 이메일 | 매주 월요일 MINT 브랜딩 주간 운송 현황 이메일 자동 발송 |
| SEA 선박 도착 지연 alert | fractional day 기반 vessel_arrival_watch/overdue alert 신규 추가 |
| unknown signal 도입 | container_tracking_unknown → 진회색 마커/배지/필터 chip |
| alert 한국어화 | ALERT_KO 매핑으로 alert_reason 한국어 표시 |
| 클러스터 클릭 → detail 표시 | 클러스터 클릭 시 zoom 대신 해당 컨테이너 목록을 detail 패널에 표시 |
| detail 패널 정렬 토글 | 대기순/이름순 정렬 토글 버튼 추가 + 클러스터 변경 시 필터 자동 리셋 |
| 리셋 버튼 fitBounds | 고정 좌표 flyTo → 실제 컨테이너 분포 기반 fitBounds로 개선 |
| 마커 zoom 연동 | clusterRadius 축소 + circle-radius/text-size zoom interpolation |
| 장기 체류 컨테이너 정리 | CleanupBanner + container-cleanup API + dismiss/delete 처리 |
| manually_excluded 처리 | DB 플래그로 컨테이너를 sync·dashboard에서 영구 제외 |
| 조치필요/최근주문 레이아웃 | 패널 위치 교체 + 너비 비율 60:40 |
| MessageInput 포커스 유지 | 전송 완료 후 textarea 포커스 자동 복원 |

---

## 1. FESCO Alert 개선

### 1-1. SEA 선박 도착 지연 alert 추가 (`api/fesco/container-tracking-sync.ts`)

기존 `planned_arrival_overdue`는 `Math.floor`로 인해 1.88일이 1일로 내림 처리되어 감지 누락 발생.
SEA segment 전용 체크를 별도로 추가하여 fractional day로 판정.

```ts
for (const s of (item.segments ?? [])) {
  if (
    (s as any).segmentType === 'SEA' &&
    s.planingDestinationDate &&
    !s.destinationDate &&
    !((s as any).completed && (s as any).inProgress)
  ) {
    const overdueDays = (now - t) / 86_400_000  // Math.floor 없음
    if (overdueDays > 3) return { alert_level: 'red',    alert_type: 'vessel_arrival_overdue', ... }
    if (overdueDays >= 1) return { alert_level: 'yellow', alert_type: 'vessel_arrival_watch',   ... }
  }
}
```

### 1-2. completed + inProgress 조건 추가 (FESU2240410 패턴)

`completed=true, inProgress=true` 동시 → 선박 도착했으나 FESCO가 `destinationDate` 미기입 상태.
이 경우 false alert 방지를 위해 모든 segment 체크에 조건 추가.

```ts
// planned_arrival, planned_departure, vessel_arrival 루프 공통
!((s as any).completed && (s as any).inProgress)
```

### 1-3. Stale alert 자동 해소 (타입 변경 시)

alert 타입이 바뀔 때(예: `vessel_arrival_watch` → `vessel_arrival_overdue`) 기존 open alert가 잔류하는 문제 수정.
alert 신규 생성/갱신 직후 다른 타입의 open alert를 자동 resolved 처리.

```ts
const { data: staleOpenAlerts } = await supabase
  .from('fesco_alerts').select('id')
  .eq('container_number', ctrNum)
  .eq('status', 'open')
  .neq('alert_type', alert.alert_type)

if (staleOpenAlerts && staleOpenAlerts.length > 0) {
  await supabase.from('fesco_alerts')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .in('id', staleOpenAlerts.map(a => a.id))
}
```

### 1-4. manually_excluded 처리 (`api/fesco/container-tracking-sync.ts`)

sync 루프 진입 전 DB에서 `manually_excluded` 플래그 확인 후 `continue`.

```ts
const { data: excRow } = await supabase
  .from('fesco_container_tracking_current')
  .select('manually_excluded')
  .eq('container_number', ctrNum).maybeSingle()
if (excRow?.manually_excluded) continue
```

---

## 2. Dashboard 데이터 개선 (`api/fesco/containers-dashboard.ts`)

### 2-1. recent_orders 정렬 기준

`created_at`(sync 타임스탬프) → FESCO 순차 ID인 `order_number` 문자열 내림차순으로 변경.

```ts
.sort((a, b) => (b.order_number ?? '').localeCompare(a.order_number ?? ''))
```

### 2-2. manually_excluded 필터

Step 1 컨테이너 조회 쿼리에 `.neq('manually_excluded', true)` 추가.

### 2-3. Stale container candidates (Step 5b)

`planned_destination_date`가 20일 이상 초과된 컨테이너 중 이벤트 없음(`no_events`) 또는 목적지 도착(`at_destination`) 조건에 해당하는 항목을 `stale_candidates` 배열로 응답.

```ts
const stale_candidates = [{ container_number, route, days_overdue, reason }]
```

### 2-4. unknown signal 오버라이드 + first_seen_at

`container_tracking_unknown` alert가 있는 컨테이너는 `deriveSignal()` 결과를 무시하고 `signal: 'unknown'`으로 오버라이드. `unknown_since`(alert의 `first_seen_at`)를 응답에 포함.

```ts
signal: alerts.some(a => a.alert_type === 'container_tracking_unknown')
  ? 'unknown'
  : deriveSignal(r, alerts),
unknown_since: alerts.find(a => a.alert_type === 'container_tracking_unknown')?.first_seen_at ?? null,
```

---

## 3. ContainerDashboard.tsx 개선

### 3-1. filteredData null-country 버그 수정

4개국 전체 선택 시 destination_country_code가 null인 컨테이너도 포함, 일부 선택 시 null 제외 로직 적용.

```ts
isShowAll
  ? (c.destination_country_code === null || selectedCountries.has(c.destination_country_code))
  : (c.destination_country_code !== null && selectedCountries.has(c.destination_country_code))
```

### 3-2. awaiting_next_leg +N일 배지

`last_event_date` 기준 대기일수 계산, 노란색 배지 표시.

```ts
const isAwaiting = (c.open_alert_types ?? []).some(t => t.startsWith('awaiting_next_leg'))
const days = isAwaiting
  ? daysSince(c.last_event_date)
  : daysSince(c.planned_destination_date ?? c.last_error_at)
```

### 3-3. unknown signal 지원

- `ContainerItem.signal` 타입에 `'unknown'` 추가
- `ContainerItem`에 `unknown_since: string | null` 추가
- `SignalDot` 색상: `'unknown' → '#475569'` (진회색, glow 없음)
- `SignalChip` 타입 확장 + unknown 스타일 (진회색)
- `stats`, `clusterStats`, `signalFilter`, `presentColors` 모두 `'unknown'` 포함
- chip 레이블: `'추적불가'` 하드코딩
- `actionNeeded` 필터: `c.signal === 'red' || c.signal === 'unknown'`
- 배지: `isUnknown` → `unknown_since ?? last_event_date` 기준, 색상 `#475569`

### 3-4. ALERT_KO 매핑 + SegmentLine 한국어화

```ts
const ALERT_KO: Record<string, string> = {
  awaiting_next_leg_overdue:      '다음 구간 출발 10일 이상 대기',
  awaiting_next_leg_watch:        '다음 구간 출발 5일 이상 대기',
  planned_arrival_overdue:        '도착 예정일 초과',
  planned_departure_overdue:      '출발 예정일 초과',
  vessel_arrival_overdue:         '선박 도착 지연 (3일+)',
  vessel_arrival_watch:           '선박 도착 지연 (1일+)',
  container_tracking_unknown:     '추적 데이터 없음',
  container_tracking_unavailable: '트래킹 불가',
  stale_tracking_risk:            '장기 미업데이트 (위험)',
  stale_tracking_watch:           '장기 미업데이트 (주의)',
}
```

`SegmentLine`에서 `c.alert_reason` 대신 `ALERT_KO[c.open_alert_types?.[0] ?? ''] ?? c.alert_reason` 표시.

### 3-5. detail 패널 정렬 토글

`detailSort` state (`'waiting' | 'name'`) 추가. 헤더에 `▼ 대기순 / ▼ 이름순` 토글 버튼.

```ts
const sortedItems = useMemo(() => {
  if (!items) return []
  return [...items].sort((a, b) => {
    if (detailSort === 'name') return a.container_number.localeCompare(b.container_number)
    // waiting: last_event_date 또는 planned_destination_date 기준 내림차순
  })
}, [items, detailSort])
```

클러스터 변경 시(`items` reference 변경) `detailSort` 자동 리셋:
```ts
useEffect(() => { setDetailSort('waiting') }, [items])
```

### 3-6. CleanupBanner — 장기 체류 컨테이너 정리

`stale_candidates` 응답을 받아 collapsible 노란 배너로 표시. 컨테이너별 Delete/Dismiss 버튼.

```ts
// Delete: fesco_orders에서 container 제거 + fesco_alerts 삭제 + tracking row 삭제
// Dismiss: cleanup_dismissed_until = now + 30일
await fetch('/api/fesco/container-cleanup', {
  method: 'POST',
  body: JSON.stringify({ action: 'delete' | 'dismiss', container_number })
})
```

### 3-7. 조치필요/최근주문 패널 위치 교체

CSS `order` 속성으로 DOM 순서 변경 없이 레이아웃 교체. 너비 비율 60:40 적용.

```tsx
// 조치 필요 — 먼저 표시, 60%
style={{ order: 1, flex: '3 1 0', minWidth: 0, ... }}

// 최근 주문 — 나중 표시, 40%
style={{ order: 2, flex: '2 1 0', minWidth: 0, ... }}
```

---

## 4. ContainerMap.tsx 개선

### 4-1. 클러스터 클릭 → detail 패널 표시

기존: `getClusterExpansionZoom` + `flyTo` (zoom-in)  
변경: `getClusterLeaves` → `onSelectContainers(cns)` (컨테이너 목록 선택)

```ts
source.getClusterLeaves(clusterId, count, 0, (err, leaves) => {
  if (err || !leaves) return
  const cns = leaves.map(l => l.properties?.containerNumber as string).filter(Boolean)
  selectRef.current?.(cns)
})
```

### 4-2. Reset 버튼 개선

**중앙 정렬**: 버튼에 `display:flex`, `alignItems:center`, `justifyContent:center` 추가.

**fitBounds로 복귀**: 고정 `flyTo({center:[80,55], zoom:4})` → 현재 컨테이너 분포 기반 동적 `fitBounds`.

```ts
// containersRef: 최신 containers를 항상 추적하는 stable ref
const containersRef = useRef(containers)
useEffect(() => { containersRef.current = containers }, [containers])

// onResetView 콜백
(m) => {
  const valid = containersRef.current.filter(c => c.longitude != null && c.latitude != null)
  if (valid.length > 0) {
    const bounds = new mapboxgl.LngLatBounds()
    valid.forEach(c => bounds.extend([c.longitude, c.latitude]))
    m.fitBounds(bounds, { padding: 60, maxZoom: 8, duration: 800 })
  } else {
    m.flyTo({ center: [80, 55], zoom: 4, duration: 800 })
  }
}
```

### 4-3. clusterRadius 축소

`clusterRadius: 50` → `clusterRadius: 10` (개별 마커가 더 일찍 분리되도록)

### 4-4. zoom 연동 마커 크기 + 레이블

**circle-radius** (unclustered): 고정 7 → zoom interpolation
```ts
'circle-radius': ['interpolate', ['linear'], ['zoom'],
  3, 4,   5, 6,   7, 8,   10, 11,
]
```

**unclustered-label** 신규 레이어: zoom 5 미만 숨김, 줌인 시 컨테이너 번호 표시
```ts
'text-size': ['interpolate', ['linear'], ['zoom'],
  5, 0,   7, 9,   10, 11,
]
```

### 4-5. unknown signal 마커 색상

```ts
const SIG_COLOR = {
  red:     '#dc2626',
  yellow:  '#d97706',
  green:   '#0d9488',
  gray:    '#94a3b8',
  unknown: '#475569',  // 추가
}
```

`unclustered` 레이어 paint에 unknown case 추가:
```ts
['==', ['get', 'signal'], 'unknown'], SIG_COLOR.unknown,
```

`ContainerPoint.signal`, `ContainerPopupData.signal` 타입에 `'unknown'` 추가.

---

## 5. 컨테이너 알림 이메일 (`api/utils/resend.ts`, `api/fesco/container-tracking-sync.ts`)

### 5-1. sendContainerAlertEmail — ALERT_LABELS 매핑 추가

```ts
const ALERT_LABELS: Record<string, string> = {
  awaiting_next_leg_overdue:      '다음 구간 출발 10일 이상 대기',
  // ...10개
}
const category = ALERT_LABELS[params.alertType] ?? params.alertType
```

HTML `내용` 셀: `params.message` → `ALERT_LABELS[params.alertType] ?? params.message`

### 5-2. sync — alert 발생 시 이메일 발송 (Phase 2)

`alertsOpened++` 직후 fire-and-forget 발송:

```ts
const shouldEmail =
  alert.alert_level === 'red' ||
  alert.alert_type?.startsWith('vessel_arrival')

if (shouldEmail && !dryRun) {
  const route = [currentRow.current_from, currentRow.current_to]
    .filter(Boolean).join(' → ')
  sendContainerAlertEmail({
    containerNumber: ctrNum,
    alertType:       alert.alert_type ?? '',
    message:         alert.message    ?? '',
    route,
  }).catch(err => console.error('[email] failed:', err))
}
```

- 이메일 실패가 sync를 중단시키지 않음 (`.catch()`)
- `dryRun` 시 발송 안 함
- 수신: `mtlrus@mtlb.co.kr`

---

## 6. 주간 FESCO 운송 현황 이메일

### 6-1. sendWeeklyReport (`api/utils/resend.ts`)

`ContainerRow` 타입 정의 후 MINT 브랜딩 HTML 이메일 생성·발송.

- **헤더**: MINT 로고(SVG) + 날짜 + 부제목
- **통계 카드**: 활성 컨테이너 / 조치 필요(빨강) / 주의(노랑) / 추적불가(회색) 4칸
- **테이블 3개**: 조치 필요 / 주의 / 추적불가 — 컨테이너별 노선·위치·상태·대기일수
- **발신**: `MTL Link <noreply@mtlb.co.kr>`
- **수신**: `mtlrus@mtlb.co.kr`, **CC**: `iskang@mtlb.co.kr`

### 6-2. weekly-report API (`api/fesco/weekly-report.ts`, 신규)

```ts
// CRON_SECRET 인증 보호
// Supabase: 활성 컨테이너 + container_tracking_unknown first_seen_at 조회
// red/yellow/unknown 분류 + 대기일수(withDays) 계산
// 한국어 날짜 포맷: "5월 19일(월)"
await sendWeeklyReport({ date, total, red, yellow, unknown })
```

### 6-3. vercel.json — cron + route 추가

```json
"rewrites": [
  { "source": "/api/fesco/weekly-report", "destination": "/api/fesco/weekly-report.ts" }
],
"crons": [
  { "path": "/api/fesco/weekly-report", "schedule": "0 0 * * 1" }
]
```

`0 0 * * 1` = 매주 월요일 00:00 UTC = 한국 시간 오전 9시

---

## 7. 장기 체류 컨테이너 정리 API (`api/fesco/container-cleanup.ts`, 신규)

```ts
// POST { action: 'delete' | 'dismiss', container_number: string }

// dismiss: cleanup_dismissed_until = now + 30일 (30일간 배너에서 숨김)
// delete:
//   1. fesco_orders.containers 배열에서 container 제거
//   2. fesco_alerts에서 해당 컨테이너 alert 삭제
//   3. fesco_container_tracking_current에서 row 삭제
```

---

## 8. MessageInput 포커스 유지 (`src/components/chat/MessageInput.tsx`)

전송 완료 후 textarea 포커스가 날아가는 문제 수정.  
`finally` 블록에서 포커스 재설정:

```ts
} finally {
  setSending(false)
  textareaRef.current?.focus()
}
```

기존 `focus()`가 `await onSend()` 이전에 호출되어 async 완료 후 포커스 소실 → `finally`에서 호출하면 성공/실패 모두 복원됨.

---

## 9. 파일 변경 목록

### 신규 파일

| 파일 | 내용 |
|------|------|
| `api/fesco/weekly-report.ts` | 주간 운송 현황 이메일 발송 API (cron 보호) |
| `api/fesco/container-cleanup.ts` | 장기 체류 컨테이너 delete/dismiss API |

### 주요 수정

| 파일 | 수정 내용 |
|------|-----------|
| `api/fesco/container-tracking-sync.ts` | SEA 선박 지연 alert, completed+inProgress 조건, stale alert 해소, manually_excluded skip, Phase 2 이메일 발송 |
| `api/fesco/containers-dashboard.ts` | manually_excluded 필터, recent_orders order_number 정렬, stale_candidates Step 5b, unknown signal 오버라이드, first_seen_at |
| `api/utils/resend.ts` | ALERT_LABELS 매핑, ContainerRow 타입, sendWeeklyReport 함수 |
| `src/components/tracking/ContainerDashboard.tsx` | unknown signal 전체 지원, ALERT_KO 한국어화, detail 정렬 토글, CleanupBanner, 패널 위치/비율 교체, filteredData null-country 수정, awaiting badge |
| `src/components/tracking/ContainerMap.tsx` | 클러스터 클릭→detail, Reset fitBounds, containersRef, clusterRadius 10, zoom interpolation, unknown 마커색, unclustered-label 레이어 |
| `src/components/chat/MessageInput.tsx` | finally 블록 포커스 복원 |
| `vercel.json` | weekly-report route + cron 추가 |

---

## 10. 테스트 체크리스트

### 알림 이메일
- [ ] RED alert 신규 발생 시 `mtlrus@mtlb.co.kr` 수신 확인
- [ ] `vessel_arrival_watch` (yellow) alert도 이메일 발송 확인
- [ ] 이메일 실패 시 sync가 중단되지 않음 확인
- [ ] `dryRun=true` 시 이메일 미발송 확인

### 주간 리포트
- [ ] `/api/fesco/weekly-report` 호출 시 `CRON_SECRET` 없으면 401 반환 확인
- [ ] 조치 필요/주의/추적불가 테이블 데이터 정확성 확인
- [ ] `mtlrus@mtlb.co.kr` 수신 + `iskang@mtlb.co.kr` CC 확인
- [ ] 날짜 포맷 `"5월 19일(월)"` 형식 확인

### unknown signal
- [ ] `container_tracking_unknown` alert → 마커 진회색(#475569) 표시 확인
- [ ] detail 패널 +N일 배지 진회색 확인
- [ ] signal chip '추적불가' 표시 + 필터 동작 확인
- [ ] actionNeeded 패널에 unknown 컨테이너 포함 확인

### 클러스터 클릭
- [ ] 클러스터 클릭 → detail 패널에 해당 컨테이너 목록 표시 확인
- [ ] 다른 클러스터 선택 시 signalFilter + detailSort 자동 리셋 확인
- [ ] 단일 마커 클릭 여전히 정상 동작 확인

### 마커/지도
- [ ] 리셋 버튼 → 현재 컨테이너 분포에 맞게 fitBounds 확인
- [ ] zoom 3~10 사이 마커 크기 변화 확인
- [ ] zoom 7 이상에서 컨테이너 번호 레이블 표시 확인
- [ ] clusterRadius 축소로 인근 마커 덜 뭉치는지 확인

### 장기 체류 정리
- [ ] 20일+ 초과 컨테이너 CleanupBanner 표시 확인
- [ ] Dismiss → 30일간 배너에서 해당 컨테이너 숨김 확인
- [ ] Delete → DB에서 컨테이너 완전 제거 확인

### 기타
- [ ] 조치필요 패널이 최근주문 패널 왼쪽에 표시 확인 (60:40)
- [ ] MessageInput 전송 후 커서가 입력창에 유지 확인
- [ ] SegmentLine alert_reason 한국어 표시 확인
