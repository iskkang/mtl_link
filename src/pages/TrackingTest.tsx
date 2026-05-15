/**
 * FESCO 트래킹 추론 엔진 동작 검증용 임시 페이지
 *
 * 목적: 추론 엔진이 MTL_Link 환경에서 정상 동작하는지 확인
 * 위치: /tracking-test (라우터에 등록 후 접근)
 */

import { useState } from 'react';
import type { CommonTracking } from '../lib/fesco-tracker';

const SIGNAL_COLOR: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  yellow: 'bg-amber-100 text-amber-900 border-amber-300',
  red: 'bg-red-100 text-red-900 border-red-300',
  unknown: 'bg-gray-100 text-gray-900 border-gray-300',
};

const SIGNAL_EMOJI: Record<string, string> = {
  green: '🟢',
  yellow: '🟡',
  red: '🔴',
  unknown: '⚪',
};

export default function TrackingTest() {
  const [containerNumber, setContainerNumber] = useState('FESU5332167');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CommonTracking | null>(null);

  async function handleTrack() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/tracking?numbers=${encodeURIComponent(containerNumber.trim())}`);
      const json = await res.json() as CommonTracking[] | { error: string };
      if (!res.ok || 'error' in json) {
        setError(`호출 실패: ${'error' in json ? json.error : res.statusText}`);
      } else {
        const data = json[0] ?? null;
        if (!data) {
          setError('컨테이너를 찾을 수 없습니다.');
        } else {
          setResult(data);
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`호출 실패: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          FESCO Tracking — 검증 페이지
        </h1>
        <p className="text-gray-600 mb-6">
          추론 엔진이 MTL_Link 환경에서 동작하는지 확인하는 임시 페이지입니다.
        </p>

        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            컨테이너 번호 또는 B/L 번호
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={containerNumber}
              onChange={(e) => setContainerNumber(e.target.value)}
              placeholder="FESU5332167"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none font-mono text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
            />
            <button
              onClick={handleTrack}
              disabled={loading || !containerNumber.trim()}
              className="px-6 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {loading ? '조회 중...' : '조회'}
            </button>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            테스트:{' '}
            <button
              onClick={() => setContainerNumber('FESU5332167')}
              className="font-mono text-teal-600 hover:underline"
            >
              FESU5332167
            </button>{' '}
            (벨라루스) ·{' '}
            <button
              onClick={() => setContainerNumber('BMOU4891889')}
              className="font-mono text-teal-600 hover:underline"
            >
              BMOU4891889
            </button>{' '}
            (우즈베키스탄)
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="font-medium text-red-900">에러 발생</div>
            <div className="text-sm text-red-800 mt-1">{error}</div>
            <div className="text-xs text-red-700 mt-3">
              가장 흔한 원인: CORS 차단. 브라우저 콘솔(F12)에서 정확한 에러를 확인하세요.
              해결책으로 다음 단계에 Vercel Serverless Function을 추가할 예정입니다.
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className={`rounded-lg border p-5 ${SIGNAL_COLOR[result.signal]}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{SIGNAL_EMOJI[result.signal]}</span>
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider opacity-70">
                    {result.signal}
                  </div>
                  <div className="text-lg font-semibold">{result.message}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">식별 정보</h3>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-gray-500 text-xs uppercase tracking-wider">컨테이너</dt>
                  <dd className="font-mono font-medium text-gray-900">{result.containerNumber}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs uppercase tracking-wider">Region</dt>
                  <dd className="font-medium text-gray-900">{result.region}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs uppercase tracking-wider">경로</dt>
                  <dd className="text-gray-900">
                    {result.origin.name} → {result.destination.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs uppercase tracking-wider">B/L</dt>
                  <dd className="font-mono text-xs text-gray-700">
                    {result.billNumbers.join(', ')}
                  </dd>
                </div>
              </dl>
            </div>

            {result.ruleCheck.appliedRule && (
              <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-3">
                  룰 체크 — {result.ruleCheck.appliedRule.label}
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">통관 경과</span>
                    <span className="font-mono font-medium">
                      {result.ruleCheck.customsDaysElapsed ?? '-'}일 / 기준{' '}
                      {result.ruleCheck.customsLimit}일
                      <span className="ml-2 text-xs text-gray-500">
                        [{result.ruleCheck.customsStatus}]
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">발차 경과</span>
                    <span className="font-mono font-medium">
                      {result.ruleCheck.departureDaysElapsed ?? '-'}일 / 기준{' '}
                      {result.ruleCheck.departureLimit}일
                      <span className="ml-2 text-xs text-gray-500">
                        [{result.ruleCheck.departureStatus}]
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">종합</span>
                    <span className="font-medium">{result.ruleCheck.overallStatus}</span>
                  </div>
                  {result.ruleCheck.notes.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-500 mb-1">비고</div>
                      <ul className="text-sm text-gray-700 space-y-1">
                        {result.ruleCheck.notes.map((n, i) => (
                          <li key={i}>· {n}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {result.currentLocation && (
              <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-3">현재 위치</h3>
                <div className="space-y-1 text-sm">
                  <div className="font-medium text-gray-900">{result.currentLocation.name}</div>
                  <div className="text-gray-600">{result.currentLocation.operation}</div>
                  {result.currentLocation.transport && (
                    <div className="text-xs text-gray-500">
                      운송 수단: {result.currentLocation.transport}
                    </div>
                  )}
                  {result.currentLocation.remainingKm !== null && (
                    <div className="text-xs text-gray-500 font-mono">
                      남은 거리: {result.currentLocation.remainingKm} km / 총{' '}
                      {result.currentLocation.totalKm} km
                      {result.currentLocation.progressPercent !== null && (
                        <span className="ml-2">({result.currentLocation.progressPercent}%)</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">세그먼트</h3>
              <div className="space-y-2">
                {result.segments.map((s) => (
                  <div key={s.order} className="flex items-center gap-3 text-sm">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                      {s.type.toUpperCase()}
                    </span>
                    <span className="text-gray-900">
                      {s.from} → {s.to}
                    </span>
                    <span className="text-xs text-gray-500 ml-auto">{s.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <details className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <summary className="cursor-pointer font-semibold text-gray-900">
                원본 JSON 보기 (디버깅용)
              </summary>
              <pre className="mt-3 text-xs bg-gray-50 p-3 rounded overflow-auto max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}