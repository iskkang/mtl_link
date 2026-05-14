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

## 1. 노선 정보

```
주요 루트: BUSAN → VLADIVOSTOK → BREST → KUTNO (폴란드)
           KUTNO 이후: HAMBURG / DUISBURG / ROTTERDAM 등 연결

서비스 타입:
- FOR: RAIL까지 운송 (MTLPOL이 AN 받고 도착지 핸들링)
- FOT: 도착지 TRUCK까지 포함
→ 유럽 철송 건은 도착 후 MTLPOL 핸들링이므로 FOR으로 부킹
```

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
- HS CODE + ITEM 명 확인
- **1PKG당 중량 확인** (1.5톤 초과 여부)
- TSR 제한 아이템 여부 확인

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
