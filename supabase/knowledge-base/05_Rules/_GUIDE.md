---
doc_type: guide
domain: operations
last_updated: 2026-05-14
---

# 05_Rules 작성 가이드

## Phase 1 작성 대상 (5개)

| 파일명 | 적용 영역 | 우선순위 |
|---|---|---|
| `eta_expression_rule.md` ✅ | ETA 표현 (가장 중요) | 완료 |
| `customs_risk_rule.md` | 통관 리스크 표현 | High |
| `cost_confirmation_rule.md` | 비용 확인 / 사전 고지 | High |
| `responsibility_rule.md` | 책임 소재 표현 | High |
| `escalation_rule.md` | 에스컬레이션 트리거 | High |
| `no_assumption_rule.md` | 추정 금지 일반 규칙 | Medium |

## 작성 원칙

Rule은 운영 AI와 직원 모두가 따르는 **표현·판단 규칙**이다.
SOP가 "어떻게 처리할 것인가"라면 Rule은 "어떻게 표현/판단할 것인가"이다.

1. **금지 표현과 권장 표현을 표로 명시**
2. **예외 케이스 명시** (있는 경우)
3. **운영 AI 적용 섹션 필수** (AI가 어떻게 따를지)
4. 메타데이터 frontmatter 필수
