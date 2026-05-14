import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { MINT_SYSTEM_PROMPT } from '../_shared/mintPrompt.ts'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const LANGUAGE_NAMES: Record<string, string> = {
  ko: 'Korean', en: 'English', ru: 'Russian', uz: 'Uzbek', zh: 'Chinese', ja: 'Japanese',
}

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
  filename:   string
  doc_type:   string | null
  issue_type: string | null
  content:    string
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
  const terms = extractSearchTerms(question)
  if (terms.length === 0) return []

  const seen = new Set<string>()
  const results: KnowledgeHit[] = []

  // 1단계: filename ILIKE 검색 (빠르고 정확)
  for (const term of terms.slice(0, 5)) {
    const { data } = await supabaseAdmin
      .from('knowledge_base')
      .select('filename, doc_type, issue_type, content')
      .ilike('filename', `%${term}%`)
      .limit(3)
    for (const row of data ?? []) {
      if (!seen.has(row.filename)) { seen.add(row.filename); results.push(row as KnowledgeHit) }
    }
  }
  if (results.length > 0) return results.slice(0, 5)

  // 2단계: content ILIKE 검색 (fallback)
  for (const term of terms.slice(0, 3)) {
    const { data } = await supabaseAdmin
      .from('knowledge_base')
      .select('filename, doc_type, issue_type, content')
      .ilike('content', `%${term}%`)
      .limit(3)
    for (const row of data ?? []) {
      if (!seen.has(row.filename)) { seen.add(row.filename); results.push(row as KnowledgeHit) }
    }
  }
  return results.slice(0, 5)
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

  const { data, error } = await supabaseAdmin.rpc('match_knowledge_base', {
    query_embedding:   embedding,
    match_threshold:   0.5,
    match_count:       5,
    filter_issue_type: null,
    filter_region:     null,
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
    (data as { filename: string; similarity: number }[])
      .map(d => `${d.filename}(${d.similarity.toFixed(2)})`),
  )

  return (data as { filename: string; doc_type: string | null; issue_type: string | null; content: string }[])
    .map(item => ({ filename: item.filename, doc_type: item.doc_type, issue_type: item.issue_type, content: item.content }))
}

// ── 시스템 프롬프트 주입 ───────────────────────────────────────────────────

function buildKnowledgeContext(hits: KnowledgeHit[]): string {
  if (hits.length === 0) return ''
  const lines = hits.map(h =>
    `[${h.issue_type ?? h.doc_type ?? '일반'}] ${h.filename}\n${h.content.slice(0, 1500)}`
  )
  return `\n\n══ INTERNAL REFERENCE (do not quote section headers or filenames to the user; use this as background knowledge only) ══\n${lines.join('\n\n')}\n══ END REFERENCE ══`
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
    const systemPrompt = MINT_SYSTEM_PROMPT.replace(/{languageName}/g, languageName) + knowledgeContext

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 800,
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
