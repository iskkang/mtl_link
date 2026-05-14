---
doc_type: rule
domain: operations
region: CIS
mode: sea-rail
last_updated: 2026-05-14
owner: operations_team
source: SOP_RUSCIS.docx, 한국타이어_SOP.xlsx
---

# Russia·CIS 운송 핵심 규칙

## 1. BL 타입 선택 기준

| BL 타입 | 설명 | 사용 시점 |
|---|---|---|
| **Original B/L (OBL)** | 원본 BL 회수 후 화물 인도 | 대금 회수 전 화물 보호 필요 시 |
| **Surrender BL** | SURRENDER 도장 → 원본 없이 화물 인도 가능 | 신뢰된 거래처, 대금 확인 후 |
| **Sea Waybill** | 부킹과 동시에 자동 RELEASE | 계열사 간 운송, 빠른 인도 필요 시 |

---

## 2. TSR HBL 특수성 (중요)

**TSR(러시아향) 운송에서 HBL은 한국 세관 신고용입니다.**
실제 운송 서류는 MBL이며, 수하인이 화물을 수취하는 근거는 MBL입니다.

### MBL 작성 기준 (TSR)

```
SHIPPER: 실수출자 O/B OF~ (예: MTL CO.,LTD. O/B OF [실제 Shipper])
CONSIGNEE: 실수입자 (직접 기재)
NOTIFY: 실수입자 또는 도착지 포워더/통관사
```

> ⚠️ HBL을 화주에게 넘기면 화물 수취와 무관합니다.
> 화주에게 사전 안내 필수.

---

## 3. TCR vs TSR 선택 기준

| 구분 | TCR | TSR |
|---|---|---|
| 컨테이너 수량 | 홀수 권장 | 짝수 권장 |
| 컨테이너 소유 | COC (선사 소유) | SOC (자사 소유) |
| SEAL | 말뚝씰 | **BOLT SEAL (말뚝씰) 필수** |
| 작업사진 | 철도청 요청 시 전달 | 철도청 요청 시 전달 |

---

## 4. RWB (Railway Waybill) 규칙

```
1 CNTR = 1 RWB (철도 운송 절대 규칙)
여러 컨테이너를 1개 RWB로 묶지 않습니다.
```

도착 터미널 정보는 RWB에 반드시 기재:
- 카자흐스탄의 경우: ZHETY-SU 또는 ALMATY-1 등 터미널 확인 필요
- 수입자 또는 현지 법인에 사전 확인

---

## 5. POA (위임장) 유효기간

- **1회 받으면 1년 유효**
- 처음 진행하는 Consignee일 경우 반드시 수령
- CIS 지역별 공증 요건 별도 확인 (`02_Checklists/poa_cis_checklist.md`)

---

## 6. T/S 구간 Free Time 안내 규칙

**철송 진행 건은 부킹 정보 전달 시 반드시 안내:**

- T/S 구간 Free time 및 Over rate
- 도착지 Free time 및 Over rate
- 추가 비용 발생 시 화주 부담 여부

### Qingdao Rail Station (Jiaozhou) 보관료

| Container | 1-30일 | 31-35일 | 36-45일 | 46-60일 | 60일+ |
|---|---|---|---|---|---|
| 20GP | Free | $0.8/일 | $1.6/일 | $2.4/일 | $4.8/일 |
| 40HQ | Free | $1.6/일 | $3.2/일 | $4.8/일 | $9.6/일 |

### 연운항(LYG) 보관료

- Port: 10일 무료 → 이후 $1.8/20'/일, $3.5/40'/일
- Zhongha Depot: 4일 무료 → 이후 $0.8~$1.8/20'/일 (기간별 상이)

> ⚠️ 보관료는 변동 가능. 진행 건 발생 시 파트너에게 최신 요율 확인 필수.

---

## 7. TSR 운송 제한 사항

- 1PKG당 1.5톤 초과 → **LASHING SCHEME** 사전 취득 필수 (1개월+ 소요)
- 실질적으로 1PKG당 1.5톤 이하만 취급
- 22TON 미만으로 작업 제한 (운송 제한 규정)
- T/S 포트에서 실측 후 서류 정정 요청 빈번 → 실제 중량과 서류 일치 필수

---

## 8. VVO(블라디보스톡) 도착 → 발차 순서 (TSR)

```
해상 접안
  ↓
VVO CY 반입
  ↓
T/S 혹은 수입 신고 (통관 방식 사전 결정 필수)
  ↓
통관 서류 Rail Terminal로 전달
  ↓
Rail Terminal 서류 승인
  ↓
Dispatch schedule setting
  ↓
VVO 발차
```

- 도착 후 발차까지 통상 **20일 소요** (러시아 적체)
- "Dispatch" = wagon이 발차 대기 중인 상태

---

## 관련 문서

- `05_Rules/railway_obl_rule.md`
- `05_Rules/seal_position_rule.md`
- `02_Checklists/tsr_cis_checklist.md`
- `02_Checklists/poa_cis_checklist.md`
- `08_Route_Specifics/kr_cis_tsr.md`
