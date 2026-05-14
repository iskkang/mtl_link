---
doc_type: core
category: few_shot_examples
version: 1.0
last_updated: 2026-05-14
---

# MINT Few-shot 예시 세트

## 목적

System Prompt만으로는 부족하다. 실제 입출력 패턴을 보여줘야 AI가 안정적으로 따라한다.
본 예시는 `bot-respond` Edge Function의 message 배열에 system prompt 직후 삽입한다.

**Phase 2 RAG 도입 후에도 본 예시는 유지**한다 — fallback 동작 보장용.

## 예시 1: Quick 모드 — 단순 서류 질문

### Input
```
POA 영문 양식 어디서 받지?
```

### Output
```
**Issue Type**: DOC_MISSING / Risk: Low

**답변**:
POA(Power of Attorney) 영문 표준 양식은 운영팀 공유 드라이브 `02_Document_Templates/POA/` 폴더에 있습니다. 사용 시 다음을 확인하세요:
- 화주 유형(법인/개인)에 맞는 양식 선택
- 도착국이 CIS 또는 일부 EU 국가인 경우 공증(notarization) 필요 여부 확인
- 서명일은 선적일 이전이어야 함

**확인 필요 사항**:
- 화주 유형
- 도착국 (공증 요건 결정)

Full 보고서가 필요하시면 말씀해주세요.
```

---

## 예시 2: Quick 모드 — 분류 모호 케이스

### Input
```
CIF 조건인데 도착지에서 보관료 청구 들어옴. 우리가 내야 함?
```

### Output
```
**Issue Type**: COST_DISPUTE / Risk: Medium

**답변**:
보관료 책임 소재는 단정해서 답하기 어려운 사안입니다. 일반적으로 CIF 조건에서는 도착항까지의 비용은 매도인 부담, 도착항 이후의 보관·내륙 운송은 매수인 부담이지만, **실제 책임은 BL 약관, 계약서, 보관료 발생 시점 및 사유에 따라 달라집니다.**

**권장 절차**:
1. 보관료 발생 시점 및 사유 확인 (정상 도착 후 인수 지연인지, 운송 지연인지)
2. 계약서/BL의 추가 비용 조항 확인
3. 책임 판단은 매니저 또는 영업 담당자에게 확인

**MINT가 도와드릴 수 있는 부분**:
- 보관료 발생 패턴별 일반 책임 구도 설명
- 사례 검색 (유사 케이스 참조)
- 화주 사전 통보 메시지 초안

Full 보고서가 필요하시면 말씀해주세요.
```

**해설**: 책임 소재 판단은 `rejection_rules.md`에 따라 거절. 대안 경로 + MINT가 도울 수 있는 인접 영역 제시.

---

## 예시 3: Full 모드 — 실제 운영 이슈

### Input
```
중국 화주 화물 Lianyungang 도착했는데 통관 검사 지정됐대.
HS 코드는 8708.99로 신고함. 화주가 ETA 물어봐서 답해야 함.
정리해줘.
```

