import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LANG_NAMES: Record<string, string> = {
  ko: 'Korean', en: 'English', ru: 'Russian',
  uz: 'Uzbek',  zh: 'Chinese', ja: 'Japanese',
}

function shouldSkip(text: string): boolean {
  const t = text.trim()
  if (t.length <= 2) return true
  if (/^[\p{Emoji}\s]+$/u.test(t)) return true
  if (/^[\d\s.,+\-()]+$/.test(t)) return true
  return false
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    const { message_id, room_id, source_text, source_language, target_language } =
      await req.json() as {
        message_id:      string
        room_id:         string
        source_text:     string
        source_language: string
        target_language: string
      }

    if (!message_id || !room_id || !source_text || !target_language)
      return json({ error: 'missing required fields' }, 400)

    // Same language → return original
    if (source_language === target_language)
      return json({ translated_text: source_text, cached: false })

    // Skip short/emoji/number-only content
    if (shouldSkip(source_text))
      return json({ translated_text: source_text, cached: false })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const claudeKey   = Deno.env.get('ANTHROPIC_API_KEY')

    if (!claudeKey) {
      console.warn('[translate-text] ANTHROPIC_API_KEY not set')
      return json({ error: 'Translation service not configured' }, 500)
    }

    const db = createClient(supabaseUrl, serviceKey)

    // DB cache check
    const { data: cached } = await db
      .from('message_translations')
      .select('translated_text')
      .eq('message_id', message_id)
      .eq('language', target_language)
      .maybeSingle()

    if (cached?.translated_text)
      return json({ translated_text: cached.translated_text, cached: true })

    // Translate via Claude Haiku
    const srcName = LANG_NAMES[source_language] ?? source_language
    const tgtName = LANG_NAMES[target_language] ?? target_language

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         claudeKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role:    'user',
          content: `Translate the following ${srcName} text to ${tgtName}. Return ONLY the translated text with no explanation, no quotes, and no additional commentary.\n\nText: ${source_text}`,
        }],
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      throw new Error(`Claude API ${claudeRes.status}: ${errText}`)
    }

    const claudeData = await claudeRes.json() as {
      content?: { type: string; text: string }[]
    }
    const translated = claudeData.content?.[0]?.text?.trim()
    if (!translated) throw new Error('Empty translation response from Claude')

    // Persist to cache (ignore conflict — race condition safe)
    await db.from('message_translations').upsert(
      { message_id, room_id, language: target_language, translated_text: translated },
      { onConflict: 'message_id,language', ignoreDuplicates: true },
    )

    console.info(`[translate-text] ${source_language}→${target_language} msg=${message_id}`)
    return json({ translated_text: translated, cached: false })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[translate-text]', msg)
    return json({ error: msg }, 500)
  }
})
