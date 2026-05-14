---
doc_type: guide
domain: operations
last_updated: 2026-05-14
---

# 04_Templates 작성 가이드

## Phase 1 작성 대상 (5개)

| 파일명 | 용도 | 우선순위 |
|---|---|---|
| `customer_delay_notice.md` ✅ | 지연 안내 (화주) | 완료 |
| `document_request_email.md` | 서류 요청 (화주/파트너) | High |
| `partner_followup_message.md` | 파트너 follow-up | High |
| `urgent_escalation_message.md` | 긴급 에스컬레이션 (내부) | High |
| `internal_report_template.md` | 내부 보고서 | Medium |
| `customs_hold_notice.md` | 통관 보류 안내 | High |
| `cost_notice_to_customer.md` | 추가 비용 사전 고지 | High |

## 작성 원칙

1. **한국어 + 영어 동시 제공** (기본)
2. **상황별 단계 분리** (1차/2차/최종 등)
3. **금지 표현 섹션 필수**
4. **약속/단정 표현 절대 금지**
5. **변수 부분 `[...]`로 명시**

## 표준 구조

```markdown
---
[frontmatter]
---

# [템플릿 이름]

## 적용
## 사용 원칙

---

## 1차 통보 (또는 단계)

### 한국어
[한국어 본문]

### English
[영문 본문]

---

## [다른 단계들]

---

## 금지 표현
## 톤 가이드
## 관련 문서
```