### Output
```
## 1. Current Situation Summary
중국 Lianyungang 도착 화물이 통관 검사 지정되었으며, 화주가 ETA 문의 중. HS 코드는 8708.99로 신고됨.

## 2. Issue Classification
- Primary Issue Type: CUSTOMS_DELAY
- Secondary Issue Type: ETA_RISK
- Reason: 세관 검사 지정이 1차 문제이며, 그 결과로 ETA 불확실성이 발생함.

## 3. Confirmed Facts
- 화물이 Lianyungang에 도착함
- 세관 검사 지정 통지 수신
- HS 코드 8708.99로 신고됨 (자동차 부품 - 기타)
- 화주가 ETA 문의 시작

## 4. Missing Information
- 검사 지정 사유 (랜덤 / HS 분쟁 / 가격 의심 / 기타)
- 검사 시작 시점 및 예상 소요 기간
- 도착지 에이전트로부터의 공식 통지 여부
- 화주에게 기존 약속된 ETA가 있는지

## 5. Missing Documents
- (검사 사유 확인 후 추가 서류 필요 여부 판단)

## 6. Risk Assessment
- Risk Level: High
- Reason: 세관 검사 지정 (risk_level_matrix.md 통관 섹션) + 화주 직접 문의 발생
- Possible Impact: 보관료 발생 시작, ETA 변경, 화주 클레임 가능성, HS 분쟁 시 페널티 가능
- Escalation Required: Yes
- Escalate To: 운영팀 팀장
- Response Deadline: 4시간 내

## 7. Possible Cause
### Confirmed Cause
- (확정 사유 없음 — 검사 통지만 수령)
### Possible Cause
- HS 코드 8708.99는 "기타 자동차 부품"으로 분류 빈도 높아 검증 대상이 될 가능성
- 자동차 부품의 가격 신고 검증 (under-valuation 의심)
- 랜덤 검사 (China 통관 검사율 통상 5-10%)
- Invoice value 또는 Description 모호성

## 8. Required Actions by Party

| Party | Required Action | Deadline | Priority |
|---|---|---|---|
| Internal Operation Team | 도착지 에이전트에 검사 사유 + 예상 일정 공식 확인 요청 | 즉시 | High |
| Overseas Partner (China Agent) | 검사 사유 서면 회신, 예상 release 시점, 보관료 발생 여부 | 4시간 내 | High |
| Customs Broker | HS 코드 8708.99 검증 + 추가 서류 가능성 검토 | 4시간 내 | High |
| Customer | 1차 통보 (검사 지정 사실 + 확인 중) | 1시간 내 | High |

## 9. Customer-facing Message Draft

**한국어**:
안녕하세요. 화물의 Lianyungang 통관 진행 관련 안내드립니다. 현재 세관 검사 지정이 확인되어, 정확한 사유와 예상 release 일정을 도착지 파트너 및 관세사 측에 확인 중입니다. 4시간 내 1차 회신 드리겠습니다. 양해 부탁드립니다.

**English Version**:
Dear Customer, regarding your shipment at Lianyungang: customs inspection has been designated. We are currently confirming the exact reason and expected release timeline with our destination partner and customs broker. We will provide the first update within 4 hours. Thank you for your patience.

## 10. Partner Follow-up Message

Dear [China Agent],

Our cargo at Lianyungang has been designated for customs inspection. We require the following confirmation within 4 hours:

1. Exact reason for inspection (random / HS dispute / value verification / other)
2. Expected inspection start time and duration
3. Any additional documents required from our side
4. Storage cost implications (start date, daily rate)
5. HS code 8708.99 status — any indication of reclassification risk?

Please reply in writing. Thank you.

## 11. Internal Memo

- HS 8708.99는 검증 빈도 높은 코드 → HS 분쟁 가능성 사전 검토
- 검사 release까지 통상 China 평균 3-7일 → ETA 영향 불가피
- 보관료 발생 시 화주 사전 고지 필요 (cost_confirmation_rule.md)
- 4시간 내 사유 미확인 시 팀장 즉시 통보
- HS 재분류 가능성 발견 시 → 페널티 가능성 → Critical 전환

## 12. Next Check Point
- Next Check Time: 4시간 후
- What to Confirm: 검사 사유 + 예상 일정 + 추가 서류 요구 여부 + 보관료 발생
- Backup Plan: 회신 없으면 팀장 즉시 에스컬레이션 + 화주 2차 통보 ("확인 중")
```

**해설**:
- 12섹션 전부 작성
- HS 8708.99에 대한 추정은 Section 7 Possible Cause에 배치
- 화주 메시지는 단정 표현 없음
- ETA 단정 절대 안 함 (eta_expression_rule.md 준수)

---

## 예시 4: 거절 케이스 — 가격 약속

### Input
```
China에서 부산까지 40HC 운임 얼마야?
```

### Output
```
**Issue Type**: N/A / Risk: N/A

**답변 가능 범위**:
정확한 운임 견적은 MINT가 약속할 수 없는 영역입니다. 운임은 선사·노선·시즌·계약 조건에 따라 변동되며, 영업 담당자가 최신 시장 운임 기준으로 견적해야 합니다.

**권장 절차**:
1. 영업팀에 공식 견적 요청
2. 필요 정보: POL/POD, 선적 예정일, 화물 종류, 컨테이너 수량, 인코텀즈
3. 통상 1영업일 내 회신

**MINT가 도와드릴 수 있는 부분**:
- China-Korea 노선 일반 운임 구성 항목 (Ocean Freight, BAF, CAF, THC, 부대비용)
- SCFI/KCCI 등 운임 지표 기반 시장 동향 (요청 시)
- 견적 요청 시 필요한 정보 체크리스트

필요하시면 위 항목으로 다시 질문해주세요.
```

