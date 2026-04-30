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
      system: [
        `Translate the following ${srcName} text to ${tgtName}.`,
        'Preserve business tone and proper nouns (company names, port names, product codes, container numbers).',
        'Output ONLY the translated text, with no explanation or prefix.',
      ].join(' '),
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
