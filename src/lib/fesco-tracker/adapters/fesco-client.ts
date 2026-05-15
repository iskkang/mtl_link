/**
 * FESCO API 클라이언트
 *
 * 핵심 발견: 트래킹 API는 공개되어 있어 토큰 없이도 호출 가능.
 * 그러나 토큰을 옵션으로 제공해 fallback / 더 풍부한 데이터 가능성에 대비.
 *
 * URL: https://my.fesco.com/api/v2/lk/tracking
 * Method: GET
 * Query: numbers (배열 — 컨테이너 번호 또는 B/L 번호)
 */

import type { FescoTrackingResponse } from '../types/fesco.js';

export interface FescoClientOptions {
  baseUrl?: string;
  token?: string; // 옵션 — 없으면 공개 API로 호출
  language?: 'ru' | 'en';
  timeoutMs?: number;
  fetchFn?: typeof fetch; // 테스트용 주입
}

export class FescoApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    message?: string,
  ) {
    super(message ?? `FESCO API error: ${status}`);
    this.name = 'FescoApiError';
  }
}

const DEFAULT_BASE_URL = 'https://my.fesco.com';

export class FescoClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly language: 'ru' | 'en';
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(opts: FescoClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.token = opts.token;
    this.language = opts.language ?? 'en';
    this.timeoutMs = opts.timeoutMs ?? 15_000;
    this.fetchFn = opts.fetchFn ?? ((...args) => globalThis.fetch(...args));
  }

  /**
   * 컨테이너/B/L 번호로 트래킹 조회.
   * 여러 개 한 번에 조회 가능.
   */
  async trackByNumbers(numbers: string[]): Promise<FescoTrackingResponse> {
    if (numbers.length === 0) {
      return { message: 'empty', data: [] };
    }

    const params = new URLSearchParams();
    for (const n of numbers) {
      params.append('numbers', n);
    }
    const url = `${this.baseUrl}/api/v2/lk/tracking?${params.toString()}`;

    const headers: Record<string, string> = {
      'X-Lk-Lang': this.language,
      Accept: 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchFn(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new FescoApiError(res.status, body);
      }

      return (await res.json()) as FescoTrackingResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  /** 편의 메서드: 한 건만 조회 */
  async trackOne(numberOrBl: string): Promise<FescoTrackingResponse> {
    return this.trackByNumbers([numberOrBl]);
  }
}
