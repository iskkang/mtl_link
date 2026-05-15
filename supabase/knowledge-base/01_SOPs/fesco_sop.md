---
doc_type: sop
domain: operations
issue_type: TRANSIT_DELAY
region: CIS
mode: sea-rail
last_updated: 2026-05-14
owner: operations_team
source: FESCO_SOP.docx
---

# FESCO 운송 SOP

## 1. 기본 루트

```
A. 한국 → 러시아

Busan → Vladivostok → 러시아 내륙

FESCO의 한국-러시아 정기 해상 서비스는 KSDL / Korea Soviet Direct Line입니다. 공식 설명상 Busan–Vladivostok 구간을 운항하며, 일반화물, 위험물, 냉장화물, 벌크/특수장비 화물을 취급합니다. Busan–Vladivostok 해상 구간 표기 T/T는 2 days입니다.

B. 한국 → 우즈베키스탄

Busan → Vladivostok → Tashkent/Chukursay

FESCO는 한국·중국·일본 등 아시아 국가 화물을 Vladivostok 또는 Novorossiysk를 통해 Uzbekistan으로 운송한다고 명시하고 있습니다. Vladivostok–Tashkent는 FESCO Tashkent Shuttle이 있고, 도착역은 Chukursay, 주 1회, T/T 13–14 days로 공개되어 있습니다.

C. 한국 → 카자흐스탄

Busan → Vladivostok / Novorossiysk / St. Petersburg / 육상 국경 → Almaty, Astana, Kostanay 등

FESCO는 Kazakhstan향 운송을 Vladivostok, Novorossiysk, St. Petersburg 및 육상 국경 경유로 제공한다고 안내하고, 노선 맵상 Almaty, Astana, Kostanay를 표시합니다
---

## 2. FESCO 특이사항 (운영팀 필수 숙지)

### 지연 관련
- **블라디보스톡 도착 후 발차까지 약 20일 소요** (러시아 적체)
- 랜덤 인스펙션 발생 시 추가 지연 가능
- SEAL 정위치 미부착 → RE-SEALING 진행 → 추가 지연

### 중량 관련
- **1PKG당 1.5톤 이상 화물**: LASHING SCHEME 사전 받아야 함 → 1개월 이상 소요
- 실질적으로 **1PKG당 1.5톤 이하 화물만** 취급 권장
- 계근 중량과 서류 중량 차이 **60kg 미만**: 서류 정정 없이 진행 가능
- 60kg 이상 차이 → 러시아에서 중량 검사 후 서류 정정 요청
- 큰 차이 발생 시 → **FULL INSPECTION** (전체 화물 적출)

> ⚠️ 한국에서 정확히 계근해도 러시아에서 60kg 이상 차이 날 수 있음 → 화주 사전 안내 필요

### SEAL 규정 (러시아 향 필수)
- **High Security Seal (막대실) 사용 필수**
- 부착 위치: **오른쪽 Door, 왼쪽 Locking Bar**
- SEAL No.: 일련번호 + 앞 영문자 포함하여 통보 (예: T 800003)
- 미준수 시 러시아 세관 검사 + 추가 비용 발생

### FESCO 장단점

| 구분 | 내용 |
|---|---|
| **장점** | 선사 담당자 업무 협조 원활 |
| **단점 1** | 통관 및 운송 지연 심각 |
| **단점 2** | FESCO KOREA 트레이싱 부정확 (위치/도착 일정 확인 어려움) |
| **단점 3** | 도착지 AGENT(PCC) 업무 비협조 → EMPTY RETURN, AN 정보 지연 |

---

## 3. 부킹 스케줄

| 구분 | 기준 |
|---|---|
| DOC Closing | 출항 전주 **금요일 오전 11시** |
| Cargo Closing | 접안 전 |

---

## 4. 업무 프로세스

### Step 1: 부킹 전 확인
- 화주 부킹 요청 확인
- 품명, HS Code, 수량, 중량, CBM
- 컨테이너: SOC / COC, 20GP / 40GP / 40HQ / RF 확인
- 카고타입: 일반 / DG / Reefer / OOG / 중량화물
- **1PKG당 중량 확인** (1.5톤 초과 여부)
- TSR 제한 아이템 여부 확인
- 핵심은 러시아향이면 제재 품목 확인을 먼저 해야 한다는 것입니다. 화물 먼저 받고 나중에 체크하면 위험합니다. 특히 전자부품, 기계류, 차량부품, 이중용도 품목은 FESCO 부킹 가능 여부와 별개로 한국 수출통제 리스크가 있습니다.

### Step 2: 선사 부킹
- 이메일/유선으로 FINAL STATION, 수량, 선적일 전달 후 선복 부킹
- FESCO 부킹시트 수령 후 MTL 부킹시트 작성
- **부킹시트 전달 시 SEAL 부착 공문 함께 전달 필수**

### Step 3: 내륙 운송 (MTL 진행 시)
- 화주 작업 일정 및 작업지 확인
- 운송사에 이메일로 부킹시트 전달 + 운송 요청
- 접안 제한 시 운송사에 컨테이너 보관 요청 + 화주 보관 비용 안내

### Step 4: 선적 서류 작성
- HOUSE BL 작성 (ELVIS 시스템)
- CHECK BL 화주 전달 및 이상 여부 확인
- SR 작성 (MASTER BL)
  - SHIPPER: 실제 Shipper (CI/PL 기준)
  - CONSIGNEE: 실제 Consignee
  - NOTIFY: MTLPOL (도착지 핸들링)

### Step 5: 서류 제출
- SR + CI/PL + VGM 선사에 이메일 제출
- FINAL STATION 및 컨테이너 수량 명시

### Step 6: EDI 전송
- 선사로부터 MASTER BL 수령 후 ELVIS에 입력
- MRN NO, 세관 030, 통관과 D9 입력 후 전송
- PLISM에서 오류 여부 확인

### Step 7: 출항 후
- 선사 확인 또는 터미널 사이트에서 출항 확인
- 당일 환율로 AR/AP 입력
- 화주에게 인보이스 전달
- SURRENDER 처리 요청 (BL No 포함 이메일)

### Step 8: 주의사항
- 러시아·중앙아시아향은 B/L description을 너무 애매하게 쓰면 문제가 생길 수 있다는 것입니다. 
- “Machine parts”, “Equipment”, “Accessories”처럼 뭉뚱그리면 FESCO/세관/은행에서 추가 확인이 나올 가능성이 큽니다.

### Step9: 도착지 통관 / 최종 배송
 - 수입자 등록:	러시아/우즈벡/카자흐 현지 consignee 수입 가능 여부
 - 통관 브로커:	FESCO 제공 또는 수입자 지정
 - HS Code:	한국 HS와 현지 HS 불일치 여부
 - 인증:	EAC, 위생증, 식품/화장품/전자 인증 등
 - 세금:	VAT, Duty, 통관 수수료
 - D/O:	FESCO 또는 현지 agent release 조건
 - Final delivery:	역 도착 후 truck delivery 여부

---

## 5. 이슈 판단 기준

| 상황 | 판단 |
|---|---|
| 블라디보스톡 도착 후 20일 이내 발차 지연 | Medium (정상 범위) |
| 20일 초과 발차 지연 | High — 파트너 확인 요청 |
| SEAL 미부착/오부착 통보 | Medium — RE-SEALING 비용 발생 가능, 화주 통보 |
| 중량 차이 60kg 미만 | Low — 서류 정정 없이 진행 |
| 중량 차이 60kg 이상 | Medium — 러시아 서류 정정 가능성 안내 |
| FULL INSPECTION 통보 | High — 팀장 보고, 화주 즉시 안내 |

---

## 관련 문서

- `02_Checklists/tsr_cis_checklist.md`
- `08_Route_Specifics/kr_cis_tsr.md`
- `05_Rules/russia_sanctions_risk_rule.md`
