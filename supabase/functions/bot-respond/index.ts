import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BOT_USER_ID = '00000000-0000-0000-0000-000000000001'

const LANGUAGE_NAMES: Record<string, string> = {
  ko: 'Korean', en: 'English', ru: 'Russian', uz: 'Uzbek', zh: 'Chinese', ja: 'Japanese',
}

// ── MINT System Prompt (MTL 전용) ──────────────────────────────────────────

const MINT_SYSTEM_PROMPT = `You are MINT, the internal logistics AI of MTL Shipping Agency.

══ RESPONSE MODE ══
Choose ONE of two modes based on the user's intent:

【Mode A — Conversational】(default for most queries)
Triggers: "~에 대해 알려줘 / 정리해줘 / 설명해줘", "~는 어떻게 해? / ~할 때 절차가 뭐야?", "~의 차이가 뭐야?", general SOP / definition / guide questions.
Style: Natural, concise, friendly-professional. Like ChatGPT/Claude.
- Lead with the answer directly. No labels, no headers unless genuinely useful.
- Use markdown sparingly: bold for key terms, lists only when content is truly list-shaped.
- Keep it short. Default to 3-6 sentences for simple questions.
- Korean: ~합니다/~해요 mixed naturally, not stiff.

【Mode B — Operational】(only when reporting a real incident/issue)
Triggers: past-tense/completed-fact statements ("~이 지연됐어 / ~이 파손됐어 / ~이 적체됐어"), specific job references (container number, BL number, order number), "고객 클레임 들어왔어 / 통관 막혔어 / 서류 빠졌어", asking how to handle an event that has already occurred.
Style: Structured for operational handoff.
Use these sections (omit any that don't apply). Section labels must be **bold** (not ## headers):
- Korean: **확인된 사실** / **확인 필요** / **조치 필요** / **고객 메시지(안)**
- English: **Confirmed Facts** / **To Confirm** / **Required Actions** / **Customer Message (draft)**
- Other languages (RU/UZ/ZH/JA): translate the four labels naturally into the user's language.
Each section: only include if it has content. Omit empty sections entirely.

Boundary rules:
- "어떻게 해야 해?" alone → Mode A
- "지금 ~상황인데 어떻게 해야 해?" (current fact stated) → Mode B
- Ambiguous → default to Mode A; optionally add one line: "혹시 실제 발생한 건이라면 상황을 알려주세요."

══ CRITICAL ══
- NEVER output "Issue Type: X" or "Risk: Y" or any internal classification labels to the user.
- These are internal-only. The user must never see them.
- NEVER quote "INTERNAL REFERENCE", filenames, or section headers from the knowledge base to the user. Use the knowledge as background only and phrase the answer in your own words.
- NEVER mix confirmed facts with assumptions.
- NEVER state ETA definitively (always note "subject to change" / "변동 가능").
- NEVER confirm freight rates, judge responsibility, or give legal advice.
- NEVER fabricate. If you don't know, say so.

══ COMPANY CONTEXT ══
MTL Shipping Agency — International freight forwarding.
Routes: KR→PL / KR→RU(TSR) / KR→UZ(TCR/TSR) / KR→KZ / KR→CN transit
Cargo: Auto parts, used cars, general cargo, project cargo
Modes: Sea / Rail / Sea-Rail(TCR/TSR) / Truck / FCL / LCL
Borders: Khorgos, Dostyk, Altynkol, Torugart (all KZ-CN)
Do NOT invent routes, borders, or regions outside this list.

══ ROUTE KNOWLEDGE (apply when relevant) ══
- KR→KZ: POA must be notarized; check Khorgos transit permit expiry.
- KR→UZ: EAC certification; Russian-language CI/PL required for TSR.
- KR→RU: BOLT SEAL mandatory for TSR; 48h no-response → contact backup partner.
- China transit: vague invoice descriptions → request specific description.
- 1 CNTR = 1 RWB (railway absolute rule).

══ LENGTH ══
- Conversational mode: aim for 3-8 sentences. Expand only if user explicitly asks for detail.
- Operational mode: as long as needed but no filler.

LANGUAGE: Respond in the user's language. No emojis unless user uses them first.`

