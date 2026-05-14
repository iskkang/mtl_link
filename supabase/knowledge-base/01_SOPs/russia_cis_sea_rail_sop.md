---
doc_type: sop
domain: operations
issue_type: TRANSIT_DELAY
region: CIS
mode: sea-rail
last_updated: 2026-05-14
owner: operations_team
source: SOP_RUSCIS.docx
---

# Russia·CIS 해상 + 철송 SOP

## 1. Order 접수 및 확인

접수 시 필수 확인 항목:
- [ ] 수출자 정보
- [ ] 선적항 / 양하항
- [ ] 품명 (내품)
- [ ] 수량 / 중량 / 용적 (CBM) 또는 제품 사이즈
- [ ] Cargo Type (FCL/LCL)
- [ ] 운임 조건 (Incoterms)
- [ ] 화물 준비일자 (Cargo Readiness Date)
- [ ] 배차 진행 여부
  - FCL: 배차 날짜/시간, 주소, 담당자, 연락처
  - LCL: 동일

> Order 정보와 선적서류 정보 불일치 시 → 즉시 확인 요청

---

## 2. Russia 해상 프로세스 (BUS-VVO)

### 부킹
- 스케줄 조회 후 부킹 진행
- BL 타입 결정: OBL / Surrender / Sea Waybill
- DLV는 부킹 FINAL 지역으로 기재 (VVO까지면 VVO)
- REMARK에 통관지 기재: DDU(도착지 통관) / DDP(VVO 통관)

### MBL 작성
```
SHIPPER: MTL CO.,LTD. (SEOUL) O/B OF [실제 Shipper]
CONSIGNEE: 서류 상 Consignee
NOTIFY: 서류 상 Notify
DESCRIPTION: PL 또는 SR 기재 내용 기준
```

### 서류 마감 시 제출
- SR + CI/PL + 면장 (수출신고필증)
- VGM
- (TransContainer 경유 시) POA 부산 출항 전 제출 필수

---

## 3. Russia 철송 프로세스

### FESCO 경유 (BUS-VVO + 철송)
- 해상 부킹 시 러시아 내륙까지 함께 부킹
- 서류 마감 시 제출:
  - VVO 통관 시: 통관 담당자 정보 (회사명/이름/연락처/이메일)
  - 목적지 통관 시: 영문 + 러시아어 CI/PL + RWB Instruction

### TransContainer 경유 (BUS-VYP)
- MBL Consignee: BRIDGE LOGISTICS LLC 기재
- MBL Notify: BRIDGE LOGISTICS LLC 기재
- 서류 마감 시 제출:
  - VYP 통관: MBL/HBL/POA (처음 진행 Consignee) + 통관 담당자 정보
  - 도착지 통관: MBL/HBL/CI/PL/RWB Instruction/POA

---

## 4. CIS TCR 철송 프로세스

### 부킹 전 확인
- 진행 루트 결정 (청도/연운항 → CIS 지역)
- 컨테이너 사이즈/수량 확인

### Pre-alert (한국 출항 전 제출)
제출 서류:
- [ ] MBL
- [ ] HBL
- [ ] CI/PL
- [ ] 작업사진 (필수)
- [ ] Empty Return Instruction
- [ ] SVH (도착 스테이션 정보)

### Draft RWB 확인
- 에이전트로부터 Draft RWB 수령
- 서류 및 Empty Return 정보 이상 없는지 확인
- 확인 완료 후 컨펌 메일 발송

### 발차 진행 (TAO/LYG 차이)
- **청도(TAO)**: Port → Jiaozhou Station 셔틀 → Dispatch Plan Apply → Space 확보 → 발차
- **연운항(LYG)**: Port에서 Space 확보 시 바로 발차

### 발차 후
- 보통 3일 후 Debit Note + RWB 에이전트로부터 수령

---

## 5. BULK 수출 프로세스

### 부킹 전
- 화물 철송/트럭 진행 가능 여부 확인
- 선반입 가능 여부, 입고 가능 날짜/요일/시간 사전 확인 필수
- 사이즈 및 중량 선적 가능한 포트 확인

### 진행 순서
1. 철송 Agent에게 진행 스케줄 + 화물 디테일 전달 → Wagon 수배 요청
2. 해상 부킹 진행
3. 서류 마감 시 SR + CI/PL + 면장 제출
4. MBL/HBL/CI/PL 철송 Agent에게 최대한 빨리 전달
5. **비용 지불은 선적일 당일** (시간이 늦으면 다음 날)

---

## 6. 공통 체크리스트

### 부킹 정보 화주 전달 시 반드시 포함
- [ ] T/S 구간 Free time + Over rate
- [ ] 도착지 Free time + Over rate
- [ ] VVO Free time 및 비용 (한국에서 지불)
- [ ] 도착지 Free time 및 비용 (한국에서 지불)

### 서류 공통
- [ ] CI/PL: 영문 + 러시아어 작성
- [ ] SEAL: BOLT SEAL (말뚝씰) 사용, 올바른 위치 부착
- [ ] POA: 처음 진행 Consignee는 반드시 수령

---

## 관련 문서

- `05_Rules/russia_cis_transport_rules.md`
- `05_Rules/seal_position_rule.md`
- `05_Rules/railway_obl_rule.md`
- `02_Checklists/tsr_cis_checklist.md`
- `02_Checklists/tcr_document_checklist.md`
- `08_Route_Specifics/kr_cis_tsr.md`
- `08_Route_Specifics/kr_cis_tcr.md`
