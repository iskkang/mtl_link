---
doc_type: guide
category: implementation
version: 1.0
last_updated: 2026-05-14
---

# Phase 1 → Phase 2 구현 가이드

## Phase 1 구현 (1주)

### Step 1: System Prompt 통합 (1일)

`supabase/functions/bot-respond/index.ts`에 다음 추가:

```typescript
// 0_Core 파일들을 빌드 타임에 import
import SYSTEM_PROMPT from './prompts/system_prompt.md?raw';
import ISSUE_TAXONOMY from './prompts/issue_type_taxonomy.md?raw';
import RISK_MATRIX from './prompts/risk_level_matrix.md?raw';
import OUTPUT_FORMAT from './prompts/output_format.md?raw';
import REJECTION_RULES from './prompts/rejection_rules.md?raw';
import HALLUCINATION_GUARD from './prompts/hallucination_guard.md?raw';
import MULTILINGUAL_RULES from './prompts/multilingual_rules.md?raw';

const COMPOSITE_SYSTEM_PROMPT = `
${SYSTEM_PROMPT}

---

# Reference: Issue Type Taxonomy
${ISSUE_TAXONOMY}

---

# Reference: Risk Level Matrix
${RISK_MATRIX}

---

# Reference: Output Format
${OUTPUT_FORMAT}

---

# Reference: Rejection Rules
${REJECTION_RULES}

---

# Reference: Hallucination Guard
${HALLUCINATION_GUARD}

---

# Reference: Multilingual Rules
${MULTILINGUAL_RULES}
`;
```

**예상 토큰**: 약 8,000 tokens (system prompt)
Claude 3.5 Sonnet 기준 충분히 수용 가능.

### Step 2: Few-shot 예시 추가 (1일)

```typescript
const FEW_SHOT_EXAMPLES = [
  // 예시 3 (Full mode, 가장 대표적)
  { role: "user", content: EXAMPLE_3_INPUT },
  { role: "assistant", content: EXAMPLE_3_OUTPUT },
  // 예시 4 (거절 케이스)
  { role: "user", content: EXAMPLE_4_INPUT },
  { role: "assistant", content: EXAMPLE_4_OUTPUT },
];

const messages = [
  { role: "system", content: COMPOSITE_SYSTEM_PROMPT },
  ...FEW_SHOT_EXAMPLES,
  ...channelContext,  // member-onboarding 결과
  { role: "user", content: userMessage }
];
```

### Step 3: 출력 검증 레이어 (2일)

AI 응답을 그대로 사용자에게 보내지 말고 **검증 후 전달**:

```typescript
function validateMINTOutput(response: string): ValidationResult {
  const errors: string[] = [];

  // 1. Issue Type 명시 여부
  if (!response.match(/Issue Type:\s*[A-Z_]+/)) {
    errors.push("Issue Type missing");
  }

  // 2. 금지 표현 검사
  const FORBIDDEN_PATTERNS = [
    /분명히\s/,
    /걱정\s*마세요/,
    /문제\s*없습니다/,
    /곧\s*도착/,
    /확실히\s/,
  ];
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(response)) {
      errors.push(`Forbidden expression: ${pattern.source}`);
    }
  }

  // 3. Full mode인데 섹션 누락
  if (response.includes("## 1. Current Situation Summary")) {
    const requiredSections = [
      "## 2. Issue Classification",
      "## 3. Confirmed Facts",
      "## 4. Missing Information",
      "## 6. Risk Assessment",
      // ... 12개 섹션 모두
    ];
    for (const section of requiredSections) {
      if (!response.includes(section)) {
        errors.push(`Section missing: ${section}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
```

검증 실패 시:
- 운영팀에 알림 (Slack/내부 채널)
- 재생성 1회 시도
- 그래도 실패 시 fallback 메시지 ("MINT 응답 생성 중 오류 발생, 운영팀 확인 요청")

### Step 4: 베타 테스트 (2일)

- 운영팀 5명에게 MINT 채널 개방
- 1주일간 실제 운영 질문 처리
- 출력 품질 스코어카드 작성

### Step 5: 스코어카드 (Phase 2 평가 준비)

```markdown
## MINT 출력 평가 (응답당)

| 항목 | 점수 (0-10) |
|---|---|
| Issue Type 분류 정확성 | |
| Risk Level 적절성 | |
| Confirmed/Possible 분리 | |
| 금지 표현 회피 | |
| 출력 모드 적절성 | |
| 메시지 초안 품질 | |
| 다국어 처리 | |
| 전체 만족도 | |

