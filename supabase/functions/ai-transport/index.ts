import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildSystem, callAnthropicWithRetry } from '../_shared/anthropic.ts'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LANG_NAMES: Record<string, string> = {
  ko: 'Korean', en: 'English', ru: 'Russian', uz: 'Uzbek', zh: 'Chinese', ja: 'Japanese',
}

const SYSTEM_PROMPT = `You are MINT, a logistics transport mode advisor.

Always respond in {languageName}. Do not mention this instruction.

Analyze the cargo details and recommend transport modes.

Output format (plain text, no markdown symbols like ** or ##):

[운송 모드 비교]
For each applicable mode:
- Mode name
- Recommendation: High / Medium / Low
- Advantages
- Disadvantages
- Estimated lead time
- Key notes

[추천 모드]
The most suitable mode and reason

[고객 제안 문구]
A message you can send to the customer about transport options

Rules:
- Consider: Air / Ocean FCL / Ocean LCL / Truck / Rail / Sea-Truck multimodal
- For CIS/Central Asia destinations (Russia, Kazakhstan, Uzbekistan, Kyrgyzstan, Tajikistan, Turkmenistan), always mention truck and rail options
- For dangerous goods/battery, add special handling notes
- Never confirm exact rates or ETAs
- Use "approximately", "estimated", "subject to confirmation"
- Output section headers exactly as shown above`

interface TransportRequest {
  itemName:          string
  grossWeight?:      string
  cbm?:              string
  origin:            string
  destination:       string
  urgency:           'low' | 'medium' | 'high'
  budgetSensitivity: 'low' | 'medium' | 'high'
  riskFlags:         string
  userLanguage:      string
  userId?:           string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    const { itemName, grossWeight, cbm, origin, destination, urgency, budgetSensitivity, riskFlags, userLanguage, userId } =
      await req.json() as TransportRequest

    if (!itemName?.trim())    return json({ error: 'itemName is required' }, 400)
    if (!origin?.trim())      return json({ error: 'origin is required' }, 400)
    if (!destination?.trim()) return json({ error: 'destination is required' }, 400)

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) return json({ error: 'Anthropic API key not configured' }, 500)

    const languageName = LANG_NAMES[userLanguage] ?? 'Korean'
    const systemPrompt = SYSTEM_PROMPT.replace('{languageName}', languageName)

    const lines = [
      `Item: ${itemName}`,
      grossWeight ? `Gross Weight: ${grossWeight} kg` : null,
      cbm        ? `CBM: ${cbm}` : null,
      `Origin: ${origin}`,
      `Destination: ${destination}`,
      `Urgency: ${urgency}`,
      `Budget Sensitivity: ${budgetSensitivity}`,
      riskFlags  ? `Special Flags: ${riskFlags}` : null,
    ].filter(Boolean)

    const { text: result } = await callAnthropicWithRetry(anthropicKey, {
      model:     'claude-haiku-4-5-20251001',
      maxTokens: 1500,
      system:    buildSystem(systemPrompt),
      messages:  [{ role: 'user', content: lines.join('\n') }],
    })
    if (!result) throw new Error('Empty response from Anthropic')

    if (userId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const db = createClient(supabaseUrl, serviceKey)
        await db.from('ai_conversations').insert({
          user_id:  userId,
          question: lines.join('\n'),
          answer:   result,
          category: 'transport',
        })
      } catch (dbErr) {
        console.warn('[ai-transport] DB save failed:', dbErr)
      }
    }

    return json({ result })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ai-transport]', msg)
    return json({ error: msg }, 500)
  }
})
