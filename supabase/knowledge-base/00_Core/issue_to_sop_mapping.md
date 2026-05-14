---
doc_type: core
category: routing
version: 1.0
last_updated: 2026-05-14
---

# Issue Type → 참조 문서 라우팅

## 목적

MINT가 Issue Type을 분류한 뒤, **어떤 SOP·체크리스트·규칙·템플릿을 참조해야 하는지** 자동 결정하기 위한 라우팅 테이블.

Phase 2(RAG)에서는 이 매핑이 **metadata filter의 1차 기준**이 된다.

## 라우팅 테이블

| Issue Type | SOP | Checklist | Rule | Template |
|---|---|---|---|---|
| `DOC_MISSING` | `document_check_sop.md` | `master_document_checklist.md` | `no_assumption_rule.md` | `document_request_email.md` |
| `DOC_MISMATCH` | `document_check_sop.md` | `invoice_checklist.md`, `packing_list_checklist.md` | `customs_risk_rule.md` | `document_correction_request.md` |
| `CUSTOMS_DELAY` | `customs_issue_sop.md` | `cis_customs_checklist.md` | `customs_risk_rule.md` | `customs_hold_notice.md` |
| `TRANSIT_DELAY` | `delay_handling_sop.md` | `master_document_checklist.md` | `eta_expression_rule.md` | `customer_delay_notice.md` |
| `PARTNER_DELAY` | `partner_followup_sop.md` | `master_document_checklist.md` | `escalation_rule.md` | `partner_followup_message.md` |
| `COST_DISPUTE` | `cost_dispute_sop.md` | `invoice_checklist.md` | `cost_confirmation_rule.md` | `cost_notice_to_customer.md` |
| `ETA_RISK` | `delay_handling_sop.md` | `master_document_checklist.md` | `eta_expression_rule.md` | `customer_delay_notice.md` |
| `CARGO_DAMAGE` | `damage_loss_sop.md` | `bl_checklist.md`, `packing_list_checklist.md` | `responsibility_rule.md` | `urgent_escalation_message.md` |
| `CUSTOMER_CLAIM` | `customer_claim_sop.md` | `master_document_checklist.md` | `escalation_rule.md` | `internal_report_template.md` |
| `BORDER_ISSUE` | `customs_issue_sop.md` | `cis_customs_checklist.md` | `customs_risk_rule.md` | `customer_delay_notice.md` |
| `PAYMENT_HOLD` | `payment_hold_sop.md` | `invoice_checklist.md` | `responsibility_rule.md` | `internal_report_template.md` |

## Phase 2 RAG 통합 시 활용

```typescript
// bot-respond Edge Function 예시
async function retrieveContext(issueType: IssueType, userMessage: string) {
  const mapping = ISSUE_TO_SOP_MAP[issueType];

  // 1차: metadata filter로 후보 축소
  const candidates = await supabase
    .from('knowledge_base')
    .select('*')
    .or(`filename.in.(${mapping.allDocs.join(',')})`);

  // 2차: vector similarity로 top-K 선택
  const embedding = await embed(userMessage);
  const topK = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: 5,
    filter_ids: candidates.map(c => c.id)
  });

  return topK;
}
```

## 다중 Issue Type 처리

Primary + Secondary가 있는 경우, **양쪽 모두에서 문서를 retrieve**한다.
중복 문서는 1번만 포함, 우선순위는 Primary > Secondary.

## 신규 Issue Type 추가 시

1. `issue_type_taxonomy.md`에 코드 추가
2. 본 매핑 테이블에 행 추가
3. 필요한 SOP/Checklist/Rule/Template가 없으면 작성
4. 버전 올리고 last_updated 갱신
