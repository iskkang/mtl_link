const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API = 'https://api.resend.com/emails'
const FROM_EMAIL = 'onboarding@resend.dev'
const APP_NAME   = 'MTL Link'
const APP_URL    = Deno.env.get('APP_URL') ?? 'https://mtllink.vercel.app'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })

  try {
    const { userId, action } = await req.json() as {
      userId: string
      action: 'approve' | 'reject'
    }

    if (!userId || !action) return json({ error: 'userId and action are required' }, 400)

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      console.warn('[send-approval-notification] RESEND_API_KEY not set — skipping')
      return json({ ok: true, sent: false, warn: 'RESEND_API_KEY not configured' })
    }

    // 신청자 프로필 조회
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const projectUrl = Deno.env.get('SUPABASE_URL') ?? ''

    const profileRes = await fetch(
      `${projectUrl}/rest/v1/profiles?id=eq.${userId}&select=name,email`,
      {
        headers: {
          'apikey':        serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
      },
    )
    const profiles = await profileRes.json()
    const profile  = profiles?.[0]

    if (!profile?.email) {
      console.warn('[send-approval-notification] profile not found for', userId)
      return json({ ok: true, sent: false, warn: 'profile not found' })
    }

    const isApproved = action === 'approve'
    const subject    = isApproved
      ? `[${APP_NAME}] 가입이 승인됐습니다`
      : `[${APP_NAME}] 가입 신청이 거절됐습니다`

    const resendRes = await fetch(RESEND_API, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    `${APP_NAME} <${FROM_EMAIL}>`,
        to:      [profile.email],
        subject,
        html:    buildHtml({ name: profile.name, email: profile.email, isApproved }),
      }),
    })

    if (!resendRes.ok) {
      const errText = await resendRes.text()
      throw new Error(`Resend ${resendRes.status}: ${errText}`)
    }

    console.info(`[send-approval-notification] ${action} email sent to ${profile.email}`)
    return json({ ok: true, sent: true })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[send-approval-notification]', msg)
    return json({ error: msg }, 500)
  }
})

function buildHtml(p: { name: string; email: string; isApproved: boolean }): string {
  if (p.isApproved) {
    return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background:#f3f4f6;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:0 auto">

    <div style="background:linear-gradient(135deg,#134e4a 0%,#14b8a6 100%);
                border-radius:12px 12px 0 0;padding:24px 32px">
      <p style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:.5px">
        MTL Link
      </p>
      <p style="margin:4px 0 0;color:rgba(255,255,255,.65);font-size:12px">
        MTL Shipping Agency
      </p>
    </div>

    <div style="background:#fff;padding:36px 32px;
                border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
      <div style="text-align:center;margin-bottom:28px">
        <div style="display:inline-flex;align-items:center;justify-content:center;
                    width:64px;height:64px;border-radius:50%;
                    background:#f0fdf4;font-size:32px;margin-bottom:16px">✅</div>
        <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827">
          가입이 승인됐습니다!
        </h2>
        <p style="margin:0;font-size:14px;color:#6b7280">
          안녕하세요, <strong style="color:#111827">${p.name}</strong>님.<br>
          MTL Link 가입 신청이 승인됐습니다.
        </p>
      </div>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;
                  padding:20px 24px;margin-bottom:28px">
        <p style="margin:0;font-size:14px;color:#166534;line-height:1.7">
          이제 아래 버튼을 클릭해 MTL Link에 로그인하실 수 있습니다.<br>
          가입 시 설정하신 이메일과 비밀번호를 사용하세요.
        </p>
      </div>

      <div style="text-align:center;margin-bottom:28px">
        <a href="${APP_URL}"
           style="display:inline-block;background:#0d9488;color:#fff;
                  text-decoration:none;padding:14px 40px;border-radius:10px;
                  font-size:15px;font-weight:700;letter-spacing:.3px">
          MTL Link 로그인하기 →
        </a>
      </div>

      <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center">
        로그인 주소: <a href="${APP_URL}" style="color:#0d9488">${APP_URL}</a>
      </p>
    </div>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;
                border-radius:0 0 12px 12px;padding:16px 32px;text-align:center">
      <p style="margin:0;font-size:11px;color:#9ca3af">
        이 메일은 MTL Link 시스템에서 자동 발송됐습니다 · 회신하지 마세요
      </p>
    </div>
  </div>
</body>
</html>`
  }

  // 거절
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background:#f3f4f6;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:0 auto">

    <div style="background:linear-gradient(135deg,#134e4a 0%,#14b8a6 100%);
                border-radius:12px 12px 0 0;padding:24px 32px">
      <p style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:.5px">
        MTL Link
      </p>
      <p style="margin:4px 0 0;color:rgba(255,255,255,.65);font-size:12px">
        MTL Shipping Agency
      </p>
    </div>

    <div style="background:#fff;padding:36px 32px;
                border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
      <div style="text-align:center;margin-bottom:28px">
        <div style="display:inline-flex;align-items:center;justify-content:center;
                    width:64px;height:64px;border-radius:50%;
                    background:#fef2f2;font-size:32px;margin-bottom:16px">❌</div>
        <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827">
          가입 신청이 거절됐습니다
        </h2>
        <p style="margin:0;font-size:14px;color:#6b7280">
          안녕하세요, <strong style="color:#111827">${p.name}</strong>님.<br>
          아쉽게도 가입 신청이 승인되지 않았습니다.
        </p>
      </div>

      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;
                  padding:20px 24px;margin-bottom:16px">
        <p style="margin:0;font-size:14px;color:#991b1b;line-height:1.7">
          문의 사항이 있으시면 회사 관리자에게 직접 연락해 주세요.
        </p>
      </div>
    </div>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;
                border-radius:0 0 12px 12px;padding:16px 32px;text-align:center">
      <p style="margin:0;font-size:11px;color:#9ca3af">
        이 메일은 MTL Link 시스템에서 자동 발송됐습니다 · 회신하지 마세요
      </p>
    </div>
  </div>
</body>
</html>`
}
