/**
 * MTL 도메인 룰 — 도착지별 SLA 기준
 *
 * 사용자가 제공한 운영 경험치:
 * - 우즈벡: 통관 5-10일 정상, 발차 ~2주 정상 (이상 시 delay)
 * - 러시아 내륙(모스크바, 예카테린부르크): 통관 8일, 발차 7-10일
 * - 벨라루스(민스크 등): 통관 8일, 발차 10일
 *
 * 이 룰은 사내 정책 문서를 코드로 표현한 것.
 * 변경 시 이 파일만 수정 → 추론 엔진이 자동 반영.
 */

import type { Region, RegionRule } from '../types/common.js';

export const REGION_RULES: Record<Region, RegionRule | null> = {
  BELARUS: {
    region: 'BELARUS',
    label: '벨라루스',
    customs:   { normalDays: 8,  warningDays: 10, criticalDays: 12 },
    departure: { normalDays: 10, warningDays: 13, criticalDays: 15 },
  },
  UZBEKISTAN: {
    region: 'UZBEKISTAN',
    label: '우즈베키스탄',
    customs:   { normalDays: 10, warningDays: 12, criticalDays: 15 },
    departure: { normalDays: 14, warningDays: 18, criticalDays: 21 },
  },
  KAZAKHSTAN: {
    region: 'KAZAKHSTAN',
    label: '카자흐스탄',
    customs:   { normalDays: 10, warningDays: 12, criticalDays: 15 },
    departure: { normalDays: 14, warningDays: 18, criticalDays: 21 },
  },
  RUSSIA_INLAND: {
    region: 'RUSSIA_INLAND',
    label: '러시아 내륙',
    customs:   { normalDays: 8,  warningDays: 10, criticalDays: 12 },
    departure: { normalDays: 10, warningDays: 13, criticalDays: 15 },
  },
  RUSSIA_OTHER: {
    region: 'RUSSIA_OTHER',
    label: '러시아 기타',
    customs:   { normalDays: 10, warningDays: 13, criticalDays: 15 },
    departure: { normalDays: 12, warningDays: 15, criticalDays: 18 },
  },
  UNKNOWN: null,
};

/**
 * 도시명 → Region 매핑 테이블
 *
 * FESCO 응답의 destinationLocationEn 또는 countryOfDestinationLocationEn을
 * 우리 룰의 region으로 변환.
 *
 * 키는 소문자로 보관, 매칭 시 입력도 소문자로 변환해 비교.
 * 새 도시 발견 시 이 테이블에 추가 → 자동 반영.
 */
export const CITY_TO_REGION: Record<string, Region> = {
  // 벨라루스
  'koljadichi': 'BELARUS',
  'minsk': 'BELARUS',
  'shabany': 'BELARUS',
  'brest': 'BELARUS',

  // 우즈베키스탄
  'chukursaj': 'UZBEKISTAN',
  'chukursai': 'UZBEKISTAN',
  'tashkent': 'UZBEKISTAN',
  'samarkand': 'UZBEKISTAN',

  // 카자흐스탄
  'almaty': 'KAZAKHSTAN',
  'astana': 'KAZAKHSTAN',
  'nur-sultan': 'KAZAKHSTAN',

  // 러시아 내륙 (주요 거점)
  'moscow': 'RUSSIA_INLAND',
  'belyj rast': 'RUSSIA_INLAND',
  'ekaterinburg': 'RUSSIA_INLAND',
  'yekaterinburg': 'RUSSIA_INLAND',
  'novosibirsk': 'RUSSIA_INLAND',
  'krasnoyarsk': 'RUSSIA_INLAND',
};

/** 국가 코드 → Region 매핑 (도시 매칭 실패 시 폴백) */
export const COUNTRY_TO_REGION: Record<string, Region> = {
  'belarus': 'BELARUS',
  'uzbekistan': 'UZBEKISTAN',
  'kazakhstan': 'KAZAKHSTAN',
  'the russian federation': 'RUSSIA_OTHER', // 도시로 판별 못 하면 일반 러시아
  'russia': 'RUSSIA_OTHER',
};

/**
 * FESCO 응답에서 region 추론
 * 우선순위: 도시명 매칭 → 국가 매칭 → UNKNOWN
 */
export function resolveRegion(
  destinationCity: string | null | undefined,
  destinationCountry: string | null | undefined,
): Region {
  if (destinationCity) {
    const cityKey = destinationCity.toLowerCase().trim();
    if (CITY_TO_REGION[cityKey]) return CITY_TO_REGION[cityKey];
  }
  if (destinationCountry) {
    const countryKey = destinationCountry.toLowerCase().trim();
    if (COUNTRY_TO_REGION[countryKey]) return COUNTRY_TO_REGION[countryKey];
  }
  return 'UNKNOWN';
}

/** Region 룰 조회 */
export function getRuleForRegion(region: Region): RegionRule | null {
  return REGION_RULES[region];
}
