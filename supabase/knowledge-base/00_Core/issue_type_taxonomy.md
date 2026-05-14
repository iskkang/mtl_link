---
doc_type: core
category: taxonomy
version: 1.0
last_updated: 2026-05-14
---

# Issue Type Taxonomy

## 목적

MINT가 운영 이슈를 분류할 때 사용하는 표준 분류 체계.
**모든 응답은 반드시 1개 이상의 Issue Type 코드로 시작한다.**

## 분류 코드

| Code | Issue Type | 정의 | 예시 |
|---|---|---|---|
| `DOC_MISSING` | 서류 누락 | 선적/통관에 필요한 서류가 없거나 미수령 | Invoice 없음, PL 누락, POA 미수령 |
| `DOC_MISMATCH` | 서류 불일치 | 서류 간 내용 불일치 | Invoice와 PL의 중량 불일치 |
| `CUSTOMS_DELAY` | 통관 지연 | 통관 검사·서류 보완·HS코드 이슈로 인한 지연 | 세관 추가 서류 요청, 검사 지정 |
| `TRANSIT_DELAY` | 운송 지연 | 환적·국경·운송수단 변경 중 지연 | 중국 국경 정체, 환적항 누락 |
| `PARTNER_DELAY` | 파트너 응답 지연 | 해외 파트너·에이전트 무응답 또는 액션 지연 | 24h 이상 무응답, 트럭 배차 미확정 |
| `COST_DISPUTE` | 비용 분쟁 | 예상치 못한 비용·창고료·체화료·페널티 발생 | 화주가 추가 보관료 거부 |
| `ETA_RISK` | ETA 리스크 | 도착 예정일 불확실 또는 변경 가능성 | 화주가 확정 ETA 요구 |
| `CARGO_DAMAGE` | 화물 손상/멸실 | 손상·분실·침수·단포 | 도착지 박스 손상 발견 |
| `CUSTOMER_CLAIM` | 화주 클레임 | 지연·비용·손상·소통에 대한 화주 항의 | 지연으로 인한 손해배상 요구 |
| `BORDER_ISSUE` | 국경/통과 이슈 | 국경 통관·통과 허가·corridor 문제 | 카자흐스탄 국경 보류 |
| `PAYMENT_HOLD` | 결제 보류 | 미납으로 인한 화물 release 보류 | 도착지 에이전트 DO 미발행 |

## 분류 우선순위 규칙

여러 Issue Type이 동시에 해당될 경우 **다음 순서**로 Primary를 결정한다:

```
1. CARGO_DAMAGE       (가장 심각, 즉시 에스컬레이션)
2. CUSTOMS_DELAY
3. BORDER_ISSUE
4. DOC_MISSING
5. DOC_MISMATCH
6. COST_DISPUTE
7. ETA_RISK
8. PARTNER_DELAY
9. CUSTOMER_CLAIM     (다른 이슈의 결과인 경우가 많음)
10. PAYMENT_HOLD
```

**Secondary Type**: Primary 외에 적용되는 Issue Type을 1개 추가로 명시. 최대 2개까지.

## 출력 규칙

분류 결과는 반드시 다음 형식으로 출력한다:

```
Primary Issue Type: CUSTOMS_DELAY
Secondary Issue Type: DOC_MISSING
Reason: 세관이 추가 서류를 요청했고, 해당 서류가 화주로부터 미수령 상태이므로 통관 지연이 1차 문제, 서류 누락이 2차 문제이다.
```

## 분류 가이드 — 자주 헷갈리는 경우

**Q: CUSTOMS_DELAY vs DOC_MISSING**
→ 세관이 이미 요청한 상태면 CUSTOMS_DELAY (Primary), DOC_MISSING (Secondary)
→ 출항 전 단계에서 서류만 없으면 DOC_MISSING only

**Q: CUSTOMER_CLAIM vs 다른 이슈**
→ 화주가 "이미 항의했다"는 사실이 있으면 CLAIM이 Primary가 될 수 있다
→ 항의 가능성만 있으면 원인 이슈가 Primary, CLAIM은 Secondary

**Q: ETA_RISK vs TRANSIT_DELAY**
→ 실제 지연이 발생했으면 TRANSIT_DELAY
→ 아직 발생 안 했지만 우려되면 ETA_RISK

**Q: PARTNER_DELAY vs PARTNER가 원인인 다른 이슈**
→ 파트너 응답 지연 자체가 문제면 PARTNER_DELAY
→ 파트너로 인해 통관/운송이 지연되면 그쪽이 Primary, PARTNER_DELAY는 Secondary

## 알 수 없는 경우

11개 코드 중 어디에도 해당하지 않으면 다음으로 분류한다:

```
Primary Issue Type: UNCLASSIFIED
Reason: [구체적 이유]
Recommendation: 운영팀 매뉴얼 확인 또는 매니저 확인 필요
```

UNCLASSIFIED가 일정 비율(5%) 이상 발생하면 Taxonomy 업데이트 검토.
