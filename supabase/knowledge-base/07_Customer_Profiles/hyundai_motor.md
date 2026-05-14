---
doc_type: customer_profile
domain: operations
customer_name: 현대자동차
route: KR → KZ (Almaty/Brundai)
mode: sea-rail
service: DKD / CKD
last_updated: 2026-05-14
owner: operations_team
source: 인수인계_LCL.docx (민감정보 제거 버전)
note: 리펀드 금액 등 내부 비즈니스 조건 정보는 별도 관리 (본 문서 미포함)
---

# 현대자동차 업무 매뉴얼

## 기본 정보

| 항목 | DKD | CKD |
|---|---|---|
| Incoterms | FCA | FOB |
| 한국 로컬비용 | 청구 안 함 | 청구함 (현대자동차 담당자) |
| 주요 루트 | Busan → Lianyungang → Brundai Station | Busan → Qingdao → Almaty |
| 에이전트 | WJ (연운항) | Wendy (연태) |

---

## DKD 업무 프로세스

### 부킹
1. KZ 법인에서 부킹 요청 수신
2. 출하지 출고일 확인 (출하지 담당자에게 확인)
3. 중국 연태 법인(Wendy)에 선사, 루트, 컨테이너 릴리즈 정보 확인
4. 현재 루트: Busan → Lianyungang (WJ 담당, border까지)
5. Border → Brundai역까지: MTL KZ 법인 담당

### 스케줄 관리
- 출고 스케줄 자주 변경 → 유연하게 대응
- 스케줄 변경 시 관련 파트너 즉시 공유

### SEAL 관리
- BB SEAL (Barrier Seal) + 말뚝씰 사용
- 무원/최종훈 공장장에게 수량에 맞춰 구매
- 조은물류에 발송

### 작업사진
- 사진 취합 매우 중요
- 미비 시 연태 법인에 포토샵 요청

### 서류 마감
- SR: 연태 법인 요청 방식대로 작성
- Description:
  ```
  CARGO IN TRANSIT TO ALMATY KAZAKHSTAN VIA LIANYUNGANG, CHINA
  ```
- HBL/MBL: 연태 법인(Wendy)에 전달
- 현대자동차 CIPL → KZ 법인 전달 → CNEE CIPL만 Wendy에게 전달
  (현재는 KZ 법인 Zarina & Diana가 직접 전달)
- 출항 전후 트레이싱 정보 정리하여 Wendy에게 전달

### 청구
- 알마티 법인에 Debit Note로 RAF 청구
- ⚠️ 내부 비즈니스 조건 (리펀드 등)은 별도 관리 문서 참조

---

## CKD 업무 프로세스

### 부킹
1. KZ 법인에서 부킹 요청 수신
2. 현대차 담당자에게 출고일 확인
3. 연태 법인에 선사, 루트, 컨테이너 릴리즈 확인
4. 현재 루트: Busan → Qingdao (장금/한성/코흥)
5. 1BT당 200대 규모 / 연태 법인 요청 시 BL당 컨테이너 수 분할

### 서류 마감
- SR: 연태 법인 요청 방식대로 작성
- Description:
  ```
  CARGO IN TRANSIT TO ALMATY KAZAKHSTAN VIA QINGDAO, CHINA
  ```
- HBL/MBL: 연태 법인(Wendy)에 전달
- CKD는 출하지 여러 곳 → 사진 정보 다양한 곳에서 전달, 미흡 경우 많음

### 운송사 관리
- 운송사 3곳 이상 → 릴리즈 번호 혼선 없도록 관리 필수
- 세방에서 컨테이너 보관 (선반입 불필요)

### 청구
- 한국 로컬비용: 현대자동차 황선숙 매니저에게 청구
- 알마티 법인에 Debit Note로 RAF 청구

---

## 공통 특이사항

### BL 파트너 입력 기준
- HBL 상 TSR/TCR 모두 도착지 파트너: MTLKZ

### CNEE CIPL 흐름
```
현대자동차 CIPL → MTL → KZ 법인 전달
KZ 법인 (Zarina & Diana) → CNEE CIPL → 연태 법인(Wendy) 직전달
```

---

## MINT 판단 기준

```
현대자동차 케이스 처리 시:

주의 1: DKD vs CKD 구분 후 청구 방식 다름
        → DKD: 한국 로컬비용 청구 안 함
        → CKD: 한국 로컬비용 현대차에 청구

주의 2: 출고 스케줄 자주 변경
        → 스케줄 확정 지연이 정상 패턴

주의 3: CKD 운송사 3곳+ → 릴리즈 번호 관리 혼선 주의

주의 4: 리펀드 등 내부 비즈니스 조건은 본 문서에 없음
        → 별도 관리 문서 또는 담당 매니저 확인
```

## 관련 문서

- `02_Checklists/tcr_document_checklist.md`
- `08_Route_Specifics/kr_cis_tcr.md`
- `SENSITIVE_INFO_REMOVAL_GUIDE.md`
