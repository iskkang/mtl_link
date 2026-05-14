---
doc_type: guide
domain: operations
last_updated: 2026-05-14
---

# 03_Cases 작성 가이드 (가장 중요)

## 왜 케이스가 가장 중요한가

SOP는 일반론을 제공하지만, **케이스는 실제 상황의 패턴을 가르친다**.
RAG 환경에서 가장 강력한 학습 자료는 **구조화된 실제 케이스**다.

10개 케이스만 잘 누적해도 운영 AI 품질이 SOP만 있을 때보다 2배 이상 높아진다.

## Phase 1 목표

**10개 케이스를 표준 템플릿으로 작성**한다.

## 케이스 ID 규약

```
OPS-CASE-NNNN
```

- 작성 순서대로 0001부터 부여
- 중복 금지

## 케이스 작성 대상 (예시)

다양한 Issue Type을 커버하도록 선정:

| ID | 주제 | Issue Type |
|---|---|---|
| `OPS-CASE-0001` ✅ | Kazakhstan transit permit 만료 | BORDER_ISSUE / DOC_MISSING |
| `OPS-CASE-0002` | China HS 코드 분쟁 | CUSTOMS_DELAY |
| `OPS-CASE-0003` | 위험물 통관 추가 서류 | DOC_MISSING / CUSTOMS_DELAY |
| `OPS-CASE-0004` | 도착지 보관료 분쟁 | COST_DISPUTE |
| `OPS-CASE-0005` | 컨테이너 도착 후 화물 손상 | CARGO_DAMAGE |
| `OPS-CASE-0006` | 파트너 48h 무응답 → 화주 클레임 발전 | PARTNER_DELAY / CUSTOMER_CLAIM |
| `OPS-CASE-0007` | DDP 운송 비용 사후 발생 분쟁 | COST_DISPUTE / CUSTOMER_CLAIM |
| `OPS-CASE-0008` | Russia 세관 페널티 (HS 오류) | CUSTOMS_DELAY (Critical) |
| `OPS-CASE-0009` | BL 미수령 → DO release 지연 | PAYMENT_HOLD |
| `OPS-CASE-0010` | 중고차 수출 서류 누락 | DOC_MISSING |

## 13섹션 표준 구조

`OPS-CASE-0001.md` 참조. 모든 케이스는 반드시 동일 구조:

```
1. Case Summary
2. Route
3. Cargo Information
4. Problem
5. Root Cause (Confirmed / Possible 분리)
6. Missing Information / Documents
7. Actions Taken (테이블)
8. Customer Communication (실제 메시지)
9. Internal Decision
10. Final Result
11. Lesson Learned
12. New SOP Rule
13. Tags
```

## 작성 시 절대 규칙

### 1. 추정과 사실을 분리한다 (Section 5)
Confirmed Cause와 Possible Cause를 반드시 별도 서브섹션으로 분리.

### 2. 실제 메시지를 그대로 넣는다 (Section 8)
"~한 내용의 메시지를 보냄" 같은 요약 금지. **실제 보낸 문장을 그대로** 넣는다 (개인정보는 마스킹).

### 3. Lesson Learned는 구체적이어야 한다 (Section 11)
"앞으로 잘 하자" 같은 추상적 결론 금지. **다음에 같은 상황에서 다르게 할 행동**을 명시.

### 4. New SOP Rule은 실제 SOP에 반영한다 (Section 12)
케이스 작성 후 해당 SOP 파일을 업데이트.
SOP에 반영되지 않은 Lesson은 학습되지 않는다.

### 5. 개인정보 마스킹
- 화주 회사명: "A사", "B사" 또는 "Customer X"
- 파트너명: "Agent A", "Partner B"
- 담당자 실명: 직급만 ("운영팀 매니저", "팀장")
- 구체적 금액: 가능한 범위 ("USD XXX")

### 6. 메타데이터 frontmatter 필수
```yaml
case_id: OPS-CASE-NNNN
status: resolved | open | in_progress | escalated
issue_type: [Primary]
secondary_issue_type: [Secondary or empty]
region: [지역]
mode: [운송수단]
cargo_type: [화물종류]
risk_level: [등급]
route: "출발-경유-도착"
```

## 작성 절차

1. 케이스 발생 → 운영 진행 중 메모 누적
2. 케이스 종료 후 7일 내 작성
3. 운영팀 매니저 검토
4. `03_Cases/` 폴더에 commit
5. 관련 SOP 업데이트 검토 (Section 12 기반)

## Phase 2 RAG 활용

케이스는 RAG에서 **가장 자주 retrieve되는 자료**가 된다.
운영 AI는 새 케이스 처리 시 유사 case_id를 검색해서 참조하게 된다.

따라서 다음 메타데이터가 검색 품질을 좌우한다:
- `issue_type` (가장 중요)
- `region` + `mode`
- `cargo_type`
- `risk_level`

## 케이스 품질 점검

월 1회 누적된 케이스에 대해:
- 표준 13섹션 준수 여부
- Confirmed/Possible 분리 여부
- New SOP Rule이 실제 SOP에 반영되었는지
- 미반영 시 운영팀 매니저 재할당
