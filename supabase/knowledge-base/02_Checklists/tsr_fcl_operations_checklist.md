---
doc_type: checklist
domain: operations
issue_type: DOC_MISSING
region: CIS
mode: sea-rail
last_updated: 2026-05-14
owner: operations_team
source: 한국타이어_SOP.xlsx (최신), FESCO_SOP.docx, SOP_RUSCIS.docx
---

# TSR FCL 업무진행 체크리스트 (최신)

## 부킹 전 확인

- [ ] 노미건: 파트너로부터 Booking Sheet 수령 (진행 전 필수)
- [ ] Cargo Readiness Date + 화물 디테일 확인 (수량/중량/CBM/사이즈)
- [ ] HS CODE + ITEM명 확인
- [ ] **1PKG당 중량 확인** — 1.5톤 초과 시 LASHING SCHEME 필요 (1개월+ 소요)
- [ ] DG 여부 확인 — DG는 FINAL DESTINATION역 승인 가능 여부 사전 확인
- [ ] 컨테이너 수량 확인:
  - TSR: 짝수 → SOC (자사 컨테이너)
  - TCR: 홀수 → COC (선사 컨테이너)
- [ ] SEAL 준비 — BOLT SEAL (말뚝씰) 사용 필수
- [ ] POA 수령 여부 — 처음 진행 Consignee면 반드시 수령 (1번 = 1년 유효)

---

## 부킹

- [ ] SOC 공컨 픽업지 (Release No.) 확인
- [ ] Release 정보 운송사 전달
- [ ] 가장 빠른 스케줄로 선사 부킹
- [ ] 부킹 시 DLV = FINAL 지역으로 기재
- [ ] **부킹 정보 화주 전달 시 반드시 포함:**
  - T/S 구간 Free time + Over rate
  - 도착지 Free time + Over rate
  - VVO Free time 및 비용 (한국 지불)
- [ ] DG 건: 작업사진 선사 컨펌(APPROVED) 후 터미널 반입 가능
- [ ] SEAL 부착 위치 공문 화주/운송사에 함께 전달

---

## 서류 마감

- [ ] 화주로부터 CI/PL 수령
  - 영문 + **러시아어** 작성 확인
  - 컨테이너별 CI/PL 각각 작성 확인
  - HS CODE별 Net/Gross Weight, Value 분리 확인
- [ ] HOUSE BL 작성
- [ ] **TSR MBL 작성 기준 확인:**
  ```
  SHIPPER: 실수출자 O/B OF~
  CONSIGNEE: 실수입자
  NOTIFY: 실수입자 또는 도착지 포워더/통관사
  ```
  > TSR HBL = 한국 세관 신고용. MBL이 실제 운송 서류.
- [ ] S/R 작성 및 선사 제출 (CI/PL + VGM 포함)
- [ ] EDI 전송
- [ ] CHECK BL → 화주 확인
- [ ] Pre-alert 파트너에게 전달:
  - MBL / HBL / CI/PL / 작업사진
  - (통관 방식에 따라) POA, RWB Instruction 추가

---

## 출항 후

- [ ] 출항 확인
- [ ] OBL 발행 또는 Surrender 처리
- [ ] 화주에게 Final BL + Invoice 전달
- [ ] (해당 시) 고객사 시스템에 BL 업로드
- [ ] 세금계산서 발행

---

## RWB 및 도착지 관리

- [ ] Draft RWB 수령 → 서류 및 Empty Return 정보 확인 → 컨펌 메일
- [ ] **1 CNTR = 1 RWB** (철도 운송 절대 규칙)
- [ ] 도착 터미널 확인 (KZ: ZHETY-SU / ALMATY-1 등 수입자 확인 필요)
- [ ] 트레이싱 화주 전달 주기 확인 (고객사별 상이)
- [ ] VVO 도착 → 발차 예상 소요: 통상 20일 (러시아 적체)

---

## 정산

- [ ] AR/AP 입력 (출항일 기준 환율)
- [ ] 파트너에게 DN 전달
- [ ] 월말 정산 처리

---

## MINT 누락 체크 우선순위

운영팀이 TSR FCL 케이스 입력 시 MINT는 다음 순서로 누락 확인:

```
1. POA 수령 여부 (처음 진행 Consignee)
2. CI/PL 러시아어 버전 확인
3. 1PKG당 중량 1.5톤 미만 확인
4. BOLT SEAL 사용 및 위치 확인
5. MBL Shipper/Consignee 기재 방식 확인
6. 1 CNTR = 1 RWB 확인
7. T/S 구간 Free time 화주 안내 여부
```

## 관련 문서

- `05_Rules/russia_cis_transport_rules.md`
- `05_Rules/seal_position_rule.md`
- `05_Rules/railway_obl_rule.md`
- `02_Checklists/tsr_cis_checklist.md`
- `01_SOPs/fesco_sop.md`
