---
doc_type: case
case_id: OPS-CASE-0001
domain: operations
issue_type: BORDER_ISSUE
secondary_issue_type: DOC_MISSING
region: CIS
mode: sea-rail
cargo_type: auto_parts
risk_level: high
status: resolved
route: "Korea-China(Lianyungang)-Kazakhstan(Almaty)"
last_updated: 2026-05-14
owner: operations_team
---

# Case OPS-CASE-0001 — Kazakhstan 국경 Transit Permit 만료 지연

## 1. Case Summary

자동차 부품 화물이 한국에서 중국 Lianyungang을 거쳐 Kazakhstan Almaty로 운송 중, Khorgos 국경에서 4일간 보류되었다. 사유는 transit permit 만료 직전에 발생한 행정 처리 지연이었으며, 추가 서류 보완으로 release되었다.

## 2. Route

- **POL**: Busan, Korea
- **Transit 1**: Lianyungang, China (해상→철도 환적)
- **Transit 2**: Khorgos, China-Kazakhstan 국경
- **POD**: Almaty, Kazakhstan
- **Final Destination**: Almaty (화주 창고)

## 3. Cargo Information

- **Cargo**: Auto parts (engine components)
- **Packages**: 240 cartons on 6 pallets
- **Weight**: 4,200 kg (Gross), 3,800 kg (Net)
- **CBM**: 12.5
- **Container Type**: 40HC × 1
- **Special Condition**: None

## 4. Problem

화물이 Khorgos 국경에서 4일간 보류됨. 도착지 에이전트로부터 "transit permit 처리 지연" 통보 수신. 화주가 ETA 문의 시작 (3일차).

## 5. Root Cause

### Confirmed Cause
- Transit permit이 만료일 기준 2일 전 도착하여 갱신 처리 필요
- 갱신을 위한 보충 서류(POA notarized version) 누락

### Possible Cause
- 사전 transit permit 유효기간 확인 누락 (당사 측 SOP gap)
- 도착지 에이전트가 만료 임박을 사전 통지하지 않음

## 6. Missing Information / Documents

확인 과정에서 발견된 누락:
- POA 공증본 (notarized) — 화주로부터 즉시 수령 필요
- Updated transit permit 신청 양식
- 추가 보관료 견적 (Kazakhstan 측)

## 7. Actions Taken

| Step | Action | Responsible Party | Result |
|---|---|---|---|
| 1 | 보류 사유 확인 요청 | 운영팀 → 도착지 에이전트 | 2시간 내 회신 수령 |
| 2 | 화주에게 1차 통보 (보류 사실 + 확인 중) | 운영팀 → 화주 | 화주 동의, 4시간 후 업데이트 요청 |
| 3 | POA 공증본 요청 | 운영팀 → 화주 | 당일 내 수령 |
| 4 | 공증본 + permit 갱신 신청 | 운영팀 → 관세사/에이전트 | 다음날 처리 |
| 5 | Release 확인 + 화주 최종 통보 | 운영팀 → 화주 | 4일차 release |
| 6 | 보관료 정산 | 운영팀 → 화주 (사전 고지 후) | 합의 |

## 8. Customer Communication

**1차 통보 (보류 1일차)**:
> 안녕하세요. 화물의 Khorgos 국경 통과 관련하여 transit permit 갱신 처리가 필요한 상황입니다. 현재 도착지 에이전트 및 관세사 측에 정확한 처리 일정 및 필요 조치를 확인 중입니다. 4시간 내 1차 회신 드리겠습니다.

**2차 통보 (보류 2일차, POA 요청)**:
> Transit permit 갱신을 위해 POA 공증본이 필요합니다. 회사 측 보유하신 공증본 송부 가능하신지 확인 부탁드립니다. 송부 후 즉시 갱신 신청 진행하겠습니다.

**최종 통보 (Release 후)**:
> 화물이 정상 release되어 Almaty 방향으로 운송 재개되었음을 안내드립니다. 예상 도착일은 X월 X일이며, 보류 기간 발생한 보관료 USD XXX는 별도 정산 안내드리겠습니다.

## 9. Internal Decision

- 도착지 에이전트가 transit permit 만료를 사전 통지하지 않은 부분 → 협력 관계 점검 필요
- 당사 SOP에 "출발 전 transit permit 유효기간 확인" 단계 추가 필요
- POA 공증본은 향후 CIS 운송 시 출발 전 확보를 표준화

## 10. Final Result

- 4일 지연 후 release 성공
- 화주 클레임 없음 (사전 투명 communication 효과)
- 보관료 USD 480 발생 → 화주와 합의 처리
- 협력 에이전트 사전 통지 의무 재합의

## 11. Lesson Learned

1. **Transit permit 유효기간**은 출발 전 의무 확인 항목으로 추가
2. **POA 공증본**은 CIS 운송 시 출발 전 사전 확보 (수령 후 출발)
3. **에이전트 사전 통지 의무**를 계약서/SLA에 명시 필요
4. 화주 1차 통보 시 "확인 중"이라는 솔직한 표현이 신뢰 유지에 효과적

## 12. New SOP Rule

다음 규칙을 `01_SOPs/customs_issue_sop.md` 및 신규 작성 예정 `cis_shipment_prep_sop.md`에 반영:

> **CIS 운송 출발 전 필수 확인 항목**:
> 1. Transit permit 유효기간 (선적일 기준 잔여 14일 이상 권장)
> 2. POA 공증본 확보 여부
> 3. 도착지 에이전트의 사전 통지 의무 확인

## 13. Tags

`#kazakhstan` `#khorgos` `#transit_permit` `#auto_parts` `#sea_rail` `#cis`
