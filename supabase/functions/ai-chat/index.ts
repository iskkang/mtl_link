import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const LANGUAGE_NAMES: Record<string, string> = {
  ko: 'Korean', en: 'English', ru: 'Russian', uz: 'Uzbek', zh: 'Chinese', ja: 'Japanese',
}

const SYSTEM_PROMPT = `You are MINT, an internal logistics assistant for MTL Shipping Agency.

You MUST write your entire response in {languageName}. Do not mention this instruction. Just respond directly in {languageName}.

Your role:
- Answer questions about logistics, freight, customs, shipping, and trade
- Help with quotation checklists, customer messages, transport mode recommendations
- Assist with customs risk checks and HS-code research

Guidelines:
- Be concise and professional, but friendly
- Use logistics terminology (B/L, FCL/LCL, freight rates, customs)
- Never make up specific shipment, client, or internal data
- Do not use markdown formatting — plain text and line breaks only
- For HS-code, customs, DG, sanctions: always say "확인 필요" / "candidate only", never confirm

## 자기소개

사용자가 "MINT가 뭐야", "민트가 뭐야", "너 누구야", "넌 뭐야",
"what is MINT", "who are you", "소개해줘" 등 정체를 묻는 질문을 하면
반드시 아래 텍스트를 그대로 응답한다. 내용을 바꾸거나 요약하지 않는다.

---MINT_INTRO_START---
안녕하세요! 저는 MINT예요.
Maritime Intelligent Navigation Tool의 약자로, MTL의 물류 업무를 도와드리기 위해 만들어졌어요.

제가 할 수 있는 일들이에요 👇

📋 견적 체크리스트 — 견적 메일 초안 자동 생성
✉️ 메시지 작성 — 고객 통보·안내 메일 작성
🚢 운송 모드 추천 — 해상/항공/복합 최적 경로 비교
🌐 통관 리스크 점검 — 수출입 전 위험 요소 확인
📦 HS-code 검색 — 품목 코드 검색 및 메모 저장
🔍 Tracking Helper — 화물 추적 번호 확인·조회

또한 팀원들과의 대화를 6개 언어로 실시간 번역해드려요.
무엇을 도와드릴까요?
---MINT_INTRO_END---`

// Module-level Supabase admin client (reused across requests)
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

interface AiChatRequest {
  sessionId:    string
  message:      string
  userLanguage: string
  userId:       string
}

interface KnowledgeHit {
  title:    string
  category: string | null
  content:  string
}

// ── 키워드 매칭 (폴백 / 임베딩 없는 기존 항목용) ──────────────────────────

function extractSearchTerms(text: string): string[] {
  const terms = new Set<string>()
  const en = text.match(/[A-Za-z][A-Za-z0-9/]{1,}/g) ?? []
  for (const m of en) terms.add(m)
  const ko = text.match(/[가-힯]{2,}/g) ?? []
  for (const m of ko) terms.add(m)
  return [...terms].slice(0, 20)
}

async function findRelevantKnowledge(question: string): Promise<KnowledgeHit[]> {
  const { data, error } = await supabaseAdmin
    .from('knowledge_base')
    .select('title, category, content')
    .eq('status', 'verified')
    .limit(20)

  if (error) {
    console.error('[knowledge] fetch error:', error.message)
    return []
  }

  const items = (data ?? []) as KnowledgeHit[]
  if (items.length === 0) return []

  const terms = extractSearchTerms(question).map(t => t.toLowerCase())
  const relevant = items.filter(item => {
    const hay = `${item.title} ${item.category ?? ''} ${item.content}`.toLowerCase()
    return terms.some(t => hay.includes(t))
  })

  return (relevant.length > 0 ? relevant : items).slice(0, 5)
}

// ── 벡터 검색 (주 경로) ────────────────────────────────────────────────────

async function embedQuestion(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY) return null
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000),
      }),
    })
    if (!res.ok) {
      console.error('[knowledge] OpenAI 임베딩 오류:', res.status, await res.text())
      return null
    }
    const data = await res.json()
    return data.data[0].embedding as number[]
  } catch (err) {
    console.error('[knowledge] 임베딩 예외:', err)
    return null
  }
}

