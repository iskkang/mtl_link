---
doc_type: case
case_id: OPS-CASE-0010
domain: operations
issue_type: DOC_MISSING
region: CIS
mode: sea-rail
cargo_type: general
risk_level: high
status: ongoing
route: "Korea → Almaty (LCL)"
last_updated: 2026-05-14
owner: operations_team
source: poa요청.md
---

# Case OPS-CASE-0010 — POA 미수령으로 국경 발차 보류 (2026)

## 1. Case Summary

LCL 화물(BL 26MRS0710, 일양·모트렉스)이 국경 통과 단계에서 Consignee POA 미수령으로 발차 보류. 현지 지점이 30일 전부터 수하인에게 POA를 요청했으나 미수령 상태. 화주(일양)에게 수하인 독촉 요청.

## 2. Route

- Korea → (TCR) → Almaty, Kazakhstan (LCL)
- BL No.: 26MRS0710

## 3. Problem

- 현지 파트너가 2026.04.30부터 수하인에게 POA 요청
- 2026.05 초 기준 여전히 미수령
- KME POA 없어 국경 발차 불가

## 4. Root Cause

### Confirmed Cause
- 수하인 측 POA 제출 지연

### Possible Cause
- 출발 전 POA 수령 여부 미확인 (사전 체크 미흡)

## 5. Actions Taken

| Step | Action | Responsible | Result |
|---|---|---|---|
| 1 | 현지 파트너가 수하인에게 POA 요청 (4.30~) | MTL 현지 | 미수령 |
| 2 | 화주(일양)에게 수하인 독촉 요청 | MTL HQ (간디) | 진행 중 |

## 6. Customer Communication

현재 수하인 POA 미수령으로 국경 발차가 보류 중입니다. 귀사에서 수하인에게 POA 제출을 독촉해 주시면 감사하겠습니다. 수령 즉시 발차 진행하겠습니다.

## 7. Lesson Learned

- CIS 행 LCL도 FCL과 동일하게 출발 전 POA 수령 확인 필수
- 수하인의 POA 발급이 지연될 수 있으므로 **부킹 시점에 요청** 시작

## 8. New SOP Rule

> CIS 행 LCL 진행 시:
> 부킹 확정 후 즉시 수하인에게 POA 요청.
> 출발 1주일 전 POA 미수령 시 화주에게 수하인 독촉 요청.

## 9. Tags

`#poa` `#lcl` `#almaty` `#doc_missing` `#border_hold` `#2026`
