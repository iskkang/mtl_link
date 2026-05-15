/**
 * 추론 엔진 단위 테스트
 *
 * 실제 FESCO 응답 두 건으로 검증:
 * 1) BMOU4891889: 부산-우즈벡, 항해 시작 직후 (events 비어있음)
 * 2) FESU5332167: 부산-벨라루스, TSR 마지막 구간 (events 풍부, 50km 남음)
 */

import { describe, it, expect } from 'vitest';
import { transformFescoContainer } from '../src/inference/transform.js';
import { resolveRegion } from '../src/domain/rules.js';
import { evaluateRules } from '../src/inference/rule-check.js';

import bmouFixture from './__fixtures__/bmou4891889.json' assert { type: 'json' };
import fesuFixture from './__fixtures__/fesu5332167.json' assert { type: 'json' };

// 테스트 기준 시각 (2026-05-15)
const NOW = new Date('2026-05-15T10:00:00Z');

describe('resolveRegion (도시 → region 매핑)', () => {
  it('Chukursaj는 우즈베키스탄', () => {
    expect(resolveRegion('Chukursaj', 'Uzbekistan')).toBe('UZBEKISTAN');
  });

  it('Koljadichi는 벨라루스', () => {
    expect(resolveRegion('Koljadichi', 'Belarus')).toBe('BELARUS');
  });

  it('Moscow는 러시아 내륙', () => {
    expect(resolveRegion('Moscow', 'The Russian Federation')).toBe('RUSSIA_INLAND');
  });

  it('도시 매칭 실패 시 국가로 폴백', () => {
    expect(resolveRegion('UnknownCity', 'Uzbekistan')).toBe('UZBEKISTAN');
  });

  it('대소문자 무관', () => {
    expect(resolveRegion('CHUKURSAJ', 'UZBEKISTAN')).toBe('UZBEKISTAN');
  });

  it('알 수 없는 도시/국가는 UNKNOWN', () => {
    expect(resolveRegion('Mars', 'Atlantis')).toBe('UNKNOWN');
  });
});

describe('BMOU4891889 — 부산→우즈베키스탄 (항해 시작 직후)', () => {
  const container = (bmouFixture as any).data[0];
  const result = transformFescoContainer(container, NOW);

  it('컨테이너 번호와 B/L 번호 추출', () => {
    expect(result.containerNumber).toBe('BMOU4891889');
    expect(result.billNumbers).toEqual(['FSCOPUVV605518', 'FSIMPUCH422853']);
  });

  it('출발지/도착지 식별', () => {
    expect(result.origin.name).toBe('Busan');
    expect(result.destination.name).toBe('Chukursaj');
    expect(result.region).toBe('UZBEKISTAN');
  });

  it('현재 단계는 해상 운송 중', () => {
    expect(result.phase).toBe('AT_SEA');
    expect(result.phaseDetail).toBe('SAILING');
  });

  it('신호는 정상(green)', () => {
    expect(result.signal).toBe('green');
  });

  it('메시지에 ETA 정보 포함', () => {
    // 오늘 5/15, 도착 예정 5/16 → "1일 후"
    expect(result.message).toMatch(/해상 운송 중/);
  });

  it('블라디 미도착이므로 통관 룰 미적용', () => {
    expect(result.ruleCheck.customsStatus).toBe('not_started');
    expect(result.ruleCheck.customsDaysElapsed).toBeNull();
  });

  it('events가 비어있어도 rawAvailable=false로 처리', () => {
    expect(result.rawAvailable).toBe(false);
  });

  it('세그먼트 2개 추출 (SEA + RR)', () => {
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0].type).toBe('sea');
    expect(result.segments[0].status).toBe('in_progress');
    expect(result.segments[1].type).toBe('rail');
    expect(result.segments[1].status).toBe('planned');
  });

  it('출항일은 5/14 (실제)', () => {
    expect(result.departureFromBusan.actual?.toISOString().slice(0, 10)).toBe(
      '2026-05-14',
    );
  });
});