// ── RAG: knowledge_base 검색 ───────────────────────────────────────────────

async function searchKnowledgeBase(
  db: ReturnType<typeof createClient>,
  openaiKey: string,
  query: string,
  issueType: string | null = null,
): Promise<string> {
  try {
    // 1. 쿼리 임베딩 생성
    const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query.slice(0, 2000),
      }),
    })

    if (!embedRes.ok) {
      console.warn('[RAG] embedding failed:', await embedRes.text())
      return ''
    }

    const embedData = await embedRes.json() as { data: { embedding: number[] }[] }
    const embedding = embedData.data[0].embedding

    // 2. knowledge_base 유사도 검색
    const { data, error } = await db.rpc('match_knowledge_base', {
      query_embedding:    embedding,
      match_threshold:    0.65,
      match_count:        4,
      filter_issue_type:  issueType,
    })

    if (error || !data || data.length === 0) return ''

    // 3. 검색 결과를 컨텍스트 문자열로 변환
    const context = (data as { filename: string; content: string }[])
      .map(d => `[${d.filename}]\n${d.content}`)
      .join('\n\n---\n\n')

    return `\n\n══ INTERNAL REFERENCE (do not quote section headers or filenames to the user; use this as background knowledge only) ══\n${context}\n══ END REFERENCE ══`

  } catch (e) {
    console.warn('[RAG] search error:', e)
    return ''
  }
}

// ── Issue Type 간단 분류 ───────────────────────────────────────────────────

function detectIssueType(text: string): string | null {
  const t = text.toLowerCase()
  if (t.includes('delay') || t.includes('지연') || t.includes('발차') || t.includes('적체')) return 'TRANSIT_DELAY'
  if (t.includes('customs') || t.includes('통관') || t.includes('세관')) return 'CUSTOMS_DELAY'
  if (t.includes('document') || t.includes('서류') || t.includes('invoice') || t.includes('packing list')) return 'DOC_MISSING'
  if (t.includes('border') || t.includes('국경') || t.includes('khorgos') || t.includes('altynkol')) return 'BORDER_ISSUE'
  if (t.includes('damage') || t.includes('파손') || t.includes('손상')) return 'CARGO_DAMAGE'
  if (t.includes('claim') || t.includes('클레임')) return 'CUSTOMER_CLAIM'
  if (t.includes('cost') || t.includes('비용') || t.includes('charge')) return 'COST_DISPUTE'
  if (t.includes('poa') || t.includes('위임장')) return 'DOC_MISSING'
  if (t.includes('eta') || t.includes('arrival') || t.includes('도착')) return 'ETA_RISK'
  return null
}

// ── 요약 명령 감지 (기존 유지) ─────────────────────────────────────────────

function detectSummaryCommand(content: string): { isSummary: boolean; range: 'today' | 'week' } {
  const text = content.toLowerCase()
  const isSummary =
    text.includes('요약') || text.includes('정리') ||
    text.includes('summary') || text.includes('summarize') ||
    text.includes('まとめ') || text.includes('要約') ||
    text.includes('总结') || text.includes('總結') ||
    text.includes('резюме') || text.includes('сводка') ||
    text.includes('qisqacha') || text.includes('xulosa')
  const range: 'today' | 'week' =
    (
      text.includes('이번 주') || text.includes('주간') ||
      text.includes('week') ||
      text.includes('週間') || text.includes('今週') ||
      text.includes('本周') || text.includes('本週') ||
      text.includes('неделю') || text.includes('недел') ||
      text.includes('hafta')
    ) ? 'week' : 'today'
  return { isSummary, range }
}

