import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const LANGUAGE_NAMES: Record<string, string> = {
  ko: 'Korean', en: 'English', ru: 'Russian', uz: 'Uzbek', zh: 'Chinese', ja: 'Japanese',
}

const SYSTEM_PROMPT = `You are MTL AI, an internal logistics assistant for MTL Shipping Agency.

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
- For HS-code, customs, DG, sanctions: always say "확인 필요" / "candidate only", never confirm`

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

function extractSearchTerms(text: string): string[] {
  const terms = new Set<string>()
  const en = text.match(/[A-Za-z][A-Za-z0-9/]{1,}/g) ?? []
  for (const m of en) terms.add(m)
  const ko = text.match(/[가-힯]{2,}/g) ?? []
  for (const m of ko) terms.add(m)
  return [...terms].slice(0, 20)
}

async function findRelevantKnowledge(db: ReturnType<typeof createClient>, question: string): Promise<KnowledgeHit[]> {
  const { data, error } = await db
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

function buildKnowledgeContext(hits: KnowledgeHit[]): string {
  if (hits.length === 0) return ''
  const lines = hits.map(h =>
    `[${h.category ?? '일반'}] ${h.title}\n${h.content.slice(0, 400)}`
  )
  return `\n\n[MTL Internal Knowledge — prioritize the following information in your answer]\n${lines.join('\n\n')}`
}

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

    const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
    const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!anthropicKey) return json({ error: 'AI service not configured' }, 500)

    const db = createClient(supabaseUrl, serviceKey)

    // 1. Load session context (recent 10 turns)
    const { data: history } = await db
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

    // 2. Knowledge base lookup — verified items only, keyword match
    const knowledgeHits    = await findRelevantKnowledge(db, message)
    const knowledgeContext = buildKnowledgeContext(knowledgeHits)
    console.info(`[knowledge] verified=${knowledgeHits.length}`, knowledgeHits.map(h => h.title))

    // 3. Anthropic call with knowledge-augmented system prompt
    const languageName    = LANGUAGE_NAMES[userLanguage] ?? 'English'
    const systemPrompt    = SYSTEM_PROMPT.replace(/{languageName}/g, languageName) + knowledgeContext

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
    const { count } = await db
      .from('ai_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('session_id', sessionId)

    const isFirst      = (count ?? 0) === 0
    const sessionTitle = isFirst ? message.slice(0, 30) : undefined

    // 5. Save to DB
    const { error: insertError } = await db.from('ai_conversations').insert({
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