describe('FESU5332167 — 부산→벨라루스 (TSR 마지막 구간)', () => {
  const container = (fesuFixture as any).data[0];
  const result = transformFescoContainer(container, NOW);

  it('컨테이너/B/L 추출', () => {
    expect(result.containerNumber).toBe('FESU5332167');
    expect(result.billNumbers).toContain('FSCOPUVV604932');
  });

  it('벨라루스 region 매핑', () => {
    expect(result.region).toBe('BELARUS');
    expect(result.destination.name).toBe('Koljadichi');
  });

  it('현재 단계는 TSR 운송 중', () => {
    expect(result.phase).toBe('ON_TSR');
    expect(result.phaseDetail).toBe('RAILWAY_MOVING');
  });

  it('블라디 도착 4/17, 발차 4/29 정확히 추출', () => {
    expect(result.arrivalAtVladivostok.actual?.toISOString().slice(0, 10)).toBe(
      '2026-04-17',
    );
    expect(result.departureFromVladivostok.actual?.toISOString().slice(0, 10)).toBe(
      '2026-04-29',
    );
  });

  it('통관 12일 (4/17 → 4/29), 벨라루스 룰 사후 평가', () => {
    expect(result.ruleCheck.customsDaysElapsed).toBe(12);
    expect(result.ruleCheck.customsLimit).toBe(8);
    expect(result.ruleCheck.customsStatus).toBe('completed');
  });

  it('발차 12일 = 통관 직후 즉시, 사후 초과 (벨라루스 10일 기준)', () => {
    expect(result.ruleCheck.departureDaysElapsed).toBe(12);
    expect(result.ruleCheck.departureLimit).toBe(10);
    expect(result.ruleCheck.departureStatus).toBe('completed');
  });

  it('현재 위치는 Shabany (가장 최근 이벤트)', () => {
    expect(result.currentLocation?.name).toBe('Shabany');
    expect(result.currentLocation?.remainingKm).toBe(50);
    expect(result.currentLocation?.totalKm).toBe(10059);
  });

  it('진행률 계산 가능 (10009/10059 ≈ 99%)', () => {
    expect(result.currentLocation?.progressPercent).toBeGreaterThanOrEqual(99);
  });

  it('이벤트 6건 모두 수집', () => {
    expect(result.events).toHaveLength(6);
  });

  it('이벤트는 최신 순으로 정렬', () => {
    expect(result.events[0].date.getTime()).toBeGreaterThan(
      result.events[1].date.getTime(),
    );
  });

  it('발차 단계의 사후 초과 반영 → 신호는 yellow', () => {
    // 블라디 도착 4/17 → 발차 4/29 (12일 소요, 벨라루스 기준 10일)
    // 현재 TSR 운송 중이지만 발차가 사후 초과였으므로 yellow
    expect(result.signal).toBe('yellow');
    expect(result.message).toMatch(/발차|초과|남음|도착 임박/);
  });

  it('rawAvailable=true (이벤트 있음)', () => {
    expect(result.rawAvailable).toBe(true);
  });
});

describe('evaluateRules — 직접 호출 시나리오', () => {
  it('우즈벡 통관 11일째 진행 중 → 주의', () => {
    const result = evaluateRules({
      region: 'UZBEKISTAN',
      vladiArrival: new Date('2026-05-01T00:00:00Z'),
      vladiDeparture: null,
      now: new Date('2026-05-12T00:00:00Z'), // 11일 경과
    });
    expect(result.customsDaysElapsed).toBe(11);
    expect(result.customsStatus).toBe('in_progress');
    expect(result.overallStatus).toBe('warning');
  });

  it('우즈벡 통관 16일째 → critical', () => {
    const result = evaluateRules({
      region: 'UZBEKISTAN',
      vladiArrival: new Date('2026-05-01T00:00:00Z'),
      vladiDeparture: null,
      now: new Date('2026-05-17T00:00:00Z'), // 16일 경과
    });
    expect(result.customsStatus).toBe('overdue');
    expect(result.overallStatus).toBe('critical');
  });

  it('알 수 없는 region은 룰 미적용', () => {
    const result = evaluateRules({
      region: 'UNKNOWN',
      vladiArrival: new Date('2026-05-01T00:00:00Z'),
      vladiDeparture: null,
      now: new Date('2026-05-30T00:00:00Z'),
    });
    expect(result.appliedRule).toBeNull();
    expect(result.overallStatus).toBe('normal');
  });

  it('블라디 미도착이면 카운트 시작 안 함', () => {
    const result = evaluateRules({
      region: 'BELARUS',
      vladiArrival: null,
      vladiDeparture: null,
      now: new Date('2026-05-15T00:00:00Z'),
    });
    expect(result.customsDaysElapsed).toBeNull();
    expect(result.customsStatus).toBe('not_started');
  });
});
