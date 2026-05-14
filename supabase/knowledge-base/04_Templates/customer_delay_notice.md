---
doc_type: template
domain: operations
issue_type: TRANSIT_DELAY
region: global
last_updated: 2026-05-14
owner: operations_team
---

# Customer Delay Notice Template

## 적용

TRANSIT_DELAY, ETA_RISK, BORDER_ISSUE 발생 시 화주 통보용.

## 사용 원칙

1. **확인된 사실만 전달**한다 (`hallucination_guard.md`)
2. **다음 업데이트 시점을 명시**한다
3. **약속한 시점에 반드시 업데이트** (정보 부족이어도 "확인 중" 발송)
4. 사유가 확인 안 됐으면 사유를 추측하지 않는다

---

## 1차 통보 (사유 확인 전)

### 한국어

> 안녕하세요. [BL No. XXX] 화물 관련 안내드립니다.
>
> 현재 [위치 — 예: Khorgos 국경, Lianyungang 환적] 구간에서 진행 지연이 발생하여, 도착지 파트너 및 관련 기관 측에 정확한 사유와 예상 일정을 확인 중입니다.
>
> [N]시간 내 1차 회신 드리겠습니다. 양해 부탁드립니다.
>
> 감사합니다.
> [담당자명] / MTL Shipping Agency

### English

> Dear [Customer],
>
> This is regarding your shipment [BL No. XXX].
>
> We have identified a delay at [Location], and are currently confirming the exact reason and expected timeline with our destination partner and the relevant authorities.
>
> We will provide the first update within [N] hours. We appreciate your patience.
>
> Best regards,
> [Name] / MTL Shipping Agency

---

## 2차 통보 (사유 확인 후 + 액션 진행 중)

### 한국어

> 안녕하세요. [BL No. XXX] 화물 관련 업데이트 드립니다.
>
> 확인 결과:
> - 지연 사유: [확인된 사유 — 예: 통관 추가 서류 요청]
> - 현재 조치: [진행 중인 액션 — 예: 보충 서류 즉시 전달 중]
> - 예상 release 시점: [확인된 범위 내 표현 — 예: "현재 정보 기준 X일 예상이며, 변경 가능성이 있습니다"]
>
> [필요 시 화주 측 요청 사항 명시]
>
> 다음 업데이트는 [구체적 시점]에 드리겠습니다.
>
> 감사합니다.
> [담당자명] / MTL Shipping Agency

### English

> Dear [Customer],
>
> Update on your shipment [BL No. XXX]:
>
> - Reason: [confirmed reason]
> - Current Action: [action in progress]
> - Expected Release: [conservative timeline with disclaimer — e.g., "Based on current information, X days, subject to change"]
>
> [If applicable: requested action from customer]
>
> Next update at [specific time].
>
> Best regards,
> [Name] / MTL Shipping Agency

---

## 최종 통보 (Release 후)

### 한국어

> 안녕하세요. [BL No. XXX] 화물이 정상 release되어 [다음 구간 — 예: Almaty 방향]으로 운송 재개되었음을 안내드립니다.
>
> - 예상 도착일: [날짜]
> - [필요 시: 발생 비용 사전 안내]
>
> 도착 시 정상 인수 가능하도록 [도착지 담당자 / 창고 / 운송] 준비 부탁드립니다.
>
> 감사합니다.
> [담당자명] / MTL Shipping Agency

### English

> Dear [Customer],
>
> Your shipment [BL No. XXX] has been released and is now in transit to [next leg — e.g., Almaty].
>
> - Expected Arrival: [Date]
> - [If applicable: pre-notice of incurred costs]
>
> Please ensure [destination contact / warehouse / transportation] is ready for receipt.
>
> Best regards,
> [Name] / MTL Shipping Agency

---

## 금지 표현

| 금지 | 대체 |
|---|---|
| "곧 풀립니다" | "현재 정보 기준 X일 예상이며 변경 가능성이 있습니다" |
| "걱정 마세요" | "다음 절차로 대응하고 있습니다" |
| "통관 문제 같습니다" | "사유 확인 중이며 X시간 내 회신드리겠습니다" |
| "추가 비용은 없습니다" | "발생 비용은 확인되는 대로 사전 안내드리겠습니다" |
| "내일 도착합니다" | "현재 ETA는 X이며, 운송 상황에 따라 변경될 수 있습니다" |

## 톤 가이드

- 사실 전달 중심, 감정 표현 자제
- 약속/보장 표현 금지
- 약속한 update 시점은 반드시 지킴 (정보 없어도 "확인 중" 발송)
- 화주가 추가 질문할 수 있도록 담당자 연락처 포함

## 관련 문서

- `00_Core/hallucination_guard.md`
- `00_Core/output_format.md` (Section 9)
- `05_Rules/eta_expression_rule.md`
- `01_SOPs/delay_handling_sop.md`
