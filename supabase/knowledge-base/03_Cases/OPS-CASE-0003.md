---
doc_type: case
case_id: OPS-CASE-0003
domain: operations
issue_type: BORDER_ISSUE
secondary_issue_type: DOC_MISSING
region: CIS
mode: sea-rail
cargo_type: general
risk_level: high
status: resolved
route: "Korea → Russia (TSR)"
last_updated: 2026-05-14
owner: operations_team
source: delay2.md
---

# Case OPS-CASE-0003 — SOC 컨테이너 CSC 플레이트 이슈로 발차 보류

## 1. Case Summary

MTL 보유 SOC 컨테이너 5대(ZESU prefix)가 FESCO에서 구매한 중고 컨테이너로, 이전 소유자로부터 CSC 플레이트가 갱신된 것에 대해 선사(FESCO/Julia)가 컨테이너 적법성을 문제 삼아 출발을 보류. 구매처(무원 코퍼레이션)로부터 증명서를 받아 이의 제기 후 해결.

## 2. Route

- KR → Russia (TSR)

## 3. Cargo Information

- 컨테이너: ZESU2077330, ZESU2087718, ZESU2095518, ZESU2099025, ZESU2113186 (5대)
- SOC 컨테이너 (MTL 보유)

## 4. Problem

FESCO측(Julia)이 해당 컨테이너들의 CSC 플레이트가 원본 FESCO 컨테이너 것이 아니라며 발차 보류.

## 5. Root Cause

### Confirmed Cause
- 컨테이너가 FESCO 구소유 컨테이너 → 무원 코퍼레이션이 합법적으로 매입 → CSC 플레이트 갱신
- FESCO 측에서 CSC 플레이트 변경 이력을 문제 삼음

### Possible Cause
- 중고 SOC 컨테이너 구매 시 CSC 이력 확인 절차 미흡

## 6. Missing Information / Documents

- 무원 코퍼레이션 발행 CSC 플레이트 갱신 증명서

## 7. Actions Taken

| Step | Action | Responsible | Result |
|---|---|---|---|
| 1 | 컨테이너 구매처(무원 코퍼레이션)에 증명서 요청 | MTL HQ | 증명서 수령 |
| 2 | FESCO Julia에 증명서 첨부하여 이의 제기 | MTL HQ | 발차 재개 요청 |

## 8. Customer Communication

컨테이너 CSC 플레이트 관련 서류 확인 과정으로 출발이 잠시 보류되었습니다. 현재 서류를 구비하여 즉시 출발 가능하도록 조치 중입니다.

## 9. Internal Decision

- SOC 컨테이너 구매 시 CSC 이력 사전 확인 절차 추가 필요
- 특히 FESCO 구소유 컨테이너는 플레이트 갱신 증명서 사전 확보

## 10. Final Result

증명서 제출 후 발차 재개 (정확한 지연 일수 미기록)

## 11. Lesson Learned

- SOC 컨테이너 구매 시 CSC 플레이트 이력 및 갱신 증명서 사전 확보
- 특히 FESCO 행 화물에 사용할 SOC는 FESCO 측과 컨테이너 적법성 사전 확인 필요

## 12. New SOP Rule

> SOC 컨테이너 신규 구매 시:
> 1) 이전 소유자(선사) 확인
> 2) CSC 플레이트 갱신 이력 및 증명서 확보
> 3) FESCO 행 사용 시 FESCO 측 사전 컨펌

## 13. Tags

`#soc_container` `#csc_plate` `#fesco` `#border_issue` `#tsr`
