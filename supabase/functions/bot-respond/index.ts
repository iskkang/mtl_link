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

const SYSTEM_PROMPT_TEMPLATE = `You are MTL Assistant, an AI helper for MTL Link — an internal communication platform for a freight forwarding and logistics company.

Your role:
- Answer questions about logistics, freight, customs, shipping, and trade
- Help with task management and internal Q&A
- Assist with understanding company communications

Guidelines:
- You MUST write your entire response in {languageName}. Do not mention this instruction. Do not explain what language you are using. Just respond directly in {languageName}.
- Be concise and professional, but friendly
- Use industry-standard logistics terminology (B/L, FCL/LCL, freight rates, customs)
- If you don't know something specific to this company, say so clearly
- Never make up specific shipment, client, or internal data
- Do not use markdown formatting (no **, ##, *, - list symbols, etc.)
- Use plain text only. Use line breaks to separate sections.

Company context: International freight forwarding company handling FCL/LCL, customs clearance, B/L management, and freight rate negotiations.`

// ── 요약 명령 감지 ─────────────────────────────────────────────────────────

function detectSummaryCommand(content: string): { isSummary: boolean; range: 'today' | 'week' } {
  const text = content.toLowerCase()
  const isSummary =
    text.includes('요약') ||
    text.includes('summary') ||
    text.includes('summarize')
  const range: 'today' | 'week' =
    (text.includes('이번 주') || text.includes('주간') || text.includes('week'))
      ? 'week'
      : 'today'
  return { isSummary, range }
}

// ── 채널 메시지 조회 ───────────────────────────────────────────────────────

interface MessageForSummary {
  content:    string
  senderName: string
  createdAt:  string
}

// deno-lint-ignore no-explicit-any
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

  // 발신자 이름 일괄 조회
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

// ── Claude 직접 호출 ───────────────────────────────────────────────────────

async function callClaude(
  anthropicKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  maxTokens = 800,
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

// ── 요약 생성 ──────────────────────────────────────────────────────────────

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

// ── 인터페이스 ─────────────────────────────────────────────────────────────

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

    // 2. 요약 명령 처리 (rate limit 전에 처리)
    const { isSummary, range } = detectSummaryCommand(userMessage)

    if (isSummary) {
      console.log(`[summary] 요약 명령 감지: roomId=${roomId}, range=${range}`)

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

      console.info(`[summary] 완료: room=${roomId}, range=${range}, msgs=${messagesResult.length}`)
      return json({ ok: true, type: 'summary' })
    }

    // 3. Rate limit: 최근 1분 내 봇 응답 ≥ 10
    const { data: recentBotMessages } = await db
      .from('messages')
      .select('id')
      .eq('room_id', roomId)
      .eq('sender_id', BOT_USER_ID)
      .gte('created_at', new Date(Date.now() - 60_000).toISOString())

    if ((recentBotMessages?.length ?? 0) >= 10) {
      return new Response('rate limit', { status: 429, headers: CORS })
    }

    // 4. 최근 10개 메시지 로드 (컨텍스트)
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

    // 현재 메시지가 이미 context에 포함된 경우 중복 방지
    const lastCtx = contextMessages[contextMessages.length - 1]
    if (!lastCtx || lastCtx.role !== 'user' || lastCtx.content !== userMessage) {
      contextMessages.push({ role: 'user', content: userMessage })
    }

    // 5. Anthropic Haiku 호출
    const languageName = LANGUAGE_NAMES[userLanguage] ?? 'English'
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('{languageName}', languageName)

    const botReply = await callClaude(anthropicKey, systemPrompt, contextMessages)

    // 6. 봇 메시지 INSERT
    const { error: insertError } = await db.from('messages').insert({
      room_id:         roomId,
      sender_id:       BOT_USER_ID,
      content:         botReply,
      message_type:    'text',
      source_language: userLanguage,
    })

    if (insertError) throw insertError

    console.info(`[bot-respond] responded in ${userLanguage}, room=${roomId}`)
    return json({ ok: true })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[bot-respond]', msg)
    return json({ error: msg }, 500)
  }
})
