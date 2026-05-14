---
doc_type: customer_profile
domain: operations
customer_code: SS0023
customer_name: 삼성물산
route: JP(Moji) → CN(Xingang) → KZ(Khorgos) → 광산 목적지
mode: sea-rail
service: FCL (OT 컨테이너 포함)
incoterms: DAP
last_updated: 2026-05-14
owner: operations_team
source: 삼성물산_SOP.xlsx (트레이싱 데이터 기반)
---

# 삼성물산 업무 매뉴얼

## 기본 정보

| 항목 | 내용 |
|---|---|
| 고객 코드 | SS0023 |
| 인코텀즈 | DAP |
| 주요 루트 | Japan(Moji) → China(Xingang) → Kazakhstan(Khorgos) → 광산 |
| 컨테이너 | 40OT (Open Top), 40HC, 20OT 등 |
| 화물 | 타이어 (대형 광산 타이어, OT 컨테이너 필요) |
| 최종 목적지 | Aktogay / Bozshakol / Zhezkazgan / Balkhash / Karaganda 등 광산 |

---

## 핵심 특이사항

### 트레이싱 보고 규칙 (매우 중요)
- **하루 2회 업데이트 필수** — 오전 10시 / 오후 5시
- **주말 포함** 매일 진행
- 업데이트 수신자: 장병희 부장님 (총괄)
- 각 화물별 상세 설명 메일 본문에 기재 필수
- 국경 대기 중인 경우 → **대기 몇 번째인지 업데이트마다 안내**

### 트레이싱 주요 체크포인트
- Xingang 출발 → Khorgos 도착 → 국경 통과 → Nurzholy 도착/통관 → 최종 목적지
- Khorgos 국경 대기 일수 기록 (실적상 17일~23일 대기 사례 있음)
- 컨테이너별 상태 개별 관리

---

## 진행 프로세스

### Step 1. 부킹 요청
- 일본 지점(최인호님)으로부터 부킹 요청 확인
- 스케줄 지장 없는지 지속 체크

### Step 2. 작업 일정 공유

### Step 3. 서류 수령
- 최인호님으로부터 HBL, MBL, CIPL (Bridgestone's) 공유
- CIPL은 KZ 법인 전달 → CNEE CIPL 요청 후 → 중국 법인에 전달
  (현재는 KZ 법인 Zarina & Diana가 CNEE CIPL을 중국 법인에 직접 전달)

### Step 4. 서류 전달 체계
- CIPL 중국 연태 지점에 Xingang 도착 **전에** 전달 필수
- Final CIPL (삼성물산)으로 CMR 작성 (중국 지점 담당)
- 카작 법인 Almaty 사무소 담당자에게도 전달 → 장병희 부장님 검토

### Step 5. 통관 흐름
```
국경 도착 → 환적 완료 → Inspection → 통관 완료 → 국경 발차 대기열
```
- 통관 완료 후에야 국경 발차 대기열 진입 가능

### Step 6. 트레이싱 업데이트
- 지사와 확인 후 장병희 부장님께 오전/오후 업데이트
- 도착 후 CMR 인수증 수령 → 내용 확인 후 회신 → 최종본 공유

### Step 7. CHECKLIST 송부
- 통관 진행 시점 → DIANA에게 요청
- 통관 완료 후 화주에게 발송
- 하역(언로딩) 계획 확인을 위한 현장 전달 파일
- ETA 변경 시 수정 재제출 필요

### Step 8. Green Number 문의
- 장병희 부장님 요청 시 카작 법인 DIANA에게 문의

---

## OT 컨테이너 진행 시 주의

- OT(Open Top) 컨테이너로 진행: Moji 출항 → Xingang 도착 → Khorgos 이동
- Xingang 환적: devanning 후 검사 → 일정 공지

---

## 정산 구조

- MTL TYO, MTL SHA, MTL ALA 각각 DEBIT 시스템 입력
- MTL ALA는 MTL SEL로 입력
- 일본 법인 DEBIT의 특정 비용 항목은 현지 THC를 화주에게 청구 후 별도 처리

---

## MINT 판단 기준

```
삼성물산 케이스 처리 시:

주의 1: 트레이싱 2회/일 의무 (주말 포함)
        → 미발송 시 High risk로 분류

주의 2: Khorgos 국경 대기 장기화는 정상 패턴
        → 17~23일 대기는 High risk가 아니지만
           30일 초과 시 에스컬레이션

주의 3: CIPL 중국 법인 전달 타이밍
        → Xingang 도착 전 전달 필수
           지연 시 통관 지연으로 연결
```

## 관련 문서

- `02_Checklists/tsr_fcl_operations_checklist.md`
- `08_Route_Specifics/kr_cis_tcr.md`
- `05_Rules/russia_cis_transport_rules.md`
