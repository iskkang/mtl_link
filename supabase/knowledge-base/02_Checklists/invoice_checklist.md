---
doc_type: checklist
domain: operations
issue_type: DOC_MISSING
region: global
last_updated: 2026-05-14
owner: operations_team
---

# Invoice Checklist

## 적용

Commercial Invoice 검토 시 사용.
DOC_MISSING, DOC_MISMATCH, CUSTOMS_DELAY 처리 시 1차 확인 도구.

## 필수 항목

### Header
- [ ] Invoice Number 기재
- [ ] Invoice Date 기재 (선적일 이전/같은날)
- [ ] Shipper 정보 (회사명, 주소, 연락처, 세금번호)
- [ ] Consignee 정보 (회사명, 주소, 연락처, 세금번호)
- [ ] Notify Party (BL의 Notify와 일치 여부 확인)

### 화물 정보
- [ ] 품명 영문 표기 (한국어/현지어 단독 불가)
- [ ] HS 코드 (6자리 최소)
- [ ] 수량 (단위 명시)
- [ ] 단가 (통화 명시)
- [ ] 총 금액
- [ ] 중량 (Gross / Net)
- [ ] 부피 (CBM)
- [ ] 원산지 (Country of Origin)
- [ ] 포장 수 및 종류 (예: 5 pallets, 100 cartons)

### 거래 조건
- [ ] Incoterms 명시 (FOB/CIF/EXW 등 + 장소)
- [ ] Payment Terms (T/T, L/C, D/P 등)
- [ ] Currency (USD/EUR/KRW 등)
- [ ] Bank Information (L/C인 경우)

### 운송 정보
- [ ] POL (출발항)
- [ ] POD (도착항)
- [ ] Final Destination
- [ ] Vessel/Voyage 또는 운송수단 (가능 시)

### 서명 및 인증
- [ ] Shipper 서명 또는 직인
- [ ] (필요 시) Notarization
- [ ] (필요 시) Embassy Legalization

## 일치성 확인 (다른 서류와 cross-check)

- [ ] **Packing List**와 일치: 수량, 중량, 포장 수, 품명
- [ ] **BL**과 일치: Shipper, Consignee, Notify, POL, POD, 화물 description
- [ ] **L/C** (해당 시): Beneficiary, Amount, Description, Documents

## 지역별 추가 요구

### China 수출
- [ ] 중문 품명 (또는 영문 명확)
- [ ] CIQ 인증 (해당 품목)

### CIS 수출
- [ ] 러시아어 또는 영문 (현지 요건 확인)
- [ ] EAC 인증 정보 (해당 품목)
- [ ] 공증 (일부 케이스)

### EU 수출
- [ ] EORI 번호
- [ ] EUR.1 / Form A (FTA 활용 시)

## 자주 발생하는 실수

| 실수 | 결과 |
|---|---|
| HS 코드 누락 또는 불일치 | 통관 지연, 페널티 |
| 품명 모호 ("Spare Parts") | 통관 검사 지정 |
| Invoice 금액과 BL 가치 불일치 | 세관 의심, 추가 서류 요청 |
| 인코텀즈 누락 | 책임 소재 분쟁 |
| 원산지 누락 | 관세 혜택 상실 |

## 관련 문서

- `02_Checklists/packing_list_checklist.md`
- `02_Checklists/bl_checklist.md`
- `01_SOPs/document_check_sop.md`
- `05_Rules/customs_risk_rule.md`