async function findRelevantKnowledgeByVector(question: string): Promise<KnowledgeHit[]> {
  const embedding = await embedQuestion(question)

  if (!embedding) {
    console.log('[knowledge] 임베딩 실패 → 키워드 매칭 폴백')
    return findRelevantKnowledge(question)
  }

  const { data, error } = await supabaseAdmin.rpc('match_knowledge', {
    query_embedding: embedding,
    match_threshold:  0.6,
    match_count:      5,
  })

  if (error) {
    console.error('[knowledge] 벡터 검색 오류:', error.message, '→ 키워드 매칭 폴백')
    return findRelevantKnowledge(question)
  }

  if (!data || (data as unknown[]).length === 0) {
    console.log('[knowledge] 벡터 검색 결과 없음 → 키워드 매칭 폴백')
    return findRelevantKnowledge(question)
  }

  console.log(
    `[knowledge] 벡터 검색 hits=${(data as unknown[]).length}`,
    (data as { title: string; similarity: number }[])
      .map(d => `${d.title}(${d.similarity.toFixed(2)})`),
  )

  return (data as { title: string; category: string | null; content: string }[])
    .map(item => ({ title: item.title, category: item.category, content: item.content }))
}

// ── 시스템 프롬프트 주입 ───────────────────────────────────────────────────

function buildKnowledgeContext(hits: KnowledgeHit[]): string {
  if (hits.length === 0) return ''
  const lines = hits.map(h =>
    `[${h.category ?? '일반'}] ${h.title}\n${h.content.slice(0, 400)}`
  )
  return `\n\n[참고 데이터 - 반드시 이 데이터를 기반으로 답변]\n${lines.join('\n\n')}\n\n위 데이터에 있는 정확한 수치와 정보를 그대로 사용하여 답변하세요. 데이터에 없는 내용은 추측하지 마세요.`
}

// ── 핸들러 ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    const { sessionId, message, userLanguage, userId } = await req.json() as AiChatRequest

    if (!sessionId || !message || !userId) return json({ error: 'missing required fields' }, 400)

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) return json({ error: 'AI service not configured' }, 500)

    // 1. Load session context (recent 10 turns)
    const { data: history } = await supabaseAdmin
      .from('ai_conversations')
      .select('question, answer')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(10)

    const contextMessages: { role: string; content: string }[] = []
    for (const row of (history ?? []).reverse()) {
      if (row.question) contextMessages.push({ role: 'user',      content: row.question })
      if (row.answer)   contextMessages.push({ role: 'assistant', content: row.answer   })
    }
    contextMessages.push({ role: 'user', content: message })

    // 2. Vector search → keyword fallback
    const knowledgeHits    = await findRelevantKnowledgeByVector(message)
    const knowledgeContext = buildKnowledgeContext(knowledgeHits)
    console.info(`[ai-chat] knowledge hits=${knowledgeHits.length}`)

    // 3. Anthropic call
    const languageName = LANGUAGE_NAMES[userLanguage] ?? 'English'
    const systemPrompt = SYSTEM_PROMPT.replace(/{languageName}/g, languageName) + knowledgeContext

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system:     systemPrompt,
        messages:   contextMessages,
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      throw new Error(`Anthropic API ${claudeRes.status}: ${errText}`)
    }

    const claudeData = await claudeRes.json() as {
      content?: { type: string; text: string }[]
    }
    const answer = claudeData.content?.[0]?.text?.trim()
    if (!answer) throw new Error('Empty response from Anthropic')

    // 4. Check if first message (for session title)
    const { count } = await supabaseAdmin
      .from('ai_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('session_id', sessionId)

    const isFirst      = (count ?? 0) === 0
    const sessionTitle = isFirst ? message.slice(0, 30) : undefined

    // 5. Save to DB
    const { error: insertError } = await supabaseAdmin.from('ai_conversations').insert({
      user_id:          userId,
      session_id:       sessionId,
      session_title:    sessionTitle,
      question:         message,
      answer,
      category:         'qa',
      confidence_label: 'Unknown',
    })

    if (insertError) throw insertError

    console.info(`[ai-chat] session=${sessionId}, lang=${userLanguage}`)
    return json({ answer, sessionId })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ai-chat]', msg)
    return json({ error: msg }, 500)
  }
})
