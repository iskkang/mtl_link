---
doc_type: sop
domain: operations
issue_type: CUSTOMS_DELAY
region: global
mode: multimodal
risk_level: high
last_updated: 2026-05-14
owner: operations_team
---

# Customs Issue SOP

## 적용 범위

CUSTOMS_DELAY, BORDER_ISSUE Issue Type에 적용.
세관 보류·검사 지정·서류 보완 요청·통과 허가 이슈 발생 시 표준 절차.

## 트리거

다음 중 하나 발생 시 본 SOP 적용:
- 세관으로부터 추가 서류 요청 수신
- 세관 검사 지정 통지
- 통과 허가(transit permit) 이슈 발생
- 도착지 에이전트로부터 통관 보류 통보
- 화주가 통관 진행 상황 문의

## 표준 절차

### Step 1: 즉시 확인 (15분 내)

- [ ] 보류 사유 정확히 파악 (서류/검사/허가/HS코드 분쟁)
- [ ] 보류 시작 시점 및 예상 release 시점
- [ ] 영향받는 BL/Container 번호
- [ ] 화주 현재 인지 여부

### Step 2: Risk Level 판단 (15분 내)

→ `risk_level_matrix.md`의 통관 섹션 참조

- 단순 서류 보완: Medium
- 검사 지정: High
- 페널티 가능성: Critical

### Step 3: 정보 수집 (1시간 내)

| From | What |
|---|---|
| 도착지 에이전트 | 정지 사유 서면, 예상 release 시점, 필요 서류 리스트 |
| 관세사 | 통관 상태, HS 코드 검증, 필요 조치 |
| 운송사 | 보관 위치, 보관료 시작 여부 |
| 화주 | 누락 서류 보유 여부 (필요 시) |

### Step 4: 화주 1차 통보 (1시간 내)

- [ ] 보류 사실 + 사유 (확인된 범위 내)
- [ ] 현재 대응 중임 통보
- [ ] 다음 업데이트 시점 약속 (4시간 후 권장)
- [ ] 약속 위반 금지 — 정보 부족이어도 약속한 시점에 "아직 확인 중" 업데이트

→ 메시지 템플릿: `04_Templates/customs_hold_notice.md`

### Step 5: 추가 서류 처리 (필요 시)

서류 보완 요청인 경우:
- [ ] 화주에게 필요 서류 정확히 안내
- [ ] 수령 후 즉시 도착지 에이전트 전달
- [ ] 통관 재진행 확인

→ 체크리스트: `02_Checklists/cis_customs_checklist.md` (CIS 지역)

### Step 6: 비용 영향 평가

- [ ] 보관료 시작 시점 확인
- [ ] 페널티 가능성 확인
- [ ] 추가 비용 발생 시 화주 사전 고지 (사후 청구 금지)

→ 규칙: `05_Rules/cost_confirmation_rule.md`

### Step 7: 에스컬레이션 (해당 시)

- High → 팀장 통보 (4시간 내)
- Critical → CEO 즉시 통보 (즉시)

→ 매트릭스: `00_Core/risk_level_matrix.md`

### Step 8: 종료 및 기록

- [ ] Release 확인
- [ ] 최종 화주 통보
- [ ] 케이스 로그 작성 (`03_Cases/`)
- [ ] SOP 개선 사항 있으면 본 문서 업데이트 제안

## 금지 사항

- ❌ 화주에게 release 시점 단정 약속 ("내일 풀립니다")
- ❌ 사유 확인 전 추측성 안내
- ❌ 추가 비용 발생 후 사후 청구
- ❌ 에스컬레이션 누락
- ❌ 4시간 이상 화주 무업데이트

## 지역별 특이사항

### China
- 통관 검사율 상대적으로 높음
- HS 코드 분쟁 빈번
- 통관 수수료 별도 발생 가능

### CIS (Russia/Kazakhstan/Uzbekistan)
- 서류 공증 요구 빈번 (POA, COO 등)
- Transit permit 만료 주의
- 국경 corridor 정체 계절성 (겨울 증가)

### EU (Poland 등)
- EORI 번호 필수
- VAT 처리 사전 확인

## 관련 문서

- `00_Core/risk_level_matrix.md`
- `02_Checklists/cis_customs_checklist.md`
- `04_Templates/customs_hold_notice.md`
- `04_Templates/customer_delay_notice.md`
- `05_Rules/customs_risk_rule.md`
