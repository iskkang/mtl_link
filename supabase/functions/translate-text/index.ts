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

    const systemPrompt = `You are an expert logistics and international trade translator.

TRANSLATION RULES:
1. Preserve these terms exactly (do not translate):
   - Port names: Busan, Incheon, Shanghai, Tashkent, Vladivostok, Tokyo, etc.
   - Company names and brand names
   - Cargo codes, container numbers (e.g. MAEU1234567)
   - Document codes: B/L, AWB, MBL, HBL, FCL, LCL, ETD, ETA, POL, POD

2. Use industry-standard translations:
   Korean → Target Language standard logistics terms:
   - 통관 → Customs clearance / Таможенное оформление / Bojxona rasmiylashtiruvi / 清关 / 通関
   - 선적 → Shipment / Отгрузка / Yuklash / 装船 / 船積み
   - 수금 → Collection / Получение оплаты / To'lov olish / 收款 / 集金
   - 화물 → Cargo / Груз / Yuk / 货物 / 貨物
   - 운임 → Freight / Фрахт / Yuk haqi / 运费 / 運賃
   - 견적 → Quotation / Коммерческое предложение / Taklif / 报价 / 見積もり
   - 서류 → Documents / Документы / Hujjatlar / 文件 / 書類
   - 인보이스 → Invoice / Инвойс / Hisob-faktura / 发票 / インボイス
   - 포워더 → Freight forwarder / Экспедитор / Ekspeditor / 货代 / フォワーダー
   - 창고 → Warehouse / Склад / Ombor / 仓库 / 倉庫
   - 도착 → Arrival / Прибытие / Kelish / 到达 / 到着
   - 출발 → Departure / Отправление / Ketish / 出发 / 出発
   - 통보 → Notification / Уведомление / Bildirishnoma / 通知 / 通知
   - 수입 → Import / Импорт / Import / 进口 / 輸入
   - 수출 → Export / Экспорт / Eksport / 出口 / 輸出

3. Maintain professional business tone
4. Keep numbers, dates, and measurements exactly as written
5. Output ONLY the translated text, nothing else

Translate from ${srcName} to ${tgtName}:`

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
        system:   systemPrompt,
        messages: [{ role: 'user', content: source_text }],
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
