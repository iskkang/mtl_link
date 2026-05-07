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

    // 2. Anthropic call
    const languageName = LANGUAGE_NAMES[userLanguage] ?? 'English'
    const systemPrompt = SYSTEM_PROMPT.replace(/{languageName}/g, languageName)

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

    // 3. Check if first message (for session title)
    const { count } = await db
      .from('ai_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('session_id', sessionId)

    const isFirst     = (count ?? 0) === 0
    const sessionTitle = isFirst ? message.slice(0, 30) : undefined

    // 4. Save to DB
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
