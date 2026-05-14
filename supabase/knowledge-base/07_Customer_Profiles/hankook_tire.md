---
doc_type: customer_profile
domain: operations
customer_code: HT0007
customer_name: 한국타이어
route: KR → KZ (Almaty)
mode: sea-rail
service: TCR / TSR
incoterms: CIP Almaty
last_updated: 2026-05-14
owner: operations_team
source: 한국타이어_SOP.xlsx (최신)
---

# 한국타이어 업무 매뉴얼

## 기본 정보

| 항목 | 내용 |
|---|---|
| 고객 코드 | HT0007 |
| 운송 구간 | Busan, Korea → Almaty, Kazakhstan |
| Incoterms | CIP Almaty, Kazakhstan (TSR) |
| 서비스 | TCR / TSR |
| 컨테이너 | TSR: 짝수/SOC | TCR: 홀수/COC |

---

## 진행 프로세스 (10단계)

### Step 1. 운송사 컨테이너 픽업 요청
- 한국타이어에서 선적 요청 오면 운송사(한타/한솔/삼미)에서 공컨 픽업지 문의
- **한국타이어에 별도 확인 불필요** — 운송사와 직접 조율

### Step 2. MTL에 공컨 릴리즈 정보 요청
- 진행 선사 확정 후 SOC 공컨 픽업지 (Release No.) MTL로부터 수령

### Step 3. 릴리즈 정보 운송사 전달
- 수입자와 협의 중 → 컨테이너 픽업 진행
- **수입자 입금 확인 후 한국타이어 측에서 SR 전달** (2~3일 소요)
- 선적 스케줄 대략적 일정 확인이 어려움 → 유연하게 대응

### Step 4. 한국타이어로부터 진행 확인
- 담당자로부터 새 메일로 진행 확인 수신

### Step 5. MTL에 스케줄 부킹
- 가장 빠른 스케줄로 요청

### Step 6. 한국타이어 CI/PL 확인
- KZ 담당자(Irina Kvak)로부터 메일 확인
- CI/PL 토대로 DRAFT BL 발행 → 한국타이어 전달

### Step 7. 스케줄 + Draft BL 한국타이어 전달
- 사진 촬영 요청 (씰 사진 포함)
- **한국타이어는 작업사진 제공하지 않음** → 운송사에 사진 요청 필수
- 로지스프로 시스템에 진행 정보 입력

### Step 8. SR 작성 및 선사 서류 제출
- BL No. SR(CD) No. 작성 필수
- EDI: MTL에서 처리
- DRAFT BL: 한국타이어 KZ 담당자 + MTL 담당자에게 전달 (CIPL 첨부)

### Step 9. 출항 확인 + OBL 발행
- 출항 후 한국타이어 GLP 시스템에 BL 업로드
  - **파일명 = BL 번호** (일치해야 업로드 가능)
- 출항일 변경 시 로지스프로에도 재입력
- HBL 출력 시 선택: N07 MCI Origin B/L (FIATA)

### Step 10. RWB 확인 및 배송 완료
- Irina Kvak으로부터 RWB 수령
- 도착지 연결 상황 지속 업데이트
- 월말 세금계산서 발행 (월말 마감)

---

## 핵심 특이사항

### TCR/TSR 구분 규칙
| 구분 | TCR | TSR |
|---|---|---|
| 컨테이너 수량 | 홀수 | 짝수 |
| 컨테이너 소유 | COC | SOC |
| 작업사진 | 철도청 요청 시 제출 필수 | BOLT SEAL 필수 |

### TSR 전용 규칙
- BOLT SEAL (말뚝씰) 사용 **필수**
- POA: 수입자로부터 수령 → 1회 수령 시 1년 유효
- HBL = 한국 세관 신고용 (실제 운송 서류는 MBL)
- MBL: SHIPPER = 실수출자 O/B OF~ / CNEE = 실수입자

### TCR 전용 규칙
- 작업사진 철도청 전달 필요 → 촬영 요청 필수
- 컨테이너에 수입 통관용 CIPL 부착 후 진행
- 스위치 진행 시 도착지 CIPL 전달 필요

### 도착지 관련
- 1 CNTR = 1 RWB (철도 절대 규칙)
- 도착 터미널 확인 필수 (ZHETY-SU 또는 ALMATY-1 등 → KZ 법인이 수입자와 확인)
- RWB Instruction: KZ 법인에서 수입자와 확인

### Tashkent(UZ)향 TSR 진행 시
- MTL 우즈벡지점 + 러시아지점 모두에 CIPL & H/MBL 전달
- 1M1H BASE로 작성 (마스터 하나로 묶지 않기)

---

## 정산 특이사항

- 월말 내역서 엑셀파일 정리 후 메일 전달
- 한국타이어 컨펌 후 세금계산서 발행
- 로지스프로 이용료: 기본료 + 송수신 건당 과금 → 해당 월 마지막 BL에 입력
- (2026.01부터 (주)비투비씨앤아이 → (주)인스피언으로 인수합병)

---

## MINT 판단 기준

```
한국타이어 관련 케이스 처리 시:

주의 1: 한국타이어는 작업사진 제공 안 함
        → 운송사에 별도 요청 필수 (Missing Information으로 표시)

주의 2: 수입자 입금 확인 후 SR 전달 구조
        → 스케줄 확정 지연이 정상 패턴 (이슈 아님)

주의 3: BL 업로드 파일명 = BL 번호 일치 필수
        → 불일치 시 GLP 시스템 업로드 불가
```

## 관련 문서

- `02_Checklists/tsr_fcl_operations_checklist.md`
- `05_Rules/russia_cis_transport_rules.md`
- `05_Rules/seal_position_rule.md`
- `08_Route_Specifics/kr_cis_tsr.md`