평균 7점 이상 도달 시 Phase 2 진입
```

---

## Phase 2 구현 (2-3주)

### Step 1: pgvector 활성화 (0.5일)

```sql
-- Supabase Dashboard → Database → Extensions
CREATE EXTENSION IF NOT EXISTS vector;
```

### Step 2: knowledge_base 테이블 (0.5일)

`metadata_schema.md`의 스키마 그대로 생성:

```sql
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536),
  doc_type TEXT NOT NULL,
  domain TEXT NOT NULL,
  issue_type TEXT,
  region TEXT,
  mode TEXT,
  risk_level TEXT,
  cargo_type TEXT,
  last_updated DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON knowledge_base USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON knowledge_base (doc_type, issue_type);

-- Similarity search RPC
CREATE OR REPLACE FUNCTION match_kb(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_issue_type text DEFAULT NULL,
  filter_region text DEFAULT NULL
) RETURNS TABLE (
  id uuid, filename text, content text, similarity float
) LANGUAGE sql STABLE AS $$
  SELECT id, filename, content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM knowledge_base
  WHERE
    (filter_issue_type IS NULL OR issue_type = filter_issue_type)
    AND (filter_region IS NULL OR region = filter_region)
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

### Step 3: 임베딩 파이프라인 (3일)

Edge Function `kb-ingest`:

```typescript
// 1. .md 파일 읽기
// 2. frontmatter 파싱 (gray-matter)
// 3. 본문을 청크 분할 (500 tokens, 50 overlap)
// 4. OpenAI text-embedding-3-small로 임베딩
// 5. knowledge_base에 INSERT
```

추천 라이브러리:
- `gray-matter` (frontmatter 파싱)
- `tiktoken` (토큰 카운팅)
- OpenAI SDK

### Step 4: bot-respond에 RAG 통합 (3일)

```typescript
async function handleMessage(userMessage: string, context: ChannelContext) {
  // 1. 1차 분류 (lightweight call)
  const classification = await classifyIssue(userMessage);

  // 2. RAG 검색
  const queryEmbedding = await embed(userMessage);
  const relevantDocs = await supabase.rpc('match_kb', {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: 5,
    filter_issue_type: classification.primaryIssueType,
  });

  // 3. Composite prompt 생성
  const prompt = `
    ${COMPOSITE_SYSTEM_PROMPT}

    ## Retrieved Knowledge Base Context
    ${relevantDocs.map(d => `### ${d.filename}\n${d.content}`).join('\n\n')}

    Use the retrieved context when relevant. If the context does not contain
    the answer, do not fabricate — say "Information not found in knowledge base".
  `;

  // 4. Claude 호출
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    system: prompt,
    messages: [
      ...FEW_SHOT_EXAMPLES,
      ...context.messages,
      { role: 'user', content: userMessage }
    ]
  });

  // 5. 검증 + 인용 추가
  const validated = validateMINTOutput(response.content[0].text);
  if (!validated.valid) {
    // 재시도 또는 fallback
  }

  return {
    response: response.content[0].text,
    citations: relevantDocs.map(d => d.filename),
  };
}
```

### Step 5: 응답에 출처 표시 (1일)

응답 하단에 참조 문서 표시:

```markdown
[... MINT 응답 ...]

---

📚 참조: customs_issue_sop.md, OPS-CASE-0001.md, cis_customs_checklist.md
```

### Step 6: 운영 (지속)

- 케이스 신규 작성 시 자동 임베딩 (trigger 또는 cron)
- 문서 수정 시 재임베딩
- 월간 검색 품질 리뷰

---

## Phase 3 (향후, 4-6주)

운영 데이터 시스템 연결:

1. Supabase `shipments` 테이블 (있다면) 조회 tool
2. Gmail API — 화주 메일 요약
3. Google Sheets — 진행 현황 조회
4. Calendar API — 자동 일정 등록 (현재 이미 일부 구현됨)

Anthropic의 **Tool Use (function calling)** 기능 활용.

---

## 비용 추정

### Phase 1
- Claude API: 사용자당 월 약 $5-10 (system prompt 캐싱 활용 시)
- 추가 인프라 없음

### Phase 2
- 위 + OpenAI embedding: 월 ~$50 (초기 임베딩 1회) + 검색당 ~$0.00001
- pgvector: Supabase Pro 플랜 권장

### Phase 3
- 위 + 추가 API 호출 비용