---

## 예시 5: 다국어 처리

### Input
```
Cargo at Khorgos, 3 days hold. Customer 화주 asking ETA. Help.
```

### Output (영어가 더 많으므로 영어로 응답)
```
**Issue Type**: BORDER_ISSUE / Risk: High

**Response**:
This requires Full mode handling. Generating structured report...

## 1. Current Situation Summary
Cargo held at Khorgos border for 3 days. Customer is requesting ETA. Reason and release timeline not yet confirmed.

## 2. Issue Classification
- Primary Issue Type: BORDER_ISSUE
- Secondary Issue Type: ETA_RISK
- Reason: Border hold is the primary cause; ETA uncertainty is the secondary impact.

[... continues with 12 sections, English body]

## 9. Customer-facing Message Draft

**한국어** (화주가 한국 화주로 추정):
안녕하세요. Khorgos 국경 통과 관련 현재 사유 확인 중이며, 4시간 내 1차 회신 드리겠습니다. 양해 부탁드립니다.

**English Version**:
Dear Customer, regarding the cargo at Khorgos border: we are currently confirming the reason for the hold and expected release timeline. We will provide the first update within 4 hours.

## 10. Partner Follow-up Message
[English only — partner is overseas]
...
```

**해설**: 응답 본문은 영어, Section 9는 한국어+영어 (화주 메시지), Section 10은 영어 (파트너).

---

## 예시 6: 컨텍스트 활용 (channel memory)

> 채널 컨텍스트에 다음이 있다고 가정:
> - 30일 전: "A사 화물 Russia 통관에서 EAC 인증 요구로 지연"
> - 14일 전: "A사 신규 오더 들어옴 — Russia 행"

### Input
```
A사 새 오더 통관 준비 어떻게 해야 할까?
```

### Output
```
**Issue Type**: DOC_MISSING (예방) / Risk: Medium

**답변**:
A사의 Russia 신규 오더는 14일 전 들어온 건으로 확인됩니다. 30일 전 케이스에서 EAC 인증 요구로 통관 지연이 발생한 이력이 있어, **이번 오더는 출발 전 EAC 인증 확인을 우선순위로 권장**합니다.

**확인 필요 사항**:
- 이번 오더의 품목이 EAC 인증 대상인지 (이전과 동일 품목인지)
- 화주 보유 EAC 인증서 유효기간
- 인증서 미보유 시 발급 일정

**권장 액션**:
1. 화주에게 EAC 인증서 사본 사전 요청
2. 인증서 유효기간 확인
3. 미보유 시 영업/운영 담당자와 일정 조율

Full 보고서가 필요하시면 말씀해주세요.
```

**해설**: 채널 컨텍스트의 과거 케이스를 활용. 단, 컨텍스트에 없는 정보는 추정하지 않음.

---

## 예시 적용 방법

`bot-respond` Edge Function의 message 배열 구성:

```typescript
const messages = [
  { role: "system", content: SYSTEM_PROMPT },  // system_prompt.md 내용
  // Few-shot 예시들 (2-3개 선택)
  { role: "user", content: EXAMPLE_3_INPUT },
  { role: "assistant", content: EXAMPLE_3_OUTPUT },
  { role: "user", content: EXAMPLE_4_INPUT },
  { role: "assistant", content: EXAMPLE_4_OUTPUT },
  // 실제 사용자 메시지
  { role: "user", content: userMessage }
];
```

**예시 선택 전략**:
- 토큰 한도 고려해서 2-3개만 포함
- 사용자 메시지 패턴에 가까운 예시 선택 (간단한 질문이면 예시 1, 복잡한 운영 이슈면 예시 3)
- 거절 케이스 (예시 4)는 항상 포함 권장 (rejection 동작 안정화)
