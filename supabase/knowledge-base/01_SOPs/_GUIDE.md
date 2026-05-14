---
doc_type: guide
domain: operations
last_updated: 2026-05-14
owner: operations_team
---

# 01_SOPs 작성 가이드

## Phase 1 작성 대상 SOP (6개)

| 파일명 | Issue Type | 우선순위 |
|---|---|---|
| `customs_issue_sop.md` ✅ | CUSTOMS_DELAY, BORDER_ISSUE | 완료 (참고용) |
| `delay_handling_sop.md` | TRANSIT_DELAY, ETA_RISK | High |
| `document_check_sop.md` | DOC_MISSING, DOC_MISMATCH | High |
| `partner_followup_sop.md` | PARTNER_DELAY | Medium |
| `cost_dispute_sop.md` | COST_DISPUTE | High |
| `damage_loss_sop.md` | CARGO_DAMAGE | Critical |
| `customer_claim_sop.md` | CUSTOMER_CLAIM | High |
| `payment_hold_sop.md` | PAYMENT_HOLD | Medium |

## 작성 원칙

1. **모든 SOP는 동일한 섹션 구조** 사용 (`customs_issue_sop.md` 참조)
2. **체크리스트 형식**으로 작성 (`- [ ]` 사용)
3. **시간 기준 명시** (15분 내, 1시간 내, 4시간 내 등)
4. **금지 사항 섹션 필수**
5. **관련 문서 링크 섹션 필수**
6. **메타데이터 frontmatter 필수**

## 표준 섹션 구조

```markdown
---
[frontmatter]
---

# [SOP 이름]

## 적용 범위
## 트리거
## 표준 절차
### Step 1: ...
### Step 2: ...
...
## 금지 사항
## 지역별 특이사항 (해당 시)
## 관련 문서
```

## 작성 시 주의

- 일반론 금지 ("적절히 대응", "신속하게" 같은 모호한 표현)
- 반드시 측정 가능한 기준 사용 ("4시간 내", "서면으로", "BL 번호 포함")
- 운영 직원이 그대로 따라할 수 있는 수준의 구체성
