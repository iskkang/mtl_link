/**
 * 데모 스크립트
 *
 * 실행:
 *   npm run demo
 *
 * 이게 진짜 일하는 모습입니다.
 * 받으신 두 컨테이너 데이터로 추론 엔진이 어떻게 동작하는지 보여줍니다.
 */

import { transformFescoContainer } from './inference/transform.js';
import { formatDateKR } from './utils/date.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', 'tests', '__fixtures__');

const bmou = JSON.parse(readFileSync(join(fixturesDir, 'bmou4891889.json'), 'utf-8'));
const fesu = JSON.parse(readFileSync(join(fixturesDir, 'fesu5332167.json'), 'utf-8'));

const NOW = new Date('2026-05-15T10:00:00Z');

const signalEmoji = {
  green: '🟢',
  yellow: '🟡',
  red: '🔴',
  unknown: '⚪',
};

function printTracking(label: string, data: any) {
  const t = transformFescoContainer(data.data[0], NOW);

  console.log('\n' + '═'.repeat(72));
  console.log(`  ${label}`);
  console.log('═'.repeat(72));

  console.log(`\n${signalEmoji[t.signal]}  ${t.message}`);

  console.log('\n📦 식별 정보');
  console.log(`   컨테이너: ${t.containerNumber}`);
  console.log(`   B/L: ${t.billNumbers.join(', ')}`);
  console.log(`   경로: ${t.origin.name} → ${t.destination.name}`);
  console.log(`   region: ${t.region}`);

  console.log('\n📅 주요 시점');
  console.log(`   부산 출항:        ${formatDateKR(t.departureFromBusan.actual) ?? '예정 ' + formatDateKR(t.departureFromBusan.planned)}`);
  console.log(`   블라디 도착:      ${formatDateKR(t.arrivalAtVladivostok.actual) ?? '예정 ' + formatDateKR(t.arrivalAtVladivostok.planned)}`);
  console.log(`   블라디 발차:      ${formatDateKR(t.departureFromVladivostok.actual) ?? '예정 ' + formatDateKR(t.departureFromVladivostok.planned)}`);
  console.log(`   최종 도착(예정):  ${formatDateKR(t.arrivalAtDestination.planned) ?? '미정'}`);

  console.log('\n🚦 룰 체크');
  if (t.ruleCheck.appliedRule) {
    console.log(`   적용 룰: ${t.ruleCheck.appliedRule.label}`);
    console.log(`   통관: ${t.ruleCheck.customsDaysElapsed ?? '-'}일 / 기준 ${t.ruleCheck.customsLimit}일 [${t.ruleCheck.customsStatus}]`);
    console.log(`   발차: ${t.ruleCheck.departureDaysElapsed ?? '-'}일 / 기준 ${t.ruleCheck.departureLimit}일 [${t.ruleCheck.departureStatus}]`);
    console.log(`   종합: ${t.ruleCheck.overallStatus}`);
    if (t.ruleCheck.notes.length > 0) {
      console.log(`   비고:`);
      t.ruleCheck.notes.forEach((n) => console.log(`     · ${n}`));
    }
  } else {
    console.log(`   룰 미적용 (region 식별 불가)`);
  }

  console.log('\n📍 현재 위치');
  if (t.currentLocation) {
    console.log(`   ${t.currentLocation.name} (${formatDateKR(t.currentLocation.date)})`);
    console.log(`   ${t.currentLocation.operation}`);
    if (t.currentLocation.transport) {
      console.log(`   운송 수단: ${t.currentLocation.transport}`);
    }
    if (t.currentLocation.remainingKm !== null) {
      console.log(`   남은 거리: ${t.currentLocation.remainingKm} km / 총 ${t.currentLocation.totalKm} km`);
      if (t.currentLocation.progressPercent !== null) {
        console.log(`   진행률: ${t.currentLocation.progressPercent}%`);
      }
    }
  } else {
    console.log(`   (이벤트 데이터 없음 — 추정 위치)`);
  }

  console.log('\n🚢 세그먼트');
  t.segments.forEach((s) => {
    const statusIcon = s.status === 'completed' ? '✓' : s.status === 'in_progress' ? '◐' : '○';
    const mode = { sea: '🚢', rail: '🚂', truck: '🚚' }[s.type];
    console.log(`   ${statusIcon} ${mode} ${s.from} → ${s.to} [${s.status}]`);
    if (s.transport) {
      console.log(`     └ ${s.transport.name}${s.transport.voyage ? ` (${s.transport.voyage})` : ''}`);
    }
  });

  if (t.events.length > 0) {
    console.log('\n📜 최근 이벤트 (3건)');
    t.events.slice(0, 3).forEach((e) => {
      console.log(`   ${formatDateKR(e.date)} · ${e.location}`);
      console.log(`     └ ${e.operation}`);
    });
  }
}

console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
console.log('│  MTL Link FESCO 트래킹 추론 엔진 — 데모                              │');
console.log('│  기준 시각: 2026-05-15 (가상)                                        │');
console.log('└─────────────────────────────────────────────────────────────────────┘');

printTracking('BMOU4891889 — 부산 → 추쿠르사이 (우즈베키스탄)', bmou);
printTracking('FESU5332167 — 부산 → 콜랴디치 (벨라루스)', fesu);

console.log('\n' + '═'.repeat(72));
console.log('  데모 완료. 더 자세한 출력은 transformFescoContainer() 결과를 직접 확인');
console.log('═'.repeat(72) + '\n');
