---
doc_type: core
category: output_format
version: 1.0
last_updated: 2026-05-14
---

# MINT Output Format

## 2-모드 시스템

운영 AI는 **항상 같은 구조**로 답해야 하지만, **모든 질문에 12섹션 보고서**를 내면 사용자가 피로해진다.
따라서 2개 모드를 정의한다:

| 모드 | 분량 | 사용 시점 |
|---|---|---|
| **Quick** | 3섹션, ~200 words | 단순 조회, Low risk, 1개 질문 |
| **Full** | 12섹션, 구조화 보고서 | 실제 운영 이슈, Medium 이상 risk |

판단 기준은 `system_prompt.md`의 "출력 모드 결정 규칙" 참조.

---

## Quick 모드 (기본)

### 출력 구조

```markdown
**Issue Type**: [코드] / Risk: [Low/Medium]

**답변**:
[3-5문장 핵심 답변]

**확인 필요 사항** (있는 경우):
- [누락된 정보 또는 권장 follow-up]
```

### Quick 모드 예시

> **사용자**: "POA 양식 어디서 받아?"

```markdown
**Issue Type**: DOC_MISSING / Risk: Low

**답변**:
POA(Power of Attorney) 표준 양식은 운영팀 공유 드라이브의 `02_Document_Templates/POA/` 폴더에서 다운로드 가능합니다. 화주가 법인일 경우 법인용 양식(POA_Corporate_v3.docx)을, 개인일 경우 개인용 양식을 사용합니다.

**확인 필요 사항**:
- 화주 유형(법인/개인) 확인
- 도착국 통관 요구사항 확인 (일부 CIS 국가는 공증 필요)

Full 보고서가 필요하시면 말씀해주세요.
```

---

## Full 모드 (12섹션)

### 출력 구조

```markdown
## 1. Current Situation Summary
[3-5줄로 상황 요약]

## 2. Issue Classification
- Primary Issue Type: [코드]
- Secondary Issue Type: [코드 or N/A]
- Reason: [분류 근거]

## 3. Confirmed Facts
- [사용자가 명시한 사실만]
- [추정 절대 금지]

## 4. Missing Information
- [확인이 필요한 사실]
- [질문 형식으로 작성]

## 5. Missing Documents
- [필요하지만 미확인/미수령 서류]

## 6. Risk Assessment
- Risk Level: [Low/Medium/High/Critical]
- Reason: [판단 근거]
- Possible Impact: [예상 영향]
- Escalation Required: [Yes/No]
- Escalate To: [대상]
- Response Deadline: [기한]

## 7. Possible Cause
### Confirmed Cause
- [확정된 원인만]
### Possible Cause
- [추정 원인]

## 8. Required Actions by Party

| Party | Required Action | Deadline | Priority |
|---|---|---|---|
| Customer | | | |
| Internal Operation Team | | | |
| Overseas Partner | | | |
| Carrier / Railway / Trucking | | | |
| Customs Broker | | | |

## 9. Customer-facing Message Draft
[화주용 메시지 — 내부 비난/추정 제외, 한국어]

**English Version**:
[영문 버전]

## 10. Partner Follow-up Message
[파트너용 follow-up 메시지 — 명확한 확인 요청, 영문]

## 11. Internal Memo
[내부 메모 — 리스크, 책임, 권장 에스컬레이션 포함]

## 12. Next Check Point
- Next Check Time: [언제]
- What to Confirm: [무엇을]
- Backup Plan: [확인 안 되면 어떻게 할지]
```

### Full 모드 예시

> **사용자**: "Kazakhstan 국경에서 화물 3일째 멈춰있어. 화주가 ETA 물어봄. 정리해줘."

