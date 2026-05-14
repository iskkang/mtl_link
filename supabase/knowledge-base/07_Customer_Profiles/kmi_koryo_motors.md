---
doc_type: customer_profile
domain: operations
customer_name: KM&I (고려모터스)
route: KR → UZ (Andijan/Tashkent)
mode: sea-rail
service: TCR RAIL+TRUCK / TSR
incoterms: FOB Busan
last_updated: 2026-05-14
owner: operations_team
source: 메뉴얼-김지연.xlsx, MTL_UZ노미_우즈동흥_진행_건-SOP.docx
---

# KM&I (고려모터스) 업무 매뉴얼

## 기본 정보

| 항목 | 내용 |
|---|---|
| 수출자 | 고려모터스 (KM&I) |
| 한국 포워더 | SGNG (에스지앤지) |
| Incoterms | FOB Busan |
| 주요 루트 1 | TCR RAIL+TRUCK: Incheon → Qingdao → Andijan |
| 주요 루트 2 | TSR NON-DG: Busan → Vladivostok → Tashkent |
| 주요 루트 3 | TSR DG(MDI): Busan → Vladivostok → Tashkent |
| 화물 | KD PARTS (자동차 부품) |

---

## 핵심 특이사항

### 연락 방식
- SGNG와는 **네이트온**을 통해 연락 (메일 + 네이트온 병행)
- **모든 메일에 MTL UZ 참조 필수**

### 컨테이너 진행 방식
- 컨테이너 작업 먼저 진행 → 선사 터미널 보관 → 선적 홀딩
- 실제 진행 시 컨테이너 번호와 함께 가장 빠른 스케줄로 요청

### BL 작성 특이사항 (TCR RAIL+TRUCK)
- **컨테이너별로 HBL/MBL 각각 생성** (트럭 진행 시 컨테이너별 신고)
- EDI 아이템명: `KD PARTS`
- RAIL+TRUCK 건: 컨테이너별 HBL/MBL 분리 필수

### MBL 기재 방식 (TCR)
```
SHIPPER: MTL CO., LTD. O/B OF KM&I CO., LTD
         493, KAJWA-DONG SEO-KU INCHON REPUBLIC OF KOREA
CONSIGNEE: MCI GLOBAL LOGISTICS (SHANGHAI) CO.,LTD (에이전트)
NOTIFY: CONSIGNEE와 동일
DESCRIPTION:
  KD PARTS
  *THIS IS TRANSIT SHIPMENT TO
  UZBEKISTAN ANDIJION, VIA QINGDAO, CHINA
  THE CARRIER'S RESPONSIBILITY LIMITS AT
  PLACE OF DELIVERY (PORT OF DISCHARGING) ONLY
```

---

## 진행 프로세스

### TCR RAIL+TRUCK (INC-TAO-ANDIJIAN)

**부킹 단계**
1. SGNG로부터 EMPTY 컨테이너 릴리즈 요청 수신
2. MTL 우즈벡 측에 진행 컨펌 요청
3. 진행 컨펌 확인 후 공컨 릴리즈 (MTL 보유 컨테이너 또는 컨테이너 매입)
4. **EMPTY 릴리즈 시 서류 + 컨테이너 작업 가이드 안내 필수**

**서류 마감 단계**
1. SGNG에서 실제 진행 컨펌 → 컨테이너 번호 지정 → 가장 빠른 스케줄 요청
2. SITC 부킹 수정 또는 신규 부킹
3. 스케줄 + 서류마감 SGNG에 안내
4. 최종 CI/PL + 면장 + 작업사진 수령 → HBL 발행
5. MBL 번호 생성 후 중국 에이전트에 MBL/CI/PL 전달
6. 오후에 면장/작업사진 수령 → MRN 번호 입력 → EDI 전송

**정산**
- SELLING: MTL 우즈벡에서 알려준 운임으로 UZBTTL 청구
- DN은 반드시 EXCEL 파일로 저장해서 발송 (수정 가능 형태 유지 필수)

### TSR NON-DG (BUS-VVO-TASHKENT)

**선사**: 장금상선 또는 흥아라인 (해상) + FESCO (철송)

**특이사항**
- ETSNG CODE 사전 확인 필수 (우즈벡 건)
- VVO-TAS MY.FESCO 부킹: 부산 출항 전에 진행
- VVO 도착 전 MY.FESCO 서류 업로드 필수

**DG(MDI) 건**
- 선사: FESCO (해상+철송)
- FESCO 측에서 작업사진 컨펌(APPROVED) 후 부산 터미널 반입 및 선적 가능

---

## 트레이싱

- TCR RAIL+TRUCK: MTL 우즈벡에서 자체 확인
- TSR: FESCO로부터 받은 트레이싱을 MTL 우즈벡에 전달

---

## MINT 판단 기준

```
KM&I 관련 케이스 처리 시:

주의 1: RAIL+TRUCK 건은 반드시 컨테이너별 HBL/MBL 분리
        → 통합 BL 발행 시 트럭 구간 통관 문제 발생 가능

주의 2: DN은 반드시 Excel 파일로 전송
        → PDF만 전송 시 수입자 측 취합 불가

주의 3: EMPTY 릴리즈 전 MTL UZ 진행 컨펌 필수
        → 컨펌 없이 릴리즈 시 책임 소재 문제

주의 4: 모든 메일에 MTL UZ 참조 누락 시 → Missing Information
```

## 관련 문서

- `02_Checklists/tsr_fcl_operations_checklist.md`
- `02_Checklists/tcr_document_checklist.md`
- `08_Route_Specifics/kr_cis_tcr.md`
- `08_Route_Specifics/kr_cis_tsr.md`
