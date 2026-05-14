---
doc_type: case
case_id: OPS-CASE-0006
domain: operations
issue_type: DOC_MISMATCH
secondary_issue_type: CUSTOMER_CLAIM
region: global
mode: sea
cargo_type: general
risk_level: high
status: resolved
route: "Korea → 유럽/중앙아시아 다수 노선"
last_updated: 2026-05-14
owner: operations_team
source: delay7.md (민감정보 마스킹)
note: 고객사별 매출/이익 등 재무정보는 본 케이스에서 제외
---

# Case OPS-CASE-0006 — BL 다중 오류 + 담당자 변경으로 다수 고객사 클레임 및 이탈

## 1. Case Summary

2026년 초~2분기, Switch BL 발행 시 서류 미검토로 인한 다중 오류(중량 오기재, POD 오류, Shipping Mark 오류, Description 오류 등)가 반복 발생. OBL 미발행, 청구 누락, MRN 오류 등으로 다수 고객사 클레임 발생 및 일부 고객사 이탈.

## 2. Problem

**Switch BL 오류 반복 (고객사 A)**
- GROSS WEIGHT 오류 기재
- Switch BL 발행 시 Original CIPL vs Switch CIPL 미검토
- 화물 도착 3일 전 화주가 발견 → CIPL 수정 역요청 발생

**동일 고객사 후속 건**
- POD 오류 기재
- Shipping Mark 오류 기재
- Description 오류 기재
- Surrender 출력 누락
- L/T 30일 오안내 (실제 12~18일 구간에서)

**고객사 B (OBL 건)**
- L/C 오픈 건 → OBL 필수 발행 대상
- 담당자 교체 반복으로 업무 미숙지
- OBL 재발행 다수 발생 → 화주 담당자가 반복적으로 은행에 양해 요청

**고객사 C (항공 MRN 오류)**
- 항공사 MRN 오류로 FRA 도착 후 공항 대기 20일 발생
- 화주 3월 매출 손실 발생 → 고객사 이탈

**고객사 D (청구 누락)**
- 담당자 퇴사 + 인수인계 누락 → 청구 누락 발생

## 3. Root Cause

### Confirmed Cause
- Switch BL 발행 시 Original/Switch CIPL 미교차 검토
- OBL 필수 건 담당자 미숙지 (L/C 이해도 부족)
- 담당자 잦은 교체 (일부 고객사 1년 내 3회 변경)
- 인수인계 절차 미흡으로 정보 단절

### Possible Cause
- 1인당 업무량 과중 → 검토 누락
- 운영인력 부족

## 4. Actions Taken

| Step | Action | Responsible | Result |
|---|---|---|---|
| 1 | 오류 발견 즉시 수정 CIPL/BL 발행 | 운영팀 | 건별 수정 처리 |
| 2 | 내부 책임 의식 강화 지시 | 경영진 | 주지 완료 |
| 3 | BL 오류 점검 프로세스 추가 논의 | 운영팀 | 검토 중 |

## 5. Final Result

- 고객사 A: 포워더 변경 (이탈)
- 고객사 B: 계속 진행 (관계 유지)
- 고객사 C: 이탈
- 고객사 D: 계속 진행 (이월 처리 후 양해)

## 6. Lesson Learned

1. **Switch BL 발행 시** Original CIPL과 Switch CIPL을 반드시 비교 검토
2. **L/C 건 OBL 발행** → 팀장 검토 후 발행 (담당자 단독 진행 금지)
3. **담당자 변경 시** 인수인계 체크리스트 반드시 완료 후 전환
4. **MRN 입력 오류**는 항공 도착 전 반드시 Plism 오류 여부 확인
5. **고객사 이탈**은 1~2회 오류 반복이 트리거 → 첫 오류 발생 시 즉시 내부 보고 및 재발 방지 조치

## 7. New SOP Rule

> Switch BL 발행 체크리스트:
> [ ] Original CIPL vs Switch CIPL: GROSS WEIGHT 일치 여부
> [ ] POD 기재 일치 여부
> [ ] Shipping Mark 일치 여부
> [ ] Description 일치 여부
> [ ] Surrender 처리 여부 확인
>
> L/C 건 OBL 발행:
> [ ] 팀장 검토 후 발행 (담당자 단독 불가)

## 8. Tags

`#switch_bl` `#obl` `#bl_error` `#doc_mismatch` `#customer_claim`
`#handover_failure` `#mrn_error` `#customer_churn`
