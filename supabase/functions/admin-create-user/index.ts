import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserInput {
  email: string;
  name: string;
  department?: string;
  position?: string;
}

function errorResponse(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    },
  );
}

function generateTempPassword(): string {
  const upper  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower  = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%';
  const all    = upper + lower + digits + special;

  const rand = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const base = [rand(upper), rand(lower), rand(digits), rand(special)];
  for (let i = 0; i < 6; i++) base.push(rand(all));

  // Fisher-Yates shuffle
  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    // ── 1. 호출자 인증 검증 ──────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse('Unauthorized', 401);

    const supabaseUrl     = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey         = Deno.env.get('SUPABASE_ANON_KEY')!;

    // 호출자 세션 검증용 클라이언트 (anon key + 호출자 토큰)
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) return errorResponse('Unauthorized', 401);

    // ── 2. 관리자 권한 확인 ──────────────────────────────────────────────────
    const { data: callerProfile, error: profileError } = await callerClient
      .from('profiles')
      .select('is_admin')
      .eq('id', caller.id)
      .single();

    if (profileError || !callerProfile?.is_admin) {
      return errorResponse('Forbidden: admin only', 403);
    }

    // ── 3. 입력 검증 ─────────────────────────────────────────────────────────
    const body: CreateUserInput = await req.json();

    if (!body.email || !body.name) {
      return errorResponse('email and name are required', 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return errorResponse('Invalid email format', 400);
    }

    // ── 4. 신규 사용자 생성 (Service Role Key) ────────────────────────────────
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const tempPassword = generateTempPassword();

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: body.email,
      password: tempPassword,
      email_confirm: true,          // 이메일 인증 생략 (관리자 초대 방식)
      user_metadata: {
        name: body.name,
        must_change_password: true,
      },
    });

    if (createError) {
      if (createError.message.includes('already registered')) {
        return errorResponse('이미 등록된 이메일입니다', 409);
      }
      throw createError;
    }

    // ── 5. profiles 추가 정보 업데이트 ───────────────────────────────────────
    // handle_new_user 트리거가 profiles 기본 레코드를 생성하지만
    // department / position 은 트리거에 없으므로 여기서 업데이트
    if (body.department || body.position) {
      await adminClient
        .from('profiles')
        .update({
          department: body.department ?? null,
          position:   body.position   ?? null,
        })
        .eq('id', newUser.user!.id);
    }

    // ── 6. 임시 비밀번호 안내 메일 ───────────────────────────────────────────
    // Supabase 기본 Auth 이메일 대신 커스텀 메일이 필요하면 Resend 등으로 교체
    // 현재는 응답에 temp_password를 포함해 관리자가 직접 전달하는 방식
    return new Response(
      JSON.stringify({
        ok:            true,
        user_id:       newUser.user!.id,
        email:         body.email,
        temp_password: tempPassword,
        message:       '직원이 생성되었습니다. 임시 비밀번호를 안전하게 전달하세요.',
      }),
      {
        status: 201,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin-create-user]', message);
    return errorResponse(message, 500);
  }
});
