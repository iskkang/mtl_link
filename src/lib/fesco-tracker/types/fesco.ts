/**
 * FESCO API 응답 타입 정의
 *
 * 출처: https://my.fesco.com/api/v2/lk/tracking
 * 실제 응답 데이터(BMOU4891889, FESU5332167)를 기반으로 작성.
 *
 * 중요: OpenAPI 스펙이 일부 누락하거나 잘못 표기한 부분을 실데이터로 보정함.
 * 특히 많은 필드가 null로 올 수 있어 모두 nullable 처리.
 */

export type SegmentType = 'SEA' | 'RR' | 'TR';
export type OwnerShip = 'COC' | 'SOC';
export type TrackingType = 'fit' | 'drt' | 'schedule';

/** FESCO 이벤트 타입 */
export type EventType = 'softship' | 'rts' | string; // 그 외에도 올 수 있음

/** 운송 수단 정보 (선박, 열차 등) */
export interface FescoTransport {
  name: string | null;
  nameLatin: string | null;
  voyageNumber: string | null;
}

/** 단일 트래킹 이벤트 */
export interface FescoEvent {
  containerNumber: string;
  id: string;
  date: string; // ISO 또는 "YYYY-MM-DD HH:mm:ss"
  type: EventType;
  operationId: string;

  totalDistance: number | null;
  remainingDistance: string | null; // 문자열 또는 null로 옴

  location: string;
  locationLatin: string;
  locationCN: string;
  locationVN: string;

  operation: string;
  operationLatin: string;
  operationCN: string;
  operationVN: string;

  transport: string | null;
  transportLatin: string | null;
}

/** 운송 세그먼트 (해상/철도/트럭 한 구간) */
export interface FescoSegment {
  containerNumber: string;
  id: string;
  segmentType: SegmentType;

  prebooking: boolean;
  currentSegment: boolean;
  completed: boolean;
  inProgress: boolean;
  plan: boolean;
  telex: boolean;

  departureDate: string | null;
  destinationDate: string | null;
  planingDepartureDate: string | null;
  planingDestinationDate: string | null;

  transport: FescoTransport;
  remainingDistance: string | number | null;

  departureLocation: string;
  departureLocationEn: string;
  departureLocationCN: string;
  departureLocationVN: string;
  destinationLocation: string;
  destinationLocationEn: string;
  destinationLocationCN: string;
  destinationLocationVN: string;

  countryOfDepartureLocation: string;
  countryOfDepartureLocationEn: string;
  countryOfDepartureLocationCN: string;
  countryOfDepartureLocationVN: string;
  countryOfDestinationLocation: string;
  countryOfDestinationLocationEn: string;
  countryOfDestinationLocationCN: string;
  countryOfDestinationLocationVN: string;
}

/** 주문 정보 */
export interface FescoOrder {
  orderId?: string;
  rootOrderId?: number;
  type?: string;
  customCode?: number;
  ownerShip: OwnerShip;
  bills: string[] | string; // 문서엔 string, 실데이터엔 array
}

/** 단일 컨테이너의 전체 트래킹 데이터 */
export interface FescoContainer {
  containerNumber: string;
  billId: string | null;
  type: TrackingType;
  unavailable: boolean;
  order: FescoOrder;
  events: {
    data: FescoEvent[];
    lastEventId?: string;
  };
  segments: FescoSegment[];
}

/** API 응답 전체 */
export interface FescoTrackingResponse {
  message: string;
  data: FescoContainer[];
}
