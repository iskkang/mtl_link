---
doc_type: rule
domain: operations
issue_type: DOC_MISSING
region: EU
mode: sea-rail
risk_level: high
last_updated: 2026-05-14
owner: operations_team
source: 유럽철도lcl문의.md
---

# 유럽향 ENS ICS2 규정 (2024년 시행)

## 핵심

2024년부터 EU향 화물은 선적 24시간 전 ENS(ICS2) 사전신고 의무화.
미신고 또는 정보 불충분 시 선적 지연 또는 거부.

## 적용 범위

EU 회원국 + 노르웨이, 북아일랜드, 스위스

## 시행 일정

- Master-Filing: 2024년 9월 2일 시작
- House-Filing: 2024년 12월 4일 시작

## ENS ICS2 제출 필수 정보

- [ ] 구매자 및 판매자 완전한 정보 (전체 주소 포함)
- [ ] **HOUSE BL 수하인의 EORI 번호** (필수)
- [ ] **6자리 HS 코드**
- [ ] 정확하고 상세한 화물 설명
- [ ] 화학 물질의 경우 CUS 코드
- [ ] 결제 방법

## 서류 마감 전 체크

- [ ] 수하인 EORI 번호 수령 여부
- [ ] HS 코드 6자리 확인
- [ ] 화물 설명 구체성 확인
- [ ] 위험 물질 CUS 코드 확인

## 미충족 결과

- ENS 미승인 시 선적 지연 또는 거부

## 추가 유럽 LCL 규정

- **NO MARK 진행 불가**: 서류 제출 시 반드시 MARK 기재
- **1.5ton 초과 per Package**: 진행 가능 여부 별도 확인
- **2단 적재 불가 화물**: R/T × 1.5 적용
- **Coil 선적 불가**
- **Wood packaging/wood pallets**: 일부 파트너 불가

## MINT 판단 규칙

```
EU향 화물 처리 시:
EORI 번호 확인 여부 → Missing Information으로 표시
ENS ICS2 사전신고 완료 여부 → 체크 필수
```
