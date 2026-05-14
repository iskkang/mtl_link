---
doc_type: case
case_id: OPS-CASE-0005
domain: operations
issue_type: DOC_MISSING
secondary_issue_type: BORDER_ISSUE
region: CIS
mode: truck
cargo_type: general
risk_level: critical
status: resolved
route: "China → Kyrgyzstan (Torugart/Irkeshtam) → Uzbekistan (Tashkent)"
last_updated: 2026-05-14
owner: operations_team
source: delay6.md
---

# Case OPS-CASE-0005 — 키르기스스탄 T/S 서류 누락 → 밀수 취급 + 벌금 발생

## 1. Case Summary

중앙아시아 트럭 LCL 운송 건에서 국경 TS(환적) 브로커가 T/S 서류 없이 통관 신고를 진행. 화물이 밀수 화물로 취급받아 키르기스스탄 세관에 약 1개월간 억류되었으며, 중앙세관으로 사건이 이관. 브로커 책임 회피로 상황 악화, 총 예상 비용 약 $8,000 발생.

## 2. Route

- China 국경 → Kyrgyzstan (Torugart 세관) → Uzbekistan (Tashkent)

## 3. Cargo Information

- 화물: LCL (3건 컨테이너 TGHU6886531 등)
- 화주: SENSTEX CO.LTD (타슈켄트향)

## 4. Problem

- 2월 7일 선적, 2월 22일 트럭 출발
- 2월 27일 중국 국경 도착
- 3월 8일 국경 세관 도착 → T/S 서류 없음 발견
- 국경 브로커: T/S 서류 없이 신고 진행 사실 확인
- 화물이 밀수 취급 → 키르기스스탄 세관 억류
- 3월 31일 국경 세관 → 중앙 세관으로 이관
- 4월 13~17일 벌금 확정 협의

## 5. Root Cause

### Confirmed Cause
- 국경 TS 브로커가 T/S 서류 미확인 상태로 신고 진행 (서류 누락 신고)
- 해당 브로커의 반복적 실수 이력 있음 (이번이 첫 케이스 아님)

### Possible Cause
- TS 신고 완료 여부 확인 프로세스 부재
- 브로커 선정 시 과거 이슈 이력 미반영

## 6. Missing Information / Documents

- T/S 서류 (Transit Shipment 신고서)
- 영문 면장 (SHIPPER 측에 요청하여 사후 제공)
- 상공회의소 시장가 확인서 (2차례 제출)

## 7. Actions Taken

| Step | Action | Responsible | Result |
|---|---|---|---|
| 1 | SHIPPER 측에 영문 면장 요청 및 수령 | MTL HQ | 완료 |
| 2 | 세관 요청 서류 준비 및 제공 | MTL HQ | 완료 |
| 3 | 중앙세관 브로커 정기 방문 (3일에 한번) | MTL 브로커 | 진행 |
| 4 | 벌금 납부 방식 협의 | MTL HQ | 협의 완료 |
| 5 | TS 신고 2회 진행으로 최종 해결 | MTL HQ | 완료 |
| 6 | 브로커 손해배상 청구 검토 | MTL HQ | 진행 |
| 7 | 향후 TS 통관 완료 후 서류/사진 즉시 공유 절차 구축 | MCI 연태지점 | 완료 |

**최종 발생 비용 (예상)**
- 벌금: 약 $4,000 (수입/수출 각각)
- 보세 창고료: 약 $2,000
- TS 및 보세트럭비용: 약 $2,000
- **총 약 $8,000**

## 8. Customer Communication

화물이 키르기스스탄 세관 처리 과정에서 예상치 못한 서류 문제가 발생하여 지연이 발생하였습니다. 현재 관련 서류를 모두 제출하여 조속한 해결을 위해 최선을 다하고 있습니다. 정확한 출발 일정은 세관 처리 완료 후 즉시 안내드리겠습니다.

## 9. Internal Decision

- 브로커 교체: 타슈켄트 LCL 이슈 이후 위해시노로 브로커 변경
- 향후 TS 신고 완료 후 서류/사진 공유 절차 의무화
- 브로커 손해배상 청구 진행

## 10. Final Result

TS 신고 2회 진행 후 최종 해결. 총 약 $8,000 비용 발생. 브로커 변경 완료.

## 11. Lesson Learned

1. **국경 TS 브로커 관리**: 반복 이슈 브로커는 즉시 교체
2. **TS 완료 확인**: 신고 완료 후 서류/사진 수령 의무화
3. **문제 발생 즉시 공유**: 파트너가 문제를 숨기거나 지연 보고 시 비용 급증
4. **T/S 서류 체크**: 중앙아시아 트럭 LCL 진행 시 출발 전 TS 서류 확인 필수
5. **비용 합의는 서면으로**: 구두 합의 후 추가 비용 발생 시 분쟁 원인

## 12. New SOP Rule

> 중앙아시아 트럭 LCL (키르기스스탄 경유) 진행 시:
> 1) TS 신고 완료 후 브로커로부터 서류 및 사진 수령 의무화
> 2) 트럭 기사가 직접 촬영한 TS 완료 사진 본사 공유
> 3) 24h 내 TS 완료 미확인 시 즉시 에스컬레이션
> 4) 반복 이슈 브로커는 교체 검토

## 13. Tags

`#kyrgyzstan` `#torugart` `#ts_document` `#doc_missing`
`#customs_penalty` `#broker_failure` `#lcl_truck` `#critical`
