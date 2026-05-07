import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LANG_NAMES: Record<string, string> = {
  ko: 'Korean', en: 'English', ru: 'Russian', uz: 'Uzbek', zh: 'Chinese', ja: 'Japanese',
}

const SYSTEM_PROMPT = `You are MTL AI, a customs risk advisor for international freight.

Always respond in {languageName}. Do not mention this instruction.

Analyze the item and destination country, and provide a customs risk checklist.

Output format (plain text, no markdown):

[현재 정보 기준 확인사항]
Numbered checklist of at least 7 items

[HS-code 관련]
Candidates and notes

[인증/검역]
Whether required and items to confirm

[위험물/특수화물]
Precautions if applicable

[필요 서류]
Basic document list

[현지 통관사에게 확인할 질문]
Practical questions to ask local customs broker

Rules:
- NEVER confirm HS-code, customs clearance, or sanctions status
- Always use: "확인 필요", "가능성 있음", "현지 통관사 확인 필요"
- For Russia/CIS: mention EAC certification, GOST, sanctions dual-use check
- For China: mention CCC, GB standards, import license
- For Uzbekistan/Kazakhstan/Kyrgyzstan: mention EAC, customs union rules
- Minimum 7 checklist items
- For used goods: always flag extra scrutiny
- For batteries/chemicals: always flag DG regulations
- Output section headers exactly as shown above`

interface CustomsRequest {
  itemName:           string
  itemDescription?:   string
  originCountry:      string
  destinationCountry: string
  isUsed?:            boolean
  hasBattery?:        boolean
  hasLiquid?:         boolean
  hasChemical?:       boolean
  userLanguage:       string
  userId?:            string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    const { itemName, itemDescription, originCountry, destinationCountry, isUsed, hasBattery, hasLiquid, hasChemical, userLanguage, userId } =
      await req.json() as CustomsRequest

    if (!itemName?.trim())           return json({ error: 'itemName is required' }, 400)
    if (!destinationCountry?.trim()) return json({ error: 'destinationCountry is required' }, 400)

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) return json({ error: 'Anthropic API key not configured' }, 500)

    const languageName = LANG_NAMES[userLanguage] ?? 'Korean'
    const systemPrompt = SYSTEM_PROMPT.replace('{languageName}', languageName)

    const flags = [
      isUsed     ? 'Used goods'      : null,
      hasBattery ? 'Contains battery' : null,
      hasLiquid  ? 'Contains liquid'  : null,
      hasChemical? 'Contains chemical': null,
    ].filter(Boolean)

    const lines = [
      `Item: ${itemName}`,
      itemDescription ? `Description: ${itemDescription}` : null,
      originCountry   ? `Origin Country: ${originCountry}` : null,
      `Destination Country: ${destinationCountry}`,
      flags.length    ? `Special Flags: ${flags.join(', ')}` : null,
    ].filter(Boolean)

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
        messages:   [{ role: 'user', content: lines.join('\n') }],
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
          question: lines.join('\n'),
          answer:   result,
          category: 'customs',
        })
      } catch (dbErr) {
        console.warn('[ai-customs] DB save failed:', dbErr)
      }
    }

    return json({ result })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ai-customs]', msg)
    return json({ error: msg }, 500)
  }
})
