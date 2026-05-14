---
doc_type: checklist
domain: operations
issue_type: DOC_MISSING
region: CIS
mode: sea-rail
cargo_type: used_car
last_updated: 2026-05-14
owner: operations_team
source: TCR_중고차_연료타입에_따른_HS_CODE.xlsx, USED_CAR_차종_CBM_.xlsx
---

# 중고차 TCR — HS코드 & CBM 참조표

## 1. 연료타입별 HS 코드 (승용차 기준)

| NO | HS Code | Fuel Type | Displacement |
|---|---|---|---|
| 1 | **8703.21** | Gasoline | ≤ 1,000cc |
| 2 | **8703.22** | Gasoline | 1,000cc ~ 1,500cc |
| 3 | **8703.23** | Gasoline / LPG | 1,500cc ~ 3,000cc |
| 4 | **8703.24** | Gasoline | > 3,000cc |
| 5 | **8703.31** | Diesel | ≤ 1,500cc |
| 6 | **8703.32** | Diesel | 1,500cc ~ 2,500cc |
| 7 | **8703.33** | Diesel | > 2,500cc |

> ⚠️ HS코드는 최종 통관 시 수입국 기준으로 재확인 필요.
> MINT는 참고용 분류만 제공 — 확정은 관세사 확인.

### 적용 예시

| 차량 | 배기량 | 연료 | HS Code |
|---|---|---|---|
| K3 (1598cc, Gasoline) | 1598cc | Gasoline | 8703.22 |
| Palisade (2199cc, Diesel) | 2199cc | Diesel | 8703.32 |
| K5 (2359cc, LPG) | 2359cc | LPG → Gasoline 분류 적용 | 8703.23 |
| BMW X7 (2993cc, Diesel) | 2993cc | Diesel | 8703.33 |
| Carnival (3470cc, Gasoline) | 3470cc | Gasoline | 8703.24 |

---

## 2. 차종별 CBM 참조 (실측 데이터 기반)

실제 선적 데이터 기반 참고치. 실제 적입 시 재측정 필요.

| 차종 | 배기량 | 연료 | CBM (참고치) |
|---|---|---|---|
| Hyundai Palisade | 2199cc | Diesel | 15.2 ~ 17.2 |
| Hyundai Palisade | 3778cc | Gasoline | 17.0 |
| Hyundai Santa Fe | 2497cc | Gasoline | 13.7 |
| Kia Carnival | 3470cc | Gasoline | 16.0 |
| BMW X3 | 2998cc | Gasoline | 14.2 |
| BMW X4 | 1998cc | Gasoline | 14.3 |
| BMW X7 | 2993cc | Diesel | 18.5 |
| Cadillac Escalade | 6162cc | Gasoline | 21.6 |
| Kia K3 | 1598cc | Gasoline | 11.2 ~ 11.6 |
| Kia K5 | 1999cc/2359cc | LPG | 12.9 |
| Kia K7 | 2359cc | LPG | 13.5 |
| Kia Grandeur | 2359cc | Gasoline | 12.6 |
| Kia Sportage | 1998cc | Gasoline | 12.7 |
| Kia Bongo 3 | 2497cc | Diesel | 15.4 ~ 16.4 |

> ⚠️ CBM은 실제 작업 전 측정 필수. 위 수치는 과거 실적 참고치.

---

## 3. 중고차 HS코드 확인 시 MINT 규칙

```
HS코드 확인 요청이 들어오면:
1. 연료 타입 + 배기량 확인
2. 위 표에서 참고 코드 제공
3. 반드시 단서 추가:
   "참고용 분류이며, 최종 HS코드는 수입국 기준으로
   관세사 확인이 필수입니다."
```

---

## 관련 문서

- `02_Checklists/used_car_tcr_checklist.md`
- `08_Route_Specifics/kr_cis_tcr.md`
- `05_Rules/russia_sanctions_risk_rule.md`
