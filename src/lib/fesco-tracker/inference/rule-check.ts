/**
 * 룰 체크 — 통관/발차 일수가 region 기준을 넘었는지 평가
 *
 * 사용자가 정한 룰 해석:
 * - 통관과 발차는 각각 독립적으로 카운트
 * - 통관 t₀ = 블라디 도착일
 * - 발차 t₀ = 블라디 도착일 (통관 시간 포함한 누적)
 *   → 즉 "도착 후 N일 안에 발차해야 한다"는 기준
 *
 * 이 해석은 사용자가 알려주신 "통관 완료 이후 N일 정도 대기 후 발차"라는
 * 운영 패턴과 일치. 통관과 발차가 직렬로 일어나는 모델.
 */

import type { Region, RuleCheckResult } from '../types/common.js';
import { getRuleForRegion } from '../domain/rules.js';
import { daysBetween } from '../utils/date.js';

export interface EvaluateInput {
  region: Region;
  vladiArrival: Date | null;
  vladiDeparture: Date | null;
  now: Date;
}

export function evaluateRules(input: EvaluateInput): RuleCheckResult {
  const rule = getRuleForRegion(input.region);
  const notes: string[] = [];

  if (!rule) {
    return {
      appliedRule: null,
      customsDaysElapsed: null,
      customsLimit: null,
      customsStatus: 'not_started',
      departureDaysElapsed: null,
      departureLimit: null,
      departureStatus: 'not_started',
      overallStatus: 'normal',
      notes: ['도착지 region을 식별할 수 없어 룰 미적용'],
    };
  }

  // --- 통관 평가 ---
  let customsDaysElapsed: number | null = null;
  let customsStatus: RuleCheckResult['customsStatus'] = 'not_started';

  if (input.vladiArrival) {
    const endpoint = input.vladiDeparture ?? input.now;
    customsDaysElapsed = daysBetween(input.vladiArrival, endpoint);

    if (customsDaysElapsed === null) {
      customsStatus = 'not_started';
    } else if (input.vladiDeparture) {
      // 통관 완료 (발차 이미 일어남)
      customsStatus = 'completed';
      if (customsDaysElapsed > rule.customs.criticalDays) {
        notes.push(
          `통관 ${customsDaysElapsed}일 (기준 ${rule.customs.normalDays}일) — 사후 critical`,
        );
      } else if (customsDaysElapsed > rule.customs.normalDays) {
        notes.push(
          `통관 ${customsDaysElapsed}일 (기준 ${rule.customs.normalDays}일) — 사후 초과`,
        );
      }
    } else {
      // 통관 진행 중
      if (customsDaysElapsed > rule.customs.criticalDays) {
        customsStatus = 'overdue';
        notes.push(`통관 ${customsDaysElapsed}일 초과 — 즉시 확인`);
      } else if (customsDaysElapsed > rule.customs.warningDays) {
        customsStatus = 'overdue';
        notes.push(`통관 ${customsDaysElapsed}일 — 경고 한도 초과`);
      } else if (customsDaysElapsed > rule.customs.normalDays) {
        customsStatus = 'in_progress';
        notes.push(`통관 ${customsDaysElapsed}일 — 주의`);
      } else {
        customsStatus = 'in_progress';
      }
    }
  }

  // --- 발차 평가 ---
  let departureDaysElapsed: number | null = null;
  let departureStatus: RuleCheckResult['departureStatus'] = 'not_started';

  if (input.vladiArrival) {
    if (input.vladiDeparture) {
      // 발차 완료
      departureDaysElapsed = daysBetween(input.vladiArrival, input.vladiDeparture);
      departureStatus = 'completed';
      if (
        departureDaysElapsed !== null &&
        departureDaysElapsed > rule.departure.criticalDays
      ) {
        notes.push(
          `발차 ${departureDaysElapsed}일 (기준 ${rule.departure.normalDays}일) — 사후 critical`,
        );
      } else if (
        departureDaysElapsed !== null &&
        departureDaysElapsed > rule.departure.normalDays
      ) {
        notes.push(
          `발차 ${departureDaysElapsed}일 (기준 ${rule.departure.normalDays}일) — 사후 초과`,
        );
      }
    } else {
      // 발차 대기 중
      departureDaysElapsed = daysBetween(input.vladiArrival, input.now);
      if (
        departureDaysElapsed !== null &&
        departureDaysElapsed > rule.departure.criticalDays
      ) {
        departureStatus = 'overdue';
        notes.push(`발차 ${departureDaysElapsed}일 초과 — 즉시 확인`);
      } else if (
        departureDaysElapsed !== null &&
        departureDaysElapsed > rule.departure.warningDays
      ) {
        departureStatus = 'overdue';
        notes.push(`발차 ${departureDaysElapsed}일 — 경고 한도 초과`);
      } else if (
        departureDaysElapsed !== null &&
        departureDaysElapsed > rule.departure.normalDays
      ) {
        departureStatus = 'in_progress';
        notes.push(`발차 ${departureDaysElapsed}일 — 주의`);
      } else {
        departureStatus = 'in_progress';
      }
    }
  }

  // --- 종합 ---
  let overallStatus: RuleCheckResult['overallStatus'] = 'normal';
  if (customsStatus === 'overdue' || departureStatus === 'overdue') {
    overallStatus = 'critical';
  } else if (
    customsStatus === 'in_progress' &&
    customsDaysElapsed !== null &&
    customsDaysElapsed > rule.customs.normalDays
  ) {
    overallStatus = 'warning';
  } else if (
    departureStatus === 'in_progress' &&
    departureDaysElapsed !== null &&
    departureDaysElapsed > rule.departure.normalDays
  ) {
    overallStatus = 'warning';
  }

  return {
    appliedRule: rule,
    customsDaysElapsed,
    customsLimit: rule.customs.normalDays,
    customsStatus,
    departureDaysElapsed,
    departureLimit: rule.departure.normalDays,
    departureStatus,
    overallStatus,
    notes,
  };
}