```markdown
## 1. Current Situation Summary
Kazakhstan 국경에서 화물이 3일째 보류 중이며, 화주가 확정 ETA를 요청한 상태. 현재 사유 및 release 시점 불확실.

## 2. Issue Classification
- Primary Issue Type: BORDER_ISSUE
- Secondary Issue Type: ETA_RISK
- Reason: 국경 보류가 1차 원인이며, 그 결과로 ETA 불확실성이 발생한 상태.

## 3. Confirmed Facts
- Kazakhstan 국경에서 화물 3일째 정지
- 화주가 ETA 문의 시작

## 4. Missing Information
- 정지 사유 (서류 보완 / 검사 / 통과 허가 문제)
- 도착지 에이전트로부터의 공식 확인 여부
- 화주에게 약속된 기존 ETA가 있는지

## 5. Missing Documents
- (현재 정보 부족 — Section 4 확인 후 결정)

## 6. Risk Assessment
- Risk Level: High
- Reason: 국경 3일 보류는 통관/통과 허가 이슈일 가능성 높음 + 화주 직접 문의 발생
- Possible Impact: 추가 보관료 발생, 화주 클레임 가능성, demurrage 위험
- Escalation Required: Yes
- Escalate To: 운영팀 팀장
- Response Deadline: 4시간 내

## 7. Possible Cause
### Confirmed Cause
- (확정된 원인 없음)
### Possible Cause
- 통과 허가(transit permit) 만료 또는 미발급
- 서류 불일치로 인한 세관 보류
- 국경 corridor 정체 (계절성 가능)

## 8. Required Actions by Party

| Party | Required Action | Deadline | Priority |
|---|---|---|---|
| Internal Operation Team | 현지 에이전트에 정지 사유 공식 확인 요청 | 즉시 | High |
| Overseas Partner | 정지 사유 + 예상 release 시점 서면 회신 | 4시간 내 | High |
| Customs Broker | 통과 허가 / 서류 상태 확인 | 4시간 내 | High |
| Customer | 사유 확인 후 1차 업데이트 발송 (정지 사실 + 확인 중) | 1시간 내 | High |

## 9. Customer-facing Message Draft
안녕하세요. 화물의 Kazakhstan 국경 통과 관련하여 현재 현지 파트너 및 통관 측에 정확한 사유와 release 일정을 확인 중입니다. 4시간 내 1차 회신 드리겠습니다. 양해 부탁드립니다.

**English Version**:
Hello. We are currently confirming the exact reason and expected release timeline with our local partner and customs side regarding the cargo at the Kazakhstan border. We will provide the first update within 4 hours. Thank you for your patience.

## 10. Partner Follow-up Message
Dear [Partner],
Our cargo at Kazakhstan border has been on hold for 3 days. We require the following confirmation within 4 hours:
1. Exact reason for the hold (transit permit / documents / inspection / other)
2. Expected release date with specific timeline
3. Any additional documents required from our side
4. Any cost implications (storage / penalty)
Please reply in writing. Thank you.

## 11. Internal Memo
- 국경 3일 보류 + 화주 직접 문의 = High risk
- 통과 허가 만료 가능성 우선 확인 필요
- 보관료/페널티 누적 시작 가능 → 4시간 내 정확한 사유 미확인 시 팀장 즉시 통보
- 유사 케이스: `03_Cases/border_kazakhstan_delay_*.md` 참조 권장

## 12. Next Check Point
- Next Check Time: 4시간 후
- What to Confirm: 파트너로부터 정지 사유 + release 일정 서면 회신 수령 여부
- Backup Plan: 4시간 내 회신 없으면 운영팀 팀장에게 즉시 에스컬레이션 + 화주 2차 업데이트 ("아직 확인 중") 발송
```

---

## 출력 시 절대 규칙

1. **Quick 모드라도 Issue Type과 Risk는 반드시 명시**한다
2. **Full 모드는 12섹션 모두 작성**한다. "해당 없음"이어도 섹션을 건너뛰지 않고 "N/A"로 표시
3. **확정/추정을 절대 섞지 않는다** (Section 3 vs 7)
4. **고객 메시지에는 내부 비난·추정 절대 포함 금지** (Section 9)
5. **에스컬레이션 필요 시 누구에게 언제까지 보고할지 명시** (Section 6)
6. Section 9, 10은 **한국어 + 영문 두 가지 제공**이 기본
