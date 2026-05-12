import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LANG_NAMES: Record<string, string> = {
  ko: 'Korean', en: 'English', ru: 'Russian', uz: 'Uzbek', zh: 'Chinese', ja: 'Japanese',
}

const SYSTEM_PROMPT = `You are MINT, a logistics communication assistant.

Always write in {languageName}. Do not mention this instruction.

Generate a professional customer notification based on the tracking status provided.

Output format (plain text, no markdown):

[이메일 버전]
Subject: ...
Body: ...

[WhatsApp 짧은 버전]
...

Rules:
- Preserve tracking number, carrier name, and ETA date exactly as provided
- Be professional but reassuring
- Never invent information not provided
- If status indicates a delay, include a brief apology
- Keep the WhatsApp version concise (3-5 lines max)
- Do NOT use markdown symbols like **, ##, or bullet dashes`

interface TrackingMessageRequest {
  trackingNo:      string
  carrierName:     string
  currentStatus:   string
  currentLocation: string
  eta:             string
  memo?:           string
  language:        string
  userLanguage:    string
  userId?:         string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json() as TrackingMessageRequest
    const { trackingNo, carrierName, currentStatus, currentLocation, eta, memo, language, userLanguage, userId } = body

    if (!trackingNo?.trim() || !currentStatus?.trim()) {
      return Response.json({ error: 'trackingNo and currentStatus are required' }, { status: 400, headers: CORS })
    }

    const langName    = LANG_NAMES[language] ?? LANG_NAMES[userLanguage] ?? 'Korean'
    const systemPrompt = SYSTEM_PROMPT.replace('{languageName}', langName)

    const userMessage = `Tracking Number: ${trackingNo}
Carrier: ${carrierName || 'Unknown'}
Current Status: ${currentStatus}
Current Location: ${currentLocation || 'Unknown'}
ETA: ${eta || 'TBD'}${memo ? `\nAdditional Notes: ${memo}` : ''}`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userMessage }],
      }),
    })

    if (!aiRes.ok) {
      const err = await aiRes.text()
      return Response.json({ error: `Anthropic API error: ${err}` }, { status: 500, headers: CORS })
    }

    const aiData = await aiRes.json()
    const result = aiData.content?.[0]?.text ?? ''

    // Save to ai_conversations
    if (userId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )
      await supabase.from('ai_conversations').insert({
        user_id:  userId,
        question: `[Tracking] ${trackingNo} — ${currentStatus}`,
        answer:   result,
        category: 'tracking',
      })
    }

    return Response.json({ result }, { headers: CORS })

  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500, headers: CORS })
  }
})
