---
doc_type: case
case_id: OPS-CASE-0008
domain: operations
issue_type: TRANSIT_DELAY
secondary_issue_type: CUSTOMER_CLAIM
region: CIS
mode: sea-rail
cargo_type: general
risk_level: high
status: resolved
route: "Korea → Vladivostok → Europe (TSR)"
last_updated: 2026-05-14
owner: operations_team
source: calim처리2.md
---

# Case OPS-CASE-0008 — VVO 2개월 대기로 계절상품 클레임 발생 (2021)

## 1. Case Summary

2021년 TSR 화물이 Vladivostok(VVO)에서 2개월간 발차하지 못하고, 러시아·Brest 국경 적체로 추가 지연. 계절 상품이었던 화물이 시즌을 놓쳐 바이어로부터 $25,000 클레임 발생. 최종 $10,000으로 협의 정리, 향후 운임 네고로 관계 유지.

## 2. Route

- POL: Korea (Busan)
- Transit: Vladivostok → Brest
- POD: Malaszewicze (Poland/Europe)

## 3. Cargo Information

- 화물: 계절 상품
- BL No.: 21MR0930, 21MR1031, 21MR1157 (3건)

## 4. Problem

- VVO에서 약 2개월간 발차 지연 (러시아 국경 적체)
- Brest 구간에서도 추가 적체
- 화물: 계절 상품 → 시즌 종료로 판매 불가
- 바이어 측 $25,000 클레임 제기
- 수출자가 세진해운(파트너)에 클레임 전달

## 5. Root Cause

### Confirmed Cause
- 러시아 VVO 항구 전산 시스템 교체와 겹쳐 적체 극심
- Brest 국경 적체 동시 발생

### Possible Cause
- 계절 상품임에도 리드타임 버퍼 미확보

## 6. Actions Taken

| Step | Action | Responsible | Result |
|---|---|---|---|
| 1 | 트레이싱 지속 업데이트 (Brest 구간 온타임 T/S 요청) | 운영팀 | 진행 |
| 2 | 화주에게 적체 현황 안내 | 운영팀 | 진행 |
| 3 | 세진해운과 클레임 협의 | 영업팀 | $10,000으로 협의 |
| 4 | 향후 Rotterdam 향 운임 네고 제안 | 영업팀 | 관계 유지 |

## 7. Customer Communication

러시아 및 Brest 국경지역 적체로 인해 발차 일정이 지연되고 있습니다. 추가 지연 없도록 요청 중이오니 양해 부탁드립니다.

## 8. Internal Decision

- $10,000 클레임 수용 대신 향후 운임 네고로 처리
- 도의적 책임 인정, 금전 직접 부담 없이 운임으로 대체

## 9. Final Result

$10,000 클레임 → 운임 네고로 대체 합의. 관계 유지.

## 10. Lesson Learned

1. **계절 상품** 운송 시 리드타임에 충분한 버퍼 확보 필수
2. VVO 발 TSR은 적체 위험 상시 존재 → 계절 상품에 권장 루트 재검토
3. 클레임 발생 시 금전 배상 대신 운임 네고로 전환하는 방식 유효

## 11. New SOP Rule

> 계절 상품 TSR 진행 시:
> 화주에게 "러시아 구간 적체로 리드타임 변동 가능"을 서면 고지 필수.
> 계절 상품은 시즌 2개월 전 출발 권장.

## 12. Tags

`#vvo` `#seasonal_cargo` `#claim` `#tsr` `#transit_delay`
`#brest` `#claim_negotiation` `#2021`