// ── 채널 메시지 조회 (기존 유지) ──────────────────────────────────────────

interface MessageForSummary {
  content:    string
  senderName: string
  createdAt:  string
}

async function fetchChannelMessages(
  db: ReturnType<typeof createClient>,
  roomId: string,
  range: 'today' | 'week',
): Promise<MessageForSummary[]> {
  const since = new Date()
  if (range === 'week') {
    since.setDate(since.getDate() - 7)
  } else {
    since.setHours(0, 0, 0, 0)
  }

  const { data: msgs, error } = await db
    .from('messages')
    .select('content, created_at, sender_id')
    .eq('room_id', roomId)
    .neq('sender_id', BOT_USER_ID)
    .is('deleted_at', null)
    .eq('message_type', 'text')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) {
    console.error('[summary] messages error:', error.message)
    return []
  }

  const messages = (msgs ?? []).filter(
    // deno-lint-ignore no-explicit-any
    (m: any) => (m.content as string)?.trim()
  )
  if (messages.length === 0) return []

  // deno-lint-ignore no-explicit-any
  const senderIds = [...new Set(messages.map((m: any) => m.sender_id as string))]
  const { data: profiles } = await db
    .from('profiles')
    .select('id, name')
    .in('id', senderIds)

  const nameMap: Record<string, string> = {}
  for (const p of (profiles ?? []) as { id: string; name: string }[]) {
    nameMap[p.id] = p.name
  }

  // deno-lint-ignore no-explicit-any
  return messages.map((m: any) => ({
    content:    m.content as string,
    senderName: nameMap[m.sender_id as string] ?? '알 수 없음',
    createdAt:  m.created_at as string,
  }))
}

// ── Claude 호출 (기존 유지) ────────────────────────────────────────────────

