export interface WhisperResult {
  text: string;
  language: string;
}

/** Whisper 언어 코드 → 내부 코드 정규화 */
function normalizeLanguage(lang: string): string {
  const map: Record<string, string> = {
    korean:   'ko', ko: 'ko',
    english:  'en', en: 'en',
    russian:  'ru', ru: 'ru',
    chinese:  'zh', zh: 'zh',
    japanese: 'ja', ja: 'ja',
    uzbek:    'uz', uz: 'uz',
  };
  return map[lang.toLowerCase()] ?? 'en';
}

/**
 * OpenAI Whisper API로 음성 → 텍스트 변환
 * @param audio  ArrayBuffer (webm/opus)
 */
export async function transcribeWithWhisper(audio: ArrayBuffer): Promise<WhisperResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const form = new FormData();
  form.append('file', new Blob([audio], { type: 'audio/webm' }), 'voice.webm');
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Whisper API error (${res.status}): ${detail}`);
  }

  const data = await res.json();
  return {
    text:     String(data.text ?? '').trim(),
    language: normalizeLanguage(String(data.language ?? 'en')),
  };
}
