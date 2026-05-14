---
doc_type: index
version: 1.0
last_updated: 2026-05-14
owner: MTL Link Product Team
phase: 1
---

# MINT 운영 AI 학습 프로그램

> Maritime Intelligent Navigation Tool — MTL Shipping Agency 사내 운영 보조 AI

## 1. 프로그램 목표

MINT가 **"좋은 답변"이 아니라 "항상 같은 구조의 신뢰 가능한 답변"**을 하도록 학습시킨다.

운영 직원이 상황을 입력하면 MINT는 다음을 수행해야 한다:

1. 문제 유형을 분류 (Issue Type Taxonomy)
2. 누락된 사실/문서를 식별
3. 리스크 레벨을 판단 (Risk Level Matrix)
4. 액션 아이템을 당사자별로 분배
5. 고객·파트너용 메시지 초안 작성
6. 에스컬레이션 필요 여부 명시

## 2. Phase 학습 로드맵

| Phase | 구현 방식 | 기간 | 산출물 |
|---|---|---|---|
| **Phase 1 (현재)** | System Prompt + Few-shot | 1주 | 본 프로그램 |
| Phase 2 | RAG (pgvector + similarity search) | 2-3주 | knowledge_base 테이블 + bot-respond 통합 |
| Phase 3 | 운영 시스템 연결 (Supabase shipment DB, Gmail, Sheets) | 4-6주 | Function calling 기반 운영 AI |

**중요**: Phase 1은 RAG 없이도 동작해야 한다. System Prompt와 10개 케이스만으로 Level 1 운영 AI를 완성한 뒤, 그 위에 RAG를 얹는다.

## 3. 디렉터리 구조

```
MINT_Training_Program/
├── 00_Core/                  ← Phase 1 필수. RAG 없이도 동작
│   ├── system_prompt.md          ★ MINT의 인격과 행동 규칙
│   ├── issue_type_taxonomy.md    ★ 11개 문제 유형 분류
│   ├── risk_level_matrix.md      ★ 리스크 + 에스컬레이션 통합
│   ├── output_format.md          ★ Quick / Full 2-모드 출력 형식
│   ├── issue_to_sop_mapping.md   ★ 문제 유형 → 참조 문서 라우팅
│   ├── rejection_rules.md        ★ AI가 답하면 안 되는 경우
│   ├── hallucination_guard.md    ★ 확정/추정 분리 규칙
│   ├── multilingual_rules.md     ★ 6언어 메신저 환경 응답 규칙
│   └── metadata_schema.md        ★ 모든 문서 YAML frontmatter 규격
│
├── 01_SOPs/                  ← 표준 운영 절차
├── 02_Checklists/            ← 서류 체크리스트
├── 03_Cases/                 ← 실제 케이스 로그 (가장 가치 높음)
├── 04_Templates/             ← 고객/파트너 메시지 템플릿
└── 05_Rules/                 ← 운영 규칙 (ETA 표현법, 비용 확인 등)
```

**Phase 1 제외 항목** (원안 대비):
- `06_Review/` — 평가 데이터 자체가 없으므로 Phase 2로 연기
- `07_Partner_Profiles/` — 거래처별 데이터 누적 후 Phase 2
- `08_Route_Specifics/` — 노선별 데이터 누적 후 Phase 2

## 4. 메타데이터 규약 (필수)

모든 `.md` 파일은 YAML frontmatter로 시작해야 한다. RAG의 metadata filtering이 여기에 의존한다.

```yaml
---
doc_type: sop | checklist | case | template | rule | core
domain: operations
issue_type: CUSTOMS_DELAY | DOC_MISSING | ...
region: KR | CIS | EU | CN | global
mode: sea | rail | truck | air | sea-rail
risk_level: low | medium | high | critical
last_updated: YYYY-MM-DD
owner: operations_team
---
```

스키마 상세는 `00_Core/metadata_schema.md` 참조.

## 5. Phase 1 완료 기준

- [ ] `00_Core/` 9개 파일 작성 완료
- [ ] SOP 최소 6개 작성
- [ ] Checklist 최소 5개 작성
- [ ] **실제 케이스 10개**를 표준 템플릿으로 작성 (가장 중요)
- [ ] 메시지 템플릿 5개 작성
- [ ] 운영 규칙 5개 작성
- [ ] System Prompt를 `bot-respond` Edge Function에 적용
- [ ] 운영팀 5명 베타 테스트 1주
- [ ] AI 출력 평가 스코어카드 작성 (Phase 2 준비)

## 6. Phase 2 진입 조건

- Phase 1 베타 테스트 후 AI 출력 만족도 ≥ 70%
- Supabase pgvector extension 활성화
- 임베딩 파이프라인 (OpenAI text-embedding-3-small 권장)
- 케이스 누적 30개 이상

## 7. AI 모델 선택

| 작업 | 권장 모델 | 이유 |
|---|---|---|
| 일일 브리핑 | GPT-4o-mini | 가격, 한국어 안정성 |
| 운영 질문 응답 | **Claude (현재 bot-respond)** | 구조화된 출력, instruction following |
| RAG 임베딩 | text-embedding-3-small | 비용/성능 균형 |
| 운영 메시지 초안 | Claude | 다국어, 톤 조절 |

운영 AI 핵심 (bot-respond)에는 **Claude 유지**를 권장한다. 12섹션 구조화 출력에서 GPT-4o-mini보다 안정적이다.
