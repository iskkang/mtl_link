/**
 * MTL FESCO Tracker — 메인 진입점
 *
 * 사용 예시:
 *
 *   import { FescoClient, transformFescoContainer } from '@mtl/fesco-tracker';
 *
 *   const client = new FescoClient();
 *   const res = await client.trackOne('FESU5332167');
 *   const tracking = transformFescoContainer(res.data[0]);
 *
 *   if (tracking.signal === 'red') {
 *     alert(tracking.message);
 *   }
 */

// Public API
export { FescoClient, FescoApiError } from './adapters/fesco-client.js';
export { transformFescoContainer } from './inference/transform.js';
export { evaluateRules } from './inference/rule-check.js';
export { inferPhaseAndSignal } from './inference/phase.js';
export {
  REGION_RULES,
  CITY_TO_REGION,
  COUNTRY_TO_REGION,
  resolveRegion,
  getRuleForRegion,
} from './domain/rules.js';

// Types - FESCO 원본
export type {
  FescoTrackingResponse,
  FescoContainer,
  FescoSegment,
  FescoEvent,
  FescoTransport,
  FescoOrder,
  EventType,
  OwnerShip,
  TrackingType,
  SegmentType as FescoSegmentType,
} from './types/fesco.js';

// Types - 공통 모델
export type * from './types/common.js';

// Utils (선택적 노출)
export { parseFescoDate, daysBetween, formatDate, formatDateKR } from './utils/date.js';

/**
 * 가장 자주 쓰일 편의 함수:
 * 컨테이너 번호 하나로 공개 API 조회 + 변환까지 한 번에.
 */
import { FescoClient } from './adapters/fesco-client.js';
import { transformFescoContainer } from './inference/transform.js';
import type { CommonTracking } from './types/common.js';

export async function trackContainer(
  containerNumber: string,
  options: { client?: FescoClient; now?: Date } = {},
): Promise<CommonTracking | null> {
  const client = options.client ?? new FescoClient();
  const res = await client.trackOne(containerNumber);
  const container = res.data[0];
  if (!container) return null;
  return transformFescoContainer(container, options.now);
}