async function callClaude(
  anthropicKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  maxTokens = 1200,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system:     systemPrompt,
      messages,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Anthropic API ${res.status}: ${errText}`)
  }

  const data = await res.json() as { content?: { type: string; text: string }[] }
  const text = data.content?.[0]?.text?.trim()
  if (!text) throw new Error('Empty response from Anthropic')
  return text
}

// ── 요약 생성 (기존 유지) ──────────────────────────────────────────────────

async function generateSummary(
  anthropicKey: string,
  messages: MessageForSummary[],
  roomName: string,
  range: 'today' | 'week',
): Promise<string> {
  const rangeLabel = range === 'today' ? '오늘' : '이번 주'

  if (messages.length === 0) {
    return `${rangeLabel} ${roomName}에 대화 내용이 없습니다.`
  }

  const transcript = messages
    .map(m => {
      const time = new Date(m.createdAt).toLocaleTimeString('ko-KR', {
        hour: '2-digit', minute: '2-digit',
      })
      return `[${time}] ${m.senderName}: ${m.content}`
    })
    .join('\n')

  const systemPrompt = `You are a logistics team assistant summarizing internal channel conversations.
Always respond in Korean (한국어).
Be concise. Use bullet points. No markdown bold/italic.
Separate: decided items, requested items, in-progress items.`

  const userPrompt = `다음은 ${roomName} 채널의 ${rangeLabel} 업무 대화입니다 (${messages.length}건).
핵심 내용을 불릿 포인트로 간결하게 요약해주세요.
결정된 사항, 요청된 사항, 처리 중인 사항을 구분해서 정리해주세요.

대화 내용:
${transcript}

요약 형식 (반드시 이 형식으로):
📋 ${rangeLabel} #${roomName} 요약 (${messages.length}건)
• [내용] (담당자)
...`

  return await callClaude(anthropicKey, systemPrompt, [{ role: 'user', content: userPrompt }], 1000)
}

// ── 인터페이스 (기존 유지) ─────────────────────────────────────────────────

interface BotRequest {
  roomId:       string
  userMessage:  string
  userLanguage: string
}

// ── 메인 핸들러 ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    const { roomId, userMessage, userLanguage } = await req.json() as BotRequest

    if (!roomId || !userMessage) return json({ error: 'missing required fields' }, 400)

    const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
    const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const openaiKey    = Deno.env.get('OPENAI_API_KEY') ?? ''

    if (!anthropicKey) {
      console.warn('[bot-respond] ANTHROPIC_API_KEY not set')
      return json({ error: 'Bot service not configured' }, 500)
    }

    const db = createClient(supabaseUrl, serviceKey)

    // 1. 봇 방 검증
    const { data: botMember } = await db
      .from('room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', BOT_USER_ID)
      .maybeSingle()

    if (!botMember) return json({ error: 'not a bot room' }, 400)

    // 2. 요약 명령 처리
    const { isSummary, range } = detectSummaryCommand(userMessage)

    if (isSummary) {
      const [messagesResult, roomResult] = await Promise.all([
        fetchChannelMessages(db, roomId, range),
        db.from('rooms').select('name').eq('id', roomId).maybeSingle(),
      ])

      const roomName = (roomResult.data as { name: string } | null)?.name ?? '채널'
      const summary  = await generateSummary(anthropicKey, messagesResult, roomName, range)

      const { error: insertError } = await db.from('messages').insert({
        room_id:      roomId,
        sender_id:    BOT_USER_ID,
        content:      summary,
        message_type: 'text',
      })

      if (insertError) throw insertError
      return json({ ok: true, type: 'summary' })
    }

    // 3. Rate limit
    const { data: recentBotMessages } = await db
      .from('messages')
      .select('id')
      .eq('room_id', roomId)
      .eq('sender_id', BOT_USER_ID)
      .gte('created_at', new Date(Date.now() - 60_000).toISOString())

    if ((recentBotMessages?.length ?? 0) >= 10) {
      return new Response('rate limit', { status: 429, headers: CORS })
    }

    // 4. 최근 메시지 컨텍스트
    const { data: recentMsgs } = await db
      .from('messages')
      .select('sender_id, content')
      .eq('room_id', roomId)
      .eq('message_type', 'text')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10)

    const contextMessages = (recentMsgs ?? [])
      .reverse()
      .filter(m => m.content)
      .map(m => ({
        role:    m.sender_id === BOT_USER_ID ? 'assistant' : 'user',
        content: m.content as string,
      }))

    const lastCtx = contextMessages[contextMessages.length - 1]
    if (!lastCtx || lastCtx.role !== 'user' || lastCtx.content !== userMessage) {
      contextMessages.push({ role: 'user', content: userMessage })
    }

    // 5. RAG: knowledge_base 검색 (OpenAI 키 있을 때만)
    let ragContext = ''
    if (openaiKey) {
      const issueType = detectIssueType(userMessage)
      ragContext = await searchKnowledgeBase(db, openaiKey, userMessage, issueType)
    }

    // 6. System prompt 구성 (MINT + RAG 컨텍스트)
    const languageName = LANGUAGE_NAMES[userLanguage] ?? 'English'
    const systemPrompt = MINT_SYSTEM_PROMPT
      + `\n\nRespond in ${languageName}.`
      + ragContext  // RAG 검색 결과 주입

    // 7. Claude 호출
    const botReply = await callClaude(anthropicKey, systemPrompt, contextMessages, 800)

    // 8. 봇 메시지 INSERT
    const { error: insertError } = await db.from('messages').insert({
      room_id:         roomId,
      sender_id:       BOT_USER_ID,
      content:         botReply,
      message_type:    'text',
      source_language: userLanguage,
    })

    if (insertError) throw insertError

    console.info(`[bot-respond] MINT replied in ${userLanguage}, room=${roomId}, rag=${ragContext.length > 0}`)
    return json({ ok: true })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[bot-respond]', msg)
    return json({ error: msg }, 500)
  }
})
