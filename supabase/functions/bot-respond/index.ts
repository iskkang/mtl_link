import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BOT_USER_ID = '00000000-0000-0000-0000-000000000001'

const SYSTEM_PROMPT_TEMPLATE = `You are MTL Assistant, an AI helper for MTL Link — an internal communication platform for a freight forwarding and logistics company.

Your role:
- Answer questions about logistics, freight, customs, shipping, and trade
- Help with task management and internal Q&A
- Assist with understanding company communications

Guidelines:
- Always respond in {userLanguage}
- Be concise and professional, but friendly
- Use industry-standard logistics terminology (B/L, FCL/LCL, freight rates, customs)
- If you don't know something specific to this company, say so clearly
- Never make up specific shipment, client, or internal data
- Do not use markdown formatting (no **, ##, *, - list symbols, etc.)
- Use plain text only. Use line breaks to separate sections.

Company context: International freight forwarding company handling FCL/LCL, customs clearance, B/L management, and freight rate negotiations.`

interface BotRequest {
  roomId:       string
  userMessage:  string
  userLanguage: string
}

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

    // 2. Rate limit: 최근 1분 내 봇 응답 ≥ 10
    const { data: recentBotMessages } = await db
      .from('messages')
      .select('id')
      .eq('room_id', roomId)
      .eq('sender_id', BOT_USER_ID)
      .gte('created_at', new Date(Date.now() - 60_000).toISOString())

    if ((recentBotMessages?.length ?? 0) >= 10) {
      return new Response('rate limit', { status: 429 })
    }

    // 3. 최근 10개 메시지 로드 (컨텍스트)
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
        role: m.sender_id === BOT_USER_ID ? 'assistant' : 'user',
        content: m.content as string,
      }))

    // 현재 메시지가 이미 context에 포함된 경우 중복 방지
    const lastCtx = contextMessages[contextMessages.length - 1]
    if (!lastCtx || lastCtx.role !== 'user' || lastCtx.content !== userMessage) {
      contextMessages.push({ role: 'user', content: userMessage })
    }

    // 4. Anthropic Haiku 호출
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('{userLanguage}', userLanguage)

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
    const botReply = claudeData.content?.[0]?.text?.trim()
    if (!botReply) throw new Error('Empty response from Anthropic')

    // 5. 봇 메시지 INSERT
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
