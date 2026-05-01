const LANGUAGE_NAMES: Record<string, string> = {
  ko: 'Korean',
  en: 'English',
  ru: 'Russian',
  zh: 'Chinese',
  ja: 'Japanese',
  uz: 'Uzbek',
};

interface TranslateInput {
  text:           string;
  sourceLanguage: string;
  targetLanguage: string;
}

/**
 * Anthropic Claude Haiku로 텍스트 번역
 * 비즈니스 어조·고유명사(회사명·항구명·제품코드) 보존
 */
export async function translateWithClaude({
  text,
  sourceLanguage,
  targetLanguage,
}: TranslateInput): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const srcName = LANGUAGE_NAMES[sourceLanguage] ?? sourceLanguage;
  const tgtName = LANGUAGE_NAMES[targetLanguage] ?? targetLanguage;

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

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system:   systemPrompt,
      messages: [{ role: 'user', content: text }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Claude API error (${res.status}): ${detail}`);
  }

  const data = await res.json();
  const translated = String(data?.content?.[0]?.text ?? '').trim();
  if (!translated) throw new Error('Claude returned empty translation');
  return translated;
}
