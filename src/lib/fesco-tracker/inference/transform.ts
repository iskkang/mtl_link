/**
 * FESCO 응답 → 공통 트래킹 모델 변환기
 *
 * 가장 어려운 부분 두 가지:
 * 1. events.data가 비어있을 때 segments로 추정
 * 2. 블라디 도착일을 다양한 소스에서 찾아내기
 */

import type {
  FescoContainer,
  FescoSegment,
  FescoEvent,
} from '../types/fesco.js';
import type {
  CommonTracking,
  DateInfo,
  EventSummary,
  LocationSnapshot,
  SegmentSummary,
  SegmentType as CommonSegmentType,
} from '../types/common.js';
import { resolveRegion } from '../domain/rules.js';
import { parseFescoDate, daysBetween, todayUTC } from '../utils/date.js';
import { inferPhaseAndSignal } from './phase.js';
import { evaluateRules } from './rule-check.js';

const SEGMENT_TYPE_MAP: Record<string, CommonSegmentType> = {
  SEA: 'sea',
  RR: 'rail',
  TR: 'truck',
};

/** B/L 필드 정규화 (string 또는 string[]) */
function normalizeBills(bills: string[] | string | undefined): string[] {
  if (!bills) return [];
  if (Array.isArray(bills)) return bills.filter(Boolean);
  return bills.split(',').map((s) => s.trim()).filter(Boolean);
}

/** remainingDistance 정규화 (string | number | null) */
function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

/** 첫 번째 SEA segment (부산→블라디 구간) 찾기 */
function findSeaToVladi(segments: FescoSegment[]): FescoSegment | null {
  return (
    segments.find(
      (s) =>
        s.segmentType === 'SEA' &&
        s.destinationLocationEn.toLowerCase().includes('vladivostok'),
    ) ?? null
  );
}

/** 블라디 출발 segment (RR/TR 중 출발지가 블라디) 찾기 */
function findDepartureFromVladi(segments: FescoSegment[]): FescoSegment | null {
  return (
    segments.find(
      (s) =>
        (s.segmentType === 'RR' || s.segmentType === 'TR') &&
        s.departureLocationEn.toLowerCase().includes('vladivostok'),
    ) ?? null
  );
}

/** 마지막 segment (최종 도착지) 찾기 */
function findFinalSegment(segments: FescoSegment[]): FescoSegment | null {
  if (segments.length === 0) return null;
  return segments[segments.length - 1] ?? null;
}

/** 가장 최근 이벤트 (events는 보통 date 내림차순으로 옴) */
function findLatestEvent(events: FescoEvent[]): FescoEvent | null {
  if (events.length === 0) return null;
  const sorted = [...events].sort((a, b) => {
    const da = parseFescoDate(a.date)?.getTime() ?? 0;
    const db = parseFescoDate(b.date)?.getTime() ?? 0;
    return db - da;
  });
  return sorted[0] ?? null;
}

/** 이벤트 중 블라디 관련 도착 이벤트 찾기 (통관 시작점 추정) */
function findVladiArrivalEvent(events: FescoEvent[]): FescoEvent | null {
  return (
    events.find((e) => {
      const loc = e.locationLatin.toLowerCase();
      const op = e.operationLatin.toLowerCase();
      return (
        loc.includes('vladivostok') &&
        (op.includes('arrival') || op.includes('discharg'))
      );
    }) ?? null
  );
}

/** Segment를 SegmentSummary로 변환 */
function toSegmentSummary(seg: FescoSegment, order: number): SegmentSummary {
  let status: SegmentSummary['status'];
  if (seg.completed) status = 'completed';
  else if (seg.inProgress) status = 'in_progress';
  else status = 'planned';

  return {
    order,
    type: SEGMENT_TYPE_MAP[seg.segmentType] ?? 'sea',
    from: seg.departureLocationEn,
    to: seg.destinationLocationEn,
    status,
    plannedDeparture: parseFescoDate(seg.planingDepartureDate),
    plannedArrival: parseFescoDate(seg.planingDestinationDate),
    actualDeparture: parseFescoDate(seg.departureDate),
    actualArrival: parseFescoDate(seg.destinationDate),
    transport: seg.transport?.nameLatin
      ? {
          name: seg.transport.nameLatin,
          voyage: seg.transport.voyageNumber,
        }
      : null,
  };
}

/** Event를 EventSummary로 변환 */
function toEventSummary(ev: FescoEvent): EventSummary {
  return {
    date: parseFescoDate(ev.date) ?? new Date(0),
    location: ev.locationLatin,
    operation: ev.operationLatin,
    transport: ev.transportLatin,
    remainingKm: toNumber(ev.remainingDistance),
    totalKm: typeof ev.totalDistance === 'number' ? ev.totalDistance : null,
  };
}

