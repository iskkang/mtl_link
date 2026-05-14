---
doc_type: case
case_id: OPS-CASE-0009
domain: operations
issue_type: CARGO_DAMAGE
secondary_issue_type: BORDER_ISSUE
region: CIS
mode: sea-rail
cargo_type: used_car
risk_level: critical
status: resolved
route: "Korea → China → Altynkol → Tashkent"
last_updated: 2026-05-14
owner: operations_team
source: calim처리.md
---

# Case OPS-CASE-0009 — Kazakhstan 국경 검사 + 비신고 물품 발견 + 차량 데미지 클레임 (2024)

## 1. Case Summary

중고차 3대 운송 중 Altynkol 국경에서 랜덤 인스펙션 지정. MTL 대리인 참관 없이 검사 진행. 서류 상 3대 중고차 외 비신고 물품(매트리스 30장, Bumper, Hood 등) 발견. 인스펙션 비용 $2,150 발생. 화물 도착 후 수하인이 차량 데미지 및 부품 도난 클레임 $4,000 제기.

## 2. Route

- ATD INC: 2023.12.08
- ATA Altynkol: 2023.12.25
- ATD Altynkol: 2024.02.12 (국경 약 49일 대기)
- ATA Tashkent: 2024.02.14
- Container: GVCU5283533

## 3. Cargo Information

- 화물: 중고차 3대 (Tesla 포함)
- 비신고 추가 물품: 매트리스 30장, Bumper, Hood 등 (서류 미기재)

## 4. Problem

- Altynkol 랜덤 인스펙션 지정
- MTL 대리인 참관 없이 세관 검사 진행
- 비신고 물품 발견
- 인스펙션 관련 비용 발생 후 컨테이너 억류
- 중국 Agent의 국경 포워더(KEDENTRANSSERVICE)와 SVH 간 DEBT 문제로 2월까지 해결 지연
- 도착 후 차량 데미지 및 부품 도난 클레임 $4,000 제기

## 5. Root Cause

### Confirmed Cause
- 서류 상 화물(중고차 3대) 외 비신고 물품 다수 적재 (화주 측 문제)
- 국경 포워더의 SVH 미납으로 Release 지연

### Possible Cause
- 인스펙션 중 MTL 대리인 부재로 화물 관리 공백
- 데미지/도난이 인스펙션 과정에서 발생했을 가능성

## 6. Missing Information / Documents

- SEAL 번호 확인 여부 (수령 불가)
- 인스펙션 참관 Act (공식 서류)
- 도난 물품 리스트 (수하인이 약속 후 미제출)
- 검사 전후 차량 상태 사진

## 7. Actions Taken

| Step | Action | Responsible | Result |
|---|---|---|---|
| 1 | Tashkent 도착 시 SEAL 번호 확인 요청 | MTL HQ | 답변 미수령 |
| 2 | 수하인에게 POA 수령 후 인스펙션 비용 지불 | MTL KAZ | $2,150 지불 후 Release |
| 3 | 도난 물품 리스트 요청 | 수하인 | 미수령 |
| 4 | Inspection 비용 $1,200 중 CNEE 부담 협의 시도 | MTL UZ | 진행 중 연락 끊김 |
| 5 | 데미지 클레임 $4,000 협의 (원래 $6,000에서 네고) | 운영팀 | 협의 진행 |

**인스펙션 발생 비용:**
- SVH, 미신고 물품, 보관료: $900
- 신속 적재비: $50
- 벌금 없이 세관 처리(현금): $1,200
- **합계: $2,150**

## 8. Customer Communication

국경 검사 과정에서 예상치 못한 이슈가 발생하여 지연이 발생하였습니다. 현재 최대한 빠른 해결을 위해 조치 중입니다.

## 9. Internal Decision

- 비신고 물품은 화주 측 귀책
- 인스펙션 중 MTL 대리인 부재로 데미지 증빙 확보 실패
- 향후 인스펙션 시 반드시 MTL 대리인 참관 또는 현지 파트너 즉시 파견

## 10. Final Result

$2,150 인스펙션 비용 MTL KAZ 처리. 데미지 클레임 $4,000은 협의 중 (명확한 귀책 미확정).

## 11. Lesson Learned

1. **중고차 운송 시 서류 검증**: 서류 상 화물 외 추가 물품 적재 금지 — 화주에게 서면 고지
2. **인스펙션 지정 시**: MTL 대리인 참관 즉시 요청 (거부 시 공식 항의)
3. **SEAL 번호 관리**: 발차 시 SEAL 번호 기록 → 도착 시 대조 필수
4. **KEDENTRANSSERVICE 포워더**: SVH 간 DEBT 이슈 있음 → 사전 확인 필요
5. **비신고 물품 리스크**: 세관에서 발견 시 비용/지연/클레임 모두 발생

## 12. New SOP Rule

> 중고차 컨테이너 운송 시:
> 1) 서류에 기재된 화물 외 추가 물품 적재 금지 — 화주 서면 동의 필수
> 2) 발차 전 SEAL 번호 기록 및 도착 시 확인
> 3) 국경 인스펙션 지정 시 MTL 현지 대리인 즉시 파견 요청

## 13. Tags

`#altynkol` `#inspection` `#undeclared_goods` `#used_car`
`#cargo_damage` `#theft` `#kazakhstan` `#critical`
