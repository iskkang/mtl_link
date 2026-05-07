import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are MTL AI, an internal logistics assistant for MTL Shipping Agency.
Analyze the customer inquiry and identify missing information needed for a freight quotation.

Always respond in {userLanguage}.

Output format (plain text, no markdown):

[확인된 정보]
List confirmed information as bullet points (use • prefix for each item)

[누락된 정보 및 추가 질문]
List at least 10 numbered questions needed to complete the quotation

[고객에게 보낼 메시지]
A professional message to send to the customer asking for missing information

Rules:
- Always ask about: item name, weight/CBM, origin, destination, incoterms, transport mode preference, battery/liquid/dangerous goods possibility, customs capability
- Never confirm HS-code, customs clearance, or sanctions status
- Use "확인 필요", "가능성이 있습니다" type expressions for uncertain items
- Preserve all numbers, dates, company names exactly
- The customer message should be polite and professional`

interface QuotationRequest {
  rawInquiry:    string
  customerName?: string
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
    const { rawInquiry, customerName, userLanguage, userId } =
      await req.json() as QuotationRequest

    if (!rawInquiry?.trim()) return json({ error: 'rawInquiry is required' }, 400)

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) return json({ error: 'Anthropic API key not configured' }, 500)

    const systemPrompt = SYSTEM_PROMPT.replace('{userLanguage}', userLanguage || 'Korean')

    const userContent = customerName
      ? `Customer Name: ${customerName}\n\nCustomer Inquiry:\n${rawInquiry}`
      : `Customer Inquiry:\n${rawInquiry}`

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1500,
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

        await db.from('quotation_requests').insert({
          created_by:    userId,
          customer_name: customerName ?? null,
          raw_inquiry:   rawInquiry,
          checklist:     { analysis: result },
          status:        'draft',
        })
      } catch (dbErr) {
        console.warn('[ai-quotation] DB save failed:', dbErr)
      }
    }

    return json({ result })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ai-quotation]', msg)
    return json({ error: msg }, 500)
  }
})