/** 현재 위치 스냅샷 추출 (가장 최근 이벤트 기반) */
function buildCurrentLocation(
  events: FescoEvent[],
): LocationSnapshot | null {
  const latest = findLatestEvent(events);
  if (!latest) return null;

  const remainingKm = toNumber(latest.remainingDistance);
  const totalKm = typeof latest.totalDistance === 'number' ? latest.totalDistance : null;
  let progress: number | null = null;
  if (remainingKm !== null && totalKm !== null && totalKm > 0) {
    progress = Math.round(((totalKm - remainingKm) / totalKm) * 100);
  }

  return {
    name: latest.locationLatin.trim(),
    country: '', // 이벤트에 국가 정보 없음, 추후 보강 가능
    date: parseFescoDate(latest.date) ?? new Date(0),
    operation: latest.operationLatin,
    transport: latest.transportLatin,
    remainingKm,
    totalKm,
    progressPercent: progress,
  };
}

/** DateInfo 빌더 */
function buildDateInfo(
  planned: Date | null,
  actual: Date | null,
): DateInfo {
  const delay = daysBetween(planned, actual);
  return {
    planned,
    actual,
    isOverdue: delay !== null && delay > 0,
    delayDays: delay,
  };
}

/**
 * 메인 변환 함수
 *
 * @param container FESCO 응답의 단일 컨테이너 데이터
 * @param now 현재 시각 (테스트용으로 주입 가능)
 */
export function transformFescoContainer(
  container: FescoContainer,
  now: Date = new Date(),
): CommonTracking {
  const segments = container.segments ?? [];
  const events = container.events?.data ?? [];

  // --- 라우팅 ---
  const seaSeg = findSeaToVladi(segments);
  const finalSeg = findFinalSegment(segments);

  const origin = seaSeg
    ? {
        name: seaSeg.departureLocationEn,
        country: seaSeg.countryOfDepartureLocationEn,
        countryRaw: seaSeg.countryOfDepartureLocation,
      }
    : { name: 'Unknown', country: 'Unknown', countryRaw: '' };

  const destination = finalSeg
    ? {
        name: finalSeg.destinationLocationEn,
        country: finalSeg.countryOfDestinationLocationEn,
        countryRaw: finalSeg.countryOfDestinationLocation,
      }
    : { name: 'Unknown', country: 'Unknown', countryRaw: '' };

  const region = resolveRegion(destination.name, destination.country);

  // --- 핵심 시간점 추출 ---
  // 부산 출항
  const departureFromBusan = buildDateInfo(
    parseFescoDate(seaSeg?.planingDepartureDate),
    parseFescoDate(seaSeg?.departureDate),
  );

  // 블라디 도착 (우선순위: SEA segment 실도착 → 이벤트 → 계획)
  const vladiArrivalEvent = findVladiArrivalEvent(events);
  const vladiArrivalActual =
    parseFescoDate(seaSeg?.destinationDate) ??
    parseFescoDate(vladiArrivalEvent?.date);
  const arrivalAtVladivostok = buildDateInfo(
    parseFescoDate(seaSeg?.planingDestinationDate),
    vladiArrivalActual,
  );

  // 블라디 출발 (RR/TR 시작점)
  const vladiDepartSeg = findDepartureFromVladi(segments);
  const departureFromVladivostok = buildDateInfo(
    parseFescoDate(vladiDepartSeg?.planingDepartureDate),
    parseFescoDate(vladiDepartSeg?.departureDate),
  );

  // 최종 도착
  const arrivalAtDestination = buildDateInfo(
    parseFescoDate(finalSeg?.planingDestinationDate),
    parseFescoDate(finalSeg?.destinationDate),
  );

  // --- 룰 평가 ---
  const ruleCheck = evaluateRules({
    region,
    vladiArrival: arrivalAtVladivostok.actual,
    vladiDeparture: departureFromVladivostok.actual,
    now: todayUTC(now),
  });

  // --- 단계 + 신호 추론 ---
  const { phase, phaseDetail, signal, message } = inferPhaseAndSignal({
    segments,
    events,
    region,
    departureFromBusan,
    arrivalAtVladivostok,
    departureFromVladivostok,
    arrivalAtDestination,
    ruleCheck,
    now: todayUTC(now),
  });

  // --- 보조 데이터 ---
  const currentLocation = buildCurrentLocation(events);
  const segmentSummaries = segments.map((s, i) => toSegmentSummary(s, i + 1));
  const eventSummaries = events
    .map(toEventSummary)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    containerNumber: container.containerNumber,
    billNumbers: normalizeBills(container.order?.bills),
    orderNumber: container.order?.orderId ?? null,
    origin,
    destination,
    region,
    phase,
    phaseDetail,
    signal,
    message,
    departureFromBusan,
    arrivalAtVladivostok,
    departureFromVladivostok,
    arrivalAtDestination,
    ruleCheck,
    currentLocation,
    segments: segmentSummaries,
    events: eventSummaries,
    source: 'fesco',
    lastUpdated: now,
    rawAvailable: events.length > 0,
  };
}
