---
doc_type: route
domain: operations
region: EU
mode: sea-rail
last_updated: 2026-05-14
owner: operations_team
source: 인수인계_추가.txt, 인수인계_FCL.docx
---

# Korea → Poland/Europe (TCR 유럽 노선 가이드)

## 1. 주요 노선

```
TCR 유럽 (MALA/Warsaw):
Incheon/Busan → Ningbo/Qingdao/Weihai → (TCR) → Mala/Warsaw
→ MTLWAW 핸들링

TSR 유럽 (FESCO):
Busan → Vladivostok → Brest → Kutno (Poland)
→ KUTNO 이후: Hamburg / Duisburg / Rotterdam 등
→ MTLPOL 핸들링

광양 → Gdansk 노선 (해상):
Gwangyang → Gdansk (직접 해상)
```

---

## 2. 주요 고객사 패턴 (운임 정보 제외)

### 그린오션 (도요타통상) — 광양→그단스크
- 서비스: Twil 운송
- 컨테이너: DET 4일 구매 (부킹 전 확인 필수)
- 특이사항: 종종 부킹 들어옴, 스케줄 확인 필요

### JBG (둔차오오토모티브) — 광양→그단스크
- 서비스: DOOR 진행
- 도착지 운송: Hana TNS (GDANSK → 최종 목적지)
- 청구 구조: JBG → (해상운임+도착지 THC/운송료) 청구
- 정산 흐름: 하나로 → MTLPOL → MTLSEL

### TCR 실리콘투 — 한국→브로츠와프 (DOOR)
- 첫 건 시작: 이진홍 팀장과 통관/배송 진행 확인
- 통관 특이사항: VAT 유예 특수 통관 → 현지에서 일반적이지 않은 방식
- 도착지 트럭: 별도 비용 발생
- 정산: MTLPOL ↔ MTLSEL

---

## 3. TCR 유럽 진행 프로세스 (MALA 기준)

### FCL 기준

```
1. 고객사 부킹 요청 수신
   ↓
2. MCI SHA 통해 진행 시 해상 부킹 후
   YORI(연태)에게 철송 부킹
   ↓
3. 한국 출항 전 CI/PL 전달 (필수)
   중국 도착 전 SUR BL 전달 (필수)
   ↓
4. MTLWAW에 BL + 화주 CI/PL + TRACING FILE 전달 (Pre-Alert)
   - 일반화물: Valeryia
   - 이노텍: SERHIY
   - 실리콘투: Yelizaveta
   ↓
5. 주 2회 (화, 목) 고객사 트레이싱
   에어테이블 업데이트
   ↓
6. 정산
```

---

## 4. 주요 루트별 특이사항

### 닝보 경유 주의
- 일부 닝보 터미널은 별도 트럭킹 필요 → 추가 비용 발생
- 사용 가능 터미널: Beilun, Daxie (CMICT)
- 사용 불가 터미널: Meishan, Yongzhou

### SOC 컨테이너 사용 시
- 허니택(Honeytack) 또는 CW 리징 검토
- 비용 비교 후 저렴한 방향 선택 (보통 리징 진행)
- Empty 반납: MALA

---

## 5. 주요 파트너

| 역할 | 담당 | 주요 서비스 |
|---|---|---|
| 중국 연태 | YORI (yori@mctransgl.com) | 철송 핸들링 |
| 폴란드 | VALERYIA (valeryia@mctransgl.com) | 일반화물 |
| 폴란드 | SERHIY (Serhiy@mctransgl.com) | 이노텍 |
| FESCO | Julia Vinokurova | TSR 철송 |

---

## 6. 실리콘투 통관 특이사항

- VAT 유예 통관 방식 → 현지에서 시간 소요
- 일반적 방식이 아님 → 이진홍 팀장 + MTLPOL과 진행 상황 지속 확인
- 통관 완료 전 ETA 단정 금지

---

## 7. 자주 발생하는 이슈

| 이슈 | 대응 |
|---|---|
| 닝보 사용 불가 터미널 배정 | 부킹 전 터미널 확인 필수 |
| SOC Empty Return 지연 | 매각처에 Empty Return Instruction 사전 수령 |
| 실리콘투 통관 지연 | VAT 유예 방식 — 화주에게 일반적이지 않은 통관임 사전 안내 |
| Tracing 2회/주 누락 | 화/목 기준 업데이트 — 에어테이블 + 이메일 |

---

## 관련 문서

- `08_Route_Specifics/kr_cis_tcr.md`
- `08_Route_Specifics/kr_cis_tsr.md`
- `01_SOPs/fesco_sop.md`
- `02_Checklists/tsr_fcl_process_checklist.md`
