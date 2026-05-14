---
doc_type: case
case_id: OPS-CASE-0002
domain: operations
issue_type: BORDER_ISSUE
secondary_issue_type: TRANSIT_DELAY
region: CIS
mode: sea-rail
cargo_type: general
risk_level: high
status: ongoing
route: "Korea → LYG/Qingdao → Khorgos → Altynkol → CIS"
last_updated: 2026-05-14
owner: operations_team
source: delay1.md, delay4.md, delay5.md, delay9.md
---

# Case OPS-CASE-0002 — China-CIS 철도 대규모 적체 (2026년 4-5월)

## 1. Case Summary

2026년 4-5월, China-CIS 철도 전 구간에 걸쳐 대규모 적체 발생. Khorgos/Altynkol 국경에 약 7,000대 컨테이너 대기, LYG에서 1~1.5개월 발차 불가 컨테이너 다수 발생. 개별 에이전트 문제가 아닌 시스템 전체 이슈.

## 2. Route

- POL: Incheon / Busan
- Transit 1: Lianyungang (LYG) 또는 Qingdao (TAO)
- Transit 2: Khorgos 국경
- Transit 3: Altynkol
- Final: Tashkent / Almaty / 기타 CIS

## 3. Cargo Information

- 다수 고객사 일반화물 (20GP, 40HQ 등)
- LCL 포함

## 4. Problem

**LYG 구간**
- 국경 혼잡으로 웨건 환적 및 발차 지연
- KIA/DKD/CKD 완성차 BT 프로젝트 화물 우선 배정
- CRCT가 혼잡 완화 위해 운송 계획 자체를 축소 운영
- 20GP 컨테이너용 웨건 부족 극심
- 일반화물 계획 신청 자체를 역측에서 제한
- 일부 컨테이너 1~1.5개월 대기 발생

**Khorgos/Altynkol 구간**
- 일일 7,000대 수준 컨테이너 재선적/환적 대기
- Altynkol 역 처리 용량: 일 15개 열차 수준 (수요 대비 절대 부족)
- 5월 8~13일 Kashgar/Kashgar North Station 도착 제한 및 임시 운영 조정 시행

**Kashgar 구간**
- 피크 시즌 화물량 급증으로 일일 컨테이너 수용량 한계 도달
- 5월 8~13일 발차 제한

## 5. Root Cause

### Confirmed Cause
- 중국-유럽·중앙아시아 열차 운행량 급격 증가 (일 27회 이상)
- Altynkol 역 재선적 용량 부족 (일 15개 열차)
- 중국 철도 당국의 트래픽 컨트롤: 임시 열차 계획 승인 축소, 프로젝트(완성차) 화물 우선 배정
- LYG 연운항역 20GP 웨건 부족

### Possible Cause
- 계절적 피크 시즌 (봄철 물량 집중)

## 6. Missing Information

- 각 컨테이너별 구간별 대기 일수 (Excel 트레이싱 데이터 필요)
- 적체 해소 예상 시점 (에이전트도 확정 불가)

## 7. Actions Taken

| Step | Action | Responsible | Result |
|---|---|---|---|
| 1 | 에이전트 (LB/WJ)에 발차 지속 푸쉬 | 운영팀 | 정확한 일정 확인 불가 상태 |
| 2 | MTL UZ에 적체 현황 상세 보고 | MCI 연태지점 | 상황 공유 완료 |
| 3 | 화주에게 현황 안내 | 운영팀 | 진행 중 |
| 4 | 대안 루트 검토 (트럭/Kashgar 경유) | 운영팀 | 검토 중 |
| 5 | Fast reload 비용($60/CNTR) 수용 여부 확인 | 운영팀 | 협의 중 |

## 8. Customer Communication

현재 화물은 중국-중앙아시아 철도 전 구간의 구조적 적체로 인해 발차가 지연되고 있습니다. 현재 Khorgos 국경 약 7,000대 대기 중이며, 중국 철도 당국의 운송 계획 축소 운영으로 인해 구체적인 출발 일정 확정이 어려운 상황입니다. 상황 변동 시 즉시 업데이트 드리겠습니다.

## 9. Internal Decision

- 이 케이스는 개별 에이전트나 MTL 과실이 아닌 구조적/시스템적 문제
- 화주에게 정직하게 현황 설명 필요 (ETA 단정 절대 금지)
- 대안 루트 (All Truck, Kashgar 경유 트럭) 비용 비교 후 화주에게 옵션 제시

## 10. Final Result

진행 중 (2026-05-14 기준)

## 11. Lesson Learned

1. 피크 시즌(봄) LYG 발 CIS 화물은 사전에 1~2개월 추가 리드타임 확보 필요
2. "프로젝트 화물"(완성차 BT) 우선 배정 구조 → 일반화물은 후순위
3. Altynkol 처리 용량 한계(일 15개 열차) 인지 → 화주 사전 안내 필수
4. 구조적 적체 시에는 화주에게 ETA 단정 대신 상황 설명 + 대안 제시

## 12. New SOP Rule

> 중국-CIS 피크 시즌 (3~6월) 부킹 시:
> 화주에게 "현재 Khorgos/Altynkol 국경 적체 상황으로
> 리드타임이 평시 대비 2~4주 추가 소요될 수 있음" 사전 안내 필수.
> ETA 확정 표현 금지.

## 13. Tags

`#khorgos` `#altynkol` `#lyg` `#congestion` `#wagon_shortage`
`#border_issue` `#tcr` `#2026_peak_season`
