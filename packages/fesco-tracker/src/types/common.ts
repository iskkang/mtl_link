/**
 * MTL Link 트래킹 공통 도메인 모델
 *
 * FESCO 응답을 변환해 담을 표준 구조.
 * 나중에 Maersk, Shipsgo 등 다른 소스가 추가돼도 이 모델은 동일.
 */

/** 화물 도착 지역 - 룰 적용의 기준 단위 */
export type Region =
  | 'BELARUS'
  | 'UZBEKISTAN'
  | 'KAZAKHSTAN'
  | 'RUSSIA_INLAND'
  | 'RUSSIA_OTHER'
  | 'UNKNOWN';

/** 신호등 - 운영자가 한눈에 봐야 할 우선순위 */
export type Signal = 'green' | 'yellow' | 'red' | 'unknown';

/** 운송 단계 (블라디 도착을 기준점으로 분해) */
export type Phase =
  | 'BEFORE_DEPARTURE' // 부산 출항 전 (적입/대기)
  | 'AT_SEA'           // 해상 운송 중
  | 'AT_VLADIVOSTOK'   // 블라디 도착 (통관 + 발차 대기)
  | 'ON_TSR'           // TSR/철도 운송 중
  | 'AT_DESTINATION'   // 최종 도착
  | 'UNKNOWN';

/** 단계별 세부 상태 */
export type PhaseDetail =
  | 'CARGO_PICKUP'
  | 'AT_PORT_BUSAN'
  | 'SAILING'
  | 'CUSTOMS_PENDING'
  | 'CUSTOMS_OVERDUE'
  | 'WAITING_DEPARTURE'
  | 'DEPARTURE_OVERDUE'
  | 'RAILWAY_MOVING'
  | 'ARRIVED'
  | 'UNKNOWN';

export type SegmentType = 'sea' | 'rail' | 'truck';

/** 공통 트래킹 결과 (MTL 표준) */
export interface CommonTracking {
  // 식별자
  containerNumber: string;
  billNumbers: string[];
  orderNumber: string | null;

  // 라우팅
  origin: LocationRef;
  destination: LocationRef;
  region: Region;

  // 단계 + 신호
  phase: Phase;
  phaseDetail: PhaseDetail;
  signal: Signal;
  message: string; // 운영자에게 보여줄 한 줄

  // 시간 정보
  departureFromBusan: DateInfo;
  arrivalAtVladivostok: DateInfo;
  departureFromVladivostok: DateInfo;
  arrivalAtDestination: DateInfo;

  // 룰 체크 결과
  ruleCheck: RuleCheckResult;

  // 현재 위치
  currentLocation: LocationSnapshot | null;

  // 세그먼트 요약 (UI 단계 트래커용)
  segments: SegmentSummary[];

  // 이벤트 (최신 → 과거)
  events: EventSummary[];

  // 원본 + 메타
  source: 'fesco';
  lastUpdated: Date;
  rawAvailable: boolean; // events.data가 비어있는지 등
}

export interface LocationRef {
  name: string;
  country: string;
  countryRaw: string; // FESCO 원본
}

export interface DateInfo {
  planned: Date | null;
  actual: Date | null;
  isOverdue: boolean;
  delayDays: number | null;
}

export interface LocationSnapshot {
  name: string;
  country: string;
  date: Date;
  operation: string; // "Wagon has left the station" 등
  transport: string | null;
  remainingKm: number | null;
  totalKm: number | null;
  progressPercent: number | null;
}

export interface SegmentSummary {
  order: number;
  type: SegmentType;
  from: string;
  to: string;
  status: 'completed' | 'in_progress' | 'planned';
  plannedDeparture: Date | null;
  plannedArrival: Date | null;
  actualDeparture: Date | null;
  actualArrival: Date | null;
  transport: { name: string; voyage: string | null } | null;
}

export interface EventSummary {
  date: Date;
  location: string;
  operation: string;
  transport: string | null;
  remainingKm: number | null;
  totalKm: number | null;
}

export interface RuleCheckResult {
  appliedRule: RegionRule | null;

  // 통관 단계 체크
  customsDaysElapsed: number | null;
  customsLimit: number | null;
  customsStatus: 'not_started' | 'in_progress' | 'completed' | 'overdue';

  // 발차 단계 체크
  departureDaysElapsed: number | null;
  departureLimit: number | null;
  departureStatus: 'not_started' | 'in_progress' | 'completed' | 'overdue';

  // 종합
  overallStatus: 'normal' | 'warning' | 'critical';
  notes: string[];
}

/** 도착지별 운영 룰 정의 */
export interface RegionRule {
  region: Region;
  label: string;
  customs: {
    normalDays: number;
    warningDays: number;
    criticalDays: number;
  };
  departure: {
    normalDays: number;
    warningDays: number;
    criticalDays: number;
  };
}
