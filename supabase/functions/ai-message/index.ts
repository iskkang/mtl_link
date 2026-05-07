import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are MTL AI, a logistics communication assistant.
Write a professional logistics message based on the situation provided.

Always write the message content in {language}.

Output format (plain text, no markdown):

[이메일 버전]
Subject: (email subject line)
(professional email body)

[WhatsApp 버전]
(short, conversational message, under 5 sentences)

[내부 보고 버전]
(concise internal summary)

Rules:
- Preserve all numbers, dates, container numbers, AWB numbers, amounts exactly
- Firm tone: polite but clear and direct
- WhatsApp version: under 5 sentences, conversational
- Never change factual information
- Adjust formality based on recipient type: customer=formal, partner=professional, internal=concise`

interface MessageRequest {
  situation:     string
  recipientType: 'customer' | 'partner' | 'internal'
  language:      string
  tone:          'formal' | 'friendly' | 'firm' | 'whatsapp' | 'internal'
  keyPoints?:    string
  userLanguage:  string
  userId?:       string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    const { situation, recipientType, language, tone, keyPoints, userLanguage, userId } =
      await req.json() as MessageRequest

    if (!situation?.trim()) return json({ error: 'situation is required' }, 400)
    if (!language)          return json({ error: 'language is required' }, 400)

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) return json({ error: 'Anthropic API key not configured' }, 500)

    const systemPrompt = SYSTEM_PROMPT.replace('{language}', language)

    const userContent = [
      `Situation: ${situation}`,
      `Recipient Type: ${recipientType}`,
      `Tone: ${tone}`,
      keyPoints ? `Key Points to Include: ${keyPoints}` : null,
    ].filter(Boolean).join('\n')

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userContent }],
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      throw new Error(`Anthropic API ${claudeRes.status}: ${errText}`)
    }

    const claudeData = await claudeRes.json() as {
      content?: { type: string; text: string }[]
    }
    const result = claudeData.content?.[0]?.text?.trim()
    if (!result) throw new Error('Empty response from Anthropic')

    if (userId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const db = createClient(supabaseUrl, serviceKey)

        await db.from('ai_conversations').insert({
          user_id:  userId,
          question: situation.slice(0, 200),
          answer:   result,
          category: 'message',
        })
      } catch (dbErr) {
        console.warn('[ai-message] DB save failed:', dbErr)
      }
    }

    return json({ result })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ai-message]', msg)
    return json({ error: msg }, 500)
  }
})
