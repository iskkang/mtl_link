/**
 * 운송 단계 판별 + 신호등 결정
 *
 * 알고리즘:
 *  1) segments의 currentSegment / completed / inProgress 플래그로 단계 결정
 *  2) 단계에 따라 적절한 룰 적용 (통관 / 발차 / TSR)
 *  3) 룰 결과로 신호등 색 결정
 *  4) 운영자에게 보여줄 한 줄 메시지 생성
 */

import type { FescoSegment, FescoEvent } from '../types/fesco.js';
import type {
  Phase,
  PhaseDetail,
  Signal,
  Region,
  DateInfo,
  RuleCheckResult,
} from '../types/common.js';
import { daysBetween } from '../utils/date.js';

interface InferContext {
  segments: FescoSegment[];
  events: FescoEvent[];
  region: Region;
  departureFromBusan: DateInfo;
  arrivalAtVladivostok: DateInfo;
  departureFromVladivostok: DateInfo;
  arrivalAtDestination: DateInfo;
  ruleCheck: RuleCheckResult;
  now: Date;
}

export interface InferResult {
  phase: Phase;
  phaseDetail: PhaseDetail;
  signal: Signal;
  message: string;
}

export function inferPhaseAndSignal(ctx: InferContext): InferResult {
  const { segments, arrivalAtVladivostok, departureFromVladivostok, ruleCheck, now } = ctx;

  // --- 1) 최종 도착 확인 ---
  const finalSeg = segments[segments.length - 1];
  if (finalSeg && finalSeg.completed && finalSeg.destinationDate) {
    return {
      phase: 'AT_DESTINATION',
      phaseDetail: 'ARRIVED',
      signal: 'green',
      message: '최종 목적지 도착 완료',
    };
  }

  // --- 2) 현재 진행 중인 segment 식별 ---
  const currentSeg = segments.find((s) => s.currentSegment);

  // --- 3) 부산 출항 전 (해상 segment가 시작 안 됨) ---
  const seaSeg = segments.find((s) => s.segmentType === 'SEA');
  const seaStarted = seaSeg?.departureDate || seaSeg?.completed;

  if (!seaStarted) {
    // 부산 항만 적재 등
    const latestEvent = ctx.events[0];
    const detail: PhaseDetail = latestEvent?.locationLatin
      ?.toUpperCase()
      .includes('PUSAN')
      ? 'AT_PORT_BUSAN'
      : 'CARGO_PICKUP';
    return {
      phase: 'BEFORE_DEPARTURE',
      phaseDetail: detail,
      signal: 'green',
      message: '부산 출항 대기 중',
    };
  }

  // --- 4) 해상 운송 중 ---
  if (currentSeg?.segmentType === 'SEA') {
    return {
      phase: 'AT_SEA',
      phaseDetail: 'SAILING',
      signal: 'green',
      message: buildSailingMessage(ctx),
    };
  }

  // --- 5) 블라디 도착 + 아직 발차 안 함 (통관 + 대기) ---
  const vladiArrived = !!arrivalAtVladivostok.actual;
  const vladiDeparted = !!departureFromVladivostok.actual;

  if (vladiArrived && !vladiDeparted) {
    // 통관 + 발차 대기 단계
    const days = daysBetween(arrivalAtVladivostok.actual, now);
    const customsStatus = ruleCheck.customsStatus;

    let signal: Signal;
    let detail: PhaseDetail;
    let msg: string;

    if (customsStatus === 'overdue') {
      signal = 'red';
      detail = 'CUSTOMS_OVERDUE';
      msg = `블라디 통관 ${days}일차 — 기준 초과 (조치 필요)`;
    } else if (
      ruleCheck.customsLimit !== null &&
      days !== null &&
      days >= ruleCheck.customsLimit
    ) {
      signal = 'yellow';
      detail = 'CUSTOMS_PENDING';
      msg = `블라디 통관 ${days}일차 / 기준 ${ruleCheck.customsLimit}일`;
    } else {
      signal = 'green';
      detail = 'CUSTOMS_PENDING';
      msg = `블라디 통관 ${days ?? '?'}일차 진행 중`;
    }

    return { phase: 'AT_VLADIVOSTOK', phaseDetail: detail, signal, message: msg };
  }

  // --- 6) TSR/철도 운송 중 (블라디 발차 완료, 최종 미도착) ---
  if (vladiDeparted) {
    const railSeg = segments.find(
      (s) =>
        (s.segmentType === 'RR' || s.segmentType === 'TR') &&
        (s.inProgress || s.currentSegment),
    );

    let signal: Signal = 'green';
    let detail: PhaseDetail = 'RAILWAY_MOVING';
    let msg = buildRailwayMessage(ctx, railSeg);

    // 발차 지연 룰 체크 (블라디 도착 후 너무 오래 걸렸다면)
    if (ruleCheck.departureStatus === 'overdue') {
      signal = 'red';
      detail = 'DEPARTURE_OVERDUE';
      msg = `발차 ${ruleCheck.departureDaysElapsed}일 초과 — 조치 필요`;
    } else if (
      ruleCheck.departureLimit !== null &&
      ruleCheck.departureDaysElapsed !== null &&
      ruleCheck.departureDaysElapsed >= ruleCheck.departureLimit
    ) {
      signal = 'yellow';
    }

    return { phase: 'ON_TSR', phaseDetail: detail, signal, message: msg };
  }

  // --- 7) 알 수 없음 (데이터 누락 등) ---
  return {
    phase: 'UNKNOWN',
    phaseDetail: 'UNKNOWN',
    signal: 'unknown',
    message: '상태를 확인하려면 데이터 갱신 필요',
  };
}

function buildSailingMessage(ctx: InferContext): string {
  const planned = ctx.arrivalAtVladivostok.planned;
  if (!planned) return '해상 운송 중';
  const days = daysBetween(ctx.now, planned);
  if (days === null) return '해상 운송 중';
  if (days >= 0) return `해상 운송 중 — 블라디 도착 ${days}일 후 예정`;
  return `해상 운송 중 — ETA ${Math.abs(days)}일 경과`;
}

function buildRailwayMessage(
  ctx: InferContext,
  railSeg: FescoSegment | undefined,
): string {
  const latest = ctx.events[0];
  const remainingKm = latest?.remainingDistance
    ? parseFloat(latest.remainingDistance)
    : null;

  if (remainingKm !== null && !isNaN(remainingKm)) {
    if (remainingKm < 100) return `TSR 운송 중 — ${remainingKm}km 남음 (도착 임박)`;
    return `TSR 운송 중 — ${remainingKm.toLocaleString()}km 남음`;
  }
  if (railSeg) {
    return `${railSeg.departureLocationEn} → ${railSeg.destinationLocationEn} 철도 운송 중`;
  }
  return 'TSR 운송 중';
}
