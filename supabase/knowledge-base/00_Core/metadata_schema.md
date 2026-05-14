---
doc_type: core
category: metadata_schema
version: 1.0
last_updated: 2026-05-14
---

# 문서 메타데이터 스키마

## 목적

모든 학습 문서는 YAML frontmatter로 메타데이터를 가진다.
Phase 2 RAG 단계에서 **metadata filtering의 1차 기준**으로 사용된다.

이 스키마는 절대 임의로 변경하지 않는다. 변경 시 마이그레이션 + 임베딩 재생성 필요.

## 필수 필드

```yaml
---
doc_type: [sop | checklist | case | template | rule | core]
domain: [operations | sales | finance | customs | hr]
last_updated: YYYY-MM-DD
---
```

## 선택 필드 (해당 시 필수)

```yaml
issue_type: [DOC_MISSING | DOC_MISMATCH | CUSTOMS_DELAY | ...]
region: [KR | CN | CIS | EU | global]
mode: [sea | rail | truck | air | sea-rail | multimodal]
risk_level: [low | medium | high | critical]
cargo_type: [general | dg | reefer | auto_parts | used_car | machinery | ...]
owner: [operations_team | sales_team | customs_team | management]
```

## 케이스 전용 필드

```yaml
case_id: OPS-CASE-NNNN
status: [open | in_progress | resolved | escalated]
secondary_issue_type: [code or empty]
route: "Korea-China-Kazakhstan"
```

## 필드 정의

### `doc_type` (필수)

| 값 | 설명 |
|---|---|
| `sop` | Standard Operating Procedure — "어떻게 처리하는가" |
| `checklist` | 서류·항목 체크리스트 |
| `case` | 실제 운영 사례 로그 |
| `template` | 메시지·이메일 템플릿 |
| `rule` | 운영 규칙 (ETA 표현법, 비용 확인 등) |
| `core` | MINT 동작 규칙 자체 (00_Core/ 내부 문서) |

### `domain` (필수)

현재는 `operations`가 99%. 추후 확장 시 다른 값 사용.

### `issue_type` (조건부 필수)

`doc_type`이 `sop`, `case`, `template`인 경우 **필수**.
`checklist`, `rule`은 여러 issue_type에 적용되므로 선택.

값은 `issue_type_taxonomy.md`의 11개 코드 중 하나.

### `region` (선택, 권장)

지역 특이 정보가 있으면 명시:
- `KR`: 한국 (출발지)
- `CN`: 중국
- `CIS`: 독립국가연합 (러시아/카자흐스탄/우즈베키스탄 등)
- `EU`: 유럽 (폴란드 포함)
- `global`: 지역 무관

### `mode` (선택, 권장)

운송 수단:
- `sea`: 해상
- `rail`: 철도 (TCR/TSR)
- `truck`: 도로
- `air`: 항공
- `sea-rail`: 복합
- `multimodal`: 다중

### `risk_level` (선택)

문서 자체의 평균 risk level. RAG 검색 시 high-risk 케이스만 검색하는 등 활용.

### `cargo_type` (선택)

화물 종류별 검색용:
- `general`: 일반화물
- `dg`: 위험물
- `reefer`: 냉동/냉장
- `auto_parts`: 자동차 부품
- `used_car`: 중고차
- `machinery`: 기계
- 기타 필요 시 추가

## 케이스 ID 규약

```
OPS-CASE-NNNN
```

- `OPS`: Operations
- `CASE`: 케이스 로그
- `NNNN`: 4자리 순번 (0001~9999)

순번은 작성 순서대로 증가. 중복 금지.

## 적용 예시

### SOP 문서

```yaml
---
doc_type: sop
domain: operations
issue_type: CUSTOMS_DELAY
region: CIS
mode: rail
risk_level: high
last_updated: 2026-05-14
owner: operations_team
---

# CIS Rail Customs Delay SOP
...
```

### 케이스 로그

```yaml
---
doc_type: case
case_id: OPS-CASE-0001
domain: operations
issue_type: CUSTOMS_DELAY
secondary_issue_type: DOC_MISSING
region: CN
mode: sea-rail
cargo_type: auto_parts
risk_level: high
status: resolved
route: "Korea-China-Kazakhstan"
last_updated: 2026-05-14
owner: operations_team
---

# Case OPS-CASE-0001 — China Transit Document Delay
...
```

### 메시지 템플릿

```yaml
---
doc_type: template
domain: operations
issue_type: TRANSIT_DELAY
region: global
last_updated: 2026-05-14
owner: operations_team
---

# Customer Delay Notice Template
...
```

## Supabase 테이블 스키마 (Phase 2 참고)

```sql
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536),  -- OpenAI text-embedding-3-small
  -- metadata fields (mirrored from frontmatter)
  doc_type TEXT NOT NULL,
  domain TEXT NOT NULL,
  issue_type TEXT,
  region TEXT,
  mode TEXT,
  risk_level TEXT,
  cargo_type TEXT,
  last_updated DATE,
  -- system fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON knowledge_base USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON knowledge_base (doc_type, issue_type);
CREATE INDEX ON knowledge_base (region, mode);
```

## 메타데이터 누락 시

문서에 frontmatter가 없거나 필수 필드가 빠지면:
- Phase 1: 운영팀에 알림 → 보완
- Phase 2: 임베딩 파이프라인이 자동 거부, 큐에 적재

**메타데이터 없는 문서는 학습에서 제외**한다. 데이터 품질이 모델 품질을 결정한다.

## 정기 감사

분기 1회:
- 모든 문서의 frontmatter 검증
- `last_updated`가 6개월 이상 오래된 문서 리뷰 대상
- `status: open` 인데 6개월 이상된 케이스는 closure 검토
