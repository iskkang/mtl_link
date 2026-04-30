import { createClient } from 'jsr:@supabase/supabase-js@2';
import { transcribeWithWhisper } from './providers/whisper.ts';
import { translateWithClaude }   from './providers/claude.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPPORTED_LANGUAGES = new Set(['ko', 'en', 'ru', 'zh', 'ja', 'uz', 'none']);
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // Whisper API 한도 25MB

function errorResponse(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    // ── 1. 인증 검증 ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse('Unauthorized', 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return errorResponse('Unauthorized', 401);

    // ── 2. FormData 파싱 ──────────────────────────────────────────────────────
    const form           = await req.formData();
    const audioFile      = form.get('audio');
    const targetLanguage = String(form.get('target_language') ?? '').toLowerCase();
    const roomId         = String(form.get('room_id') ?? '').trim();

    if (!(audioFile instanceof File)) {
      return errorResponse('audio field (File) is required', 400);
    }
    if (!SUPPORTED_LANGUAGES.has(targetLanguage)) {
      return errorResponse(
        `invalid target_language. allowed: ${[...SUPPORTED_LANGUAGES].join(', ')}`,
        400,
      );
    }
    if (!roomId) {
      return errorResponse('room_id is required', 400);
    }
    if (audioFile.size > MAX_AUDIO_BYTES) {
      return errorResponse('Audio file exceeds 25MB limit', 413);
    }

    // ── 3. 방 멤버 검증 ──────────────────────────────────────────────────────
    const { data: member } = await userClient
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!member) return errorResponse('Not a member of this room', 403);

    // ── 4. STT — Whisper ─────────────────────────────────────────────────────
    const audioBuffer = await audioFile.arrayBuffer();
    const sttResult   = await transcribeWithWhisper(audioBuffer);

    if (!sttResult.text) {
      return errorResponse('음성에서 텍스트를 인식할 수 없습니다', 422);
    }

    // ── 5. 번역 — Claude Haiku ────────────────────────────────────────────────
    // targetLanguage === 'none' 또는 소스와 같은 언어면 번역 생략
    let translatedText = sttResult.text;
    const shouldTranslate =
      targetLanguage !== 'none' &&
      targetLanguage !== sttResult.language;

    if (shouldTranslate) {
      translatedText = await translateWithClaude({
        text:           sttResult.text,
        sourceLanguage: sttResult.language,
        targetLanguage,
      });
    }

    // audioBuffer는 여기서 참조 해제 — GC가 메모리 회수
    // 음성 파일은 DB / Storage 어디에도 저장하지 않음

    return new Response(
      JSON.stringify({
        ok:               true,
        original_text:    sttResult.text,
        translated_text:  translatedText,
        source_language:  sttResult.language,
        target_language:  targetLanguage === 'none' ? sttResult.language : targetLanguage,
        provider:         shouldTranslate ? 'claude' : null,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[voice-translate]', message);
    return errorResponse(message, 500);
  }
});
