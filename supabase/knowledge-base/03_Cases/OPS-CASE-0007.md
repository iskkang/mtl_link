---
doc_type: case
case_id: OPS-CASE-0007
domain: operations
issue_type: DOC_MISMATCH
secondary_issue_type: CUSTOMER_CLAIM
region: CIS
mode: sea
cargo_type: general
risk_level: critical
status: resolved
route: "China/Vietnam → Russia"
last_updated: 2026-05-14
owner: operations_team
source: delay8.md (민감정보 마스킹)
note: 화주사명, 딜러명, 금액 등 기밀정보 마스킹
---

# Case OPS-CASE-0007 — 중국발 선적 서류 러시아 딜러 유출 사고

## 1. Case Summary

특정 화주(ANP)의 중국발 선적 서류(인보이스 금액 포함)가 중국 법인에서 러시아 법인으로 직접 전달되어 러시아 딜러에게 공개됨. 인보이스 금액이 노출되어 심각한 비즈니스 사고 발생. 향후 3국발 진행 건 서류는 반드시 한국 본사를 통해서만 전달하도록 절차 변경.

## 2. Problem

- 중국 법인 → 러시아 법인으로 직접 서류 전달
- 러시아 법인 → 수입자(딜러)에게 인보이스 금액 포함 서류 전달
- 딜러가 원가 정보 취득 → 심각한 비즈니스 손실

## 3. Root Cause

### Confirmed Cause
- 3국발 서류 전달 경로에 한국 본사 검토 단계 없음
- 중국 법인이 러시아 법인에 직접 서류 전달하는 관행

### Possible Cause
- 서류 전달 전 금액 정보 포함 여부 확인 절차 미비

## 4. Actions Taken

| Step | Action | Responsible | Result |
|---|---|---|---|
| 1 | 긴급 공지: 3국발 서류 한국 본사 경유 원칙 수립 | MCI 본사 (박준 상무) | 즉시 시행 |
| 2 | 중국 법인 → 러시아 법인 직접 서류 전달 중단 | 중국 법인 | 완료 |
| 3 | 러시아 법인에 서류 전달 전 금액 항목 더블체크 지시 | 러시아 법인 | 완료 |
| 4 | 2월부터 중국발 서류 본사 직접 전달로 전환 | MTL HQ | 완료 |

## 5. Final Result

서류 전달 경로 변경 완료. 이후 동일 사고 재발 방지.

## 6. Lesson Learned

1. **3국발 서류 경로**: 반드시 한국 본사 검토 후 전달
2. **금액 포함 서류** (Invoice, CIPL) → 수입자 전달 전 노출 항목 확인
3. **법인 간 직접 서류 공유** → 본사 사전 승인 필요
4. **서류 전달 원칙**: "수신인이 봐야 할 정보만" 원칙 준수

## 7. New SOP Rule

> 3국발 (중국발/베트남발 등) 서류 전달 규칙:
> - 중국/베트남 법인 → 러시아 법인 직접 서류 전달 금지
> - 반드시 한국 본사 경유 → 검토 후 전달
> - 인보이스 금액 포함 서류는 수신자 확인 후 전달
> - 수입자(딜러)에게 전달 전: 금액 노출 항목 반드시 확인

## 8. Tags

`#document_leak` `#invoice_exposure` `#confidentiality`
`#3rd_country` `#china_russia` `#doc_mismatch` `#critical`
