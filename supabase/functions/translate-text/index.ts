import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Module-scope admin client (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY auto-injected)
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

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
  if (t.length === 0) return true
  if (/^[\p{Emoji}\s]+$/u.test(t)) return true
  if (/^[\d\s.,+\-()]+$/.test(t)) return true
  return false
}

// ── Glossary matching helpers ─────────────────────────────────────────────────

function extractTokens(text: string): string[] {
  const tokens = new Set<string>()
  // English tokens incl. slash/numbers (B/L, FCL, 20-foot …) — 2 chars+
  const enMatches = text.match(/[A-Za-z][A-Za-z0-9/]*/g) ?? []
  for (const m of enMatches) {
    if (m.length >= 2) tokens.add(m)
  }
  // Korean 2 chars+
  const koMatches = text.match(/[가-힯]{2,}/g) ?? []
  for (const m of koMatches) tokens.add(m)
  // CJK (Chinese/Japanese) 2 chars+
  const cjkMatches = text.match(/[一-鿿぀-ヿㇰ-ㇿ]{2,}/g) ?? []
  for (const m of cjkMatches) tokens.add(m)
  // Cyrillic (Russian/Uzbek) 2 chars+
  const cyrMatches = text.match(/[а-яёА-ЯЁ]{2,}/g) ?? []
  for (const m of cyrMatches) tokens.add(m)
  return [...tokens]
}

interface GlossaryHit {
  term_ko: string | null
  term_en: string | null
  definition_ko: string | null
}

async function findGlossaryMatches(text: string): Promise<GlossaryHit[]> {
  const tokens = extractTokens(text)
  if (tokens.length === 0) return []

  // Cap tokens to avoid URL-too-long (414) on very long messages
  const capped = tokens.slice(0, 40)
  const escaped = capped.map(t => `"${t.replace(/"/g, '""')}"`).join(',')

  const { data, error } = await supabaseAdmin
    .from('translation_glossary')
    .select('term_ko, term_en, definition_ko')
    .or(`term_ko.in.(${escaped}),term_en.in.(${escaped})`)
    .limit(20)

  if (error) {
    console.error('[glossary] match error:', error.message)
    return []
  }
  return (data ?? []) as GlossaryHit[]
}

function buildGlossaryContext(hits: GlossaryHit[]): string {
  if (hits.length === 0) return ''
  const lines = hits.slice(0, 15).map(h => {
    const ko  = h.term_ko ?? ''
    const en  = h.term_en ?? ''
    const def = h.definition_ko ? ` — ${h.definition_ko.slice(0, 80)}` : ''
    if (ko && en) return `- "${en}" ↔ "${ko}"${def}`
    if (ko)       return `- "${ko}"${def}`
    if (en)       return `- "${en}"${def}`
    return ''
  }).filter(Boolean)
  if (lines.length === 0) return ''
  return `\n\n[Industry-specific glossary — use these exact translations]\n${lines.join('\n')}`
}

// ─────────────────────────────────────────────────────────────────────────────

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

    // @mention 토큰을 placeholder로 치환 (번역 모델이 수정하지 못하도록)
    const MENTION_RE_GLOBAL = /@[\w가-힣぀-ゟ゠-ヿ]+/g
    const capturedMentions: string[] = []
    const sanitized = source_text.replace(MENTION_RE_GLOBAL, (m) => {
      const idx = capturedMentions.push(m) - 1
      return `__M${idx}__`
    })

    const baseSystemPrompt = `You are a professional translator for MTL Shipping Agency, an international logistics company specializing in ocean, air, and rail freight (Korea ↔ China ↔ Russia ↔ Central Asia ↔ Europe, including TCR/TSR routes). Translate from ${srcName} to ${tgtName}.

Rules:
- Output ONLY the translated text, nothing else
- No explanations, no notes, no questions
- Preserve: numbers, dates, codes (B/L, FCL, ETD, ETA, CY, CFS, THC, TCR, TSR, HS codes, container numbers) exactly
- Preserve @username tokens (format: @word) EXACTLY as-is — never translate or modify them
- Preserve __M{N}__ placeholder tokens EXACTLY as-is — these are protected mention markers
- Translate casual messages naturally (greetings, questions, etc.)
- NEVER respond with explanations or ask for clarification
- ALWAYS output the translation

Critical domain term overrides (ALWAYS use these over general dictionary meanings):
- zh "箱子" = container/컨테이너 (logistics slang for 集装箱, NOT box/상자)
- zh "拖车" = trailer/트레일러
- zh "货代" = freight forwarder/포워더
- zh "报关" = customs clearance/통관
- zh "提单" = B/L (bill of lading/선하증권)
- zh "运费"/"海运费" = ocean freight/해상운임
- zh "司机" = driver/기사
- zh "码头" = terminal/터미널
- zh "堆场" = CY (Container Yard)
- zh "装柜"/"装箱" = container stuffing/컨테이너 적입
- zh "拆柜" = container devanning/컨테이너 적출
- zh "开船" = vessel departure/출항
- zh "到港" = vessel arrival/입항
- zh "货主" = shipper/화주
- zh "收货人" = consignee/수하인
- zh "船公司" = carrier/선사`

    // Glossary matching — inject matched terms into system prompt
    const matches = await findGlossaryMatches(source_text)
    const glossaryContext = buildGlossaryContext(matches)
    const finalSystemPrompt = `${baseSystemPrompt}${glossaryContext}`

    console.log(`[glossary] tokens=${extractTokens(source_text).length}, hits=${matches.length}`)
    if (matches.length > 0) {
      console.log('[glossary] matched:', matches.slice(0, 5).map(m => m.term_en ?? m.term_ko))
    }

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
        system:     finalSystemPrompt,
        messages: [{ role: 'user', content: sanitized }],
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      throw new Error(`Claude API ${claudeRes.status}: ${errText}`)
    }

    const claudeData = await claudeRes.json() as {
      content?: { type: string; text: string }[]
    }
    const rawTranslated = claudeData.content?.[0]?.text?.trim()
    if (!rawTranslated) throw new Error('Empty translation response from Claude')

    // placeholder 복원
    const translated = capturedMentions.length > 0
      ? rawTranslated.replace(/__M(\d+)__/g, (_, i) => capturedMentions[+i] ?? '')
      : rawTranslated

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
