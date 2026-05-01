import Anthropic from 'npm:@anthropic-ai/sdk'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LANGS: Record<string, string> = {
  ko: 'Korean', en: 'English', ru: 'Russian',
  uz: 'Uzbek',  zh: 'Chinese', ja: 'Japanese',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    const form           = await req.formData()
    const image          = form.get('image') as File | null
    const targetLanguage = String(form.get('target_language') ?? 'ko')

    if (!image) return json({ error: 'image required' }, 400)

    // 10MB 제한
    if (image.size > 10 * 1024 * 1024)
      return json({ error: 'Image must be 10MB or less' }, 400)

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(image.type))
      return json({ error: 'Only JPEG, PNG, WEBP, GIF are supported' }, 400)

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return json({ error: 'Translation service not configured' }, 500)

    // 이미지 → base64
    const buf        = await image.arrayBuffer()
    const base64     = btoa(String.fromCharCode(...new Uint8Array(buf)))
    const mediaType  = image.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
    const tgtName    = LANGS[targetLanguage] ?? 'Korean'

    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role:    'user',
        content: [
          {
            type:   'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `You are a logistics document OCR and translation expert.

1. Extract ALL text from this image exactly as written
2. Translate the extracted text to ${tgtName}
3. Preserve exactly: numbers, dates, codes, port names, company names, container numbers, document codes (B/L, AWB, MBL, HBL, FCL, LCL, ETD, ETA, POL, POD)

Response format (JSON only, no markdown):
{
  "extracted_text": "원본 추출 텍스트",
  "translated_text": "번역된 텍스트",
  "detected_language": "감지된 언어 코드 (ko/en/ru/uz/zh/ja)"
}

Output ONLY valid JSON, nothing else.`,
          },
        ],
      }],
    })

    const block = response.content[0]
    if (block.type !== 'text') throw new Error('Unexpected response type from Claude')

    // Claude가 마크다운 코드블록으로 감싸는 경우 대비
    const raw    = block.text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '')
    const result = JSON.parse(raw) as {
      extracted_text:    string
      translated_text:   string
      detected_language: string
    }

    if (!result.extracted_text || !result.translated_text)
      throw new Error('Incomplete OCR result from Claude')

    console.info(`[ocr-translate] ${result.detected_language}→${targetLanguage} (${image.size} bytes)`)

    return json({
      ok:                true,
      extracted_text:    result.extracted_text,
      translated_text:   result.translated_text,
      detected_language: result.detected_language,
      target_language:   targetLanguage,
    })

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[ocr-translate]', msg)
    return json({ error: msg }, 500)
  }
})
