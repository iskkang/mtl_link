const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API = 'https://api.resend.com/emails'
const FROM_EMAIL = 'noreply@mtlb.co.kr'
const APP_NAME   = 'MTL Link'

async function sign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })

  try {
    const { userId, name, email, department } = await req.json() as {
      userId?:     string
      name:        string
      email:       string
      department?: string
    }

    if (!name || !email) return json({ error: 'name and email are required' }, 400)

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      console.warn('[send-signup-notification] RESEND_API_KEY not set — skipping email')
      return json({ ok: true, sent: 0, warn: 'RESEND_API_KEY not configured' })
    }

    const adminEmailEnv = Deno.env.get('ADMIN_EMAIL')
    if (!adminEmailEnv) {
      console.warn('[send-signup-notification] ADMIN_EMAIL not set — skipping email')
      return json({ ok: true, sent: 0, warn: 'ADMIN_EMAIL not configured' })
    }
    const adminEmails = adminEmailEnv.split(',').map(e => e.trim()).filter(Boolean)
    if (adminEmails.length === 0) return json({ ok: true, sent: 0 })

    // 승인/거절 링크 생성
    const approvalSecret = Deno.env.get('APPROVAL_SECRET')
    const projectUrl     = Deno.env.get('SUPABASE_URL') ?? ''
    const functionsBase  = `${projectUrl}/functions/v1`

    let approveUrl = ''
    let rejectUrl  = ''
    if (userId && approvalSecret) {
      const approveSig = await sign(`${userId}:approve`, approvalSecret)
      const rejectSig  = await sign(`${userId}:reject`,  approvalSecret)
      approveUrl = `${functionsBase}/approve-user?uid=${userId}&action=approve&sig=${approveSig}`
      rejectUrl  = `${functionsBase}/approve-user?uid=${userId}&action=reject&sig=${rejectSig}`
    }

    const resendRes = await fetch(RESEND_API, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    `${APP_NAME} <${FROM_EMAIL}>`,
        to:      adminEmails,
        subject: `[${APP_NAME}] 새 가입 신청 — ${name}`,
        html:    buildHtml({ name, email, department, approveUrl, rejectUrl }),
      }),
    })

    if (!resendRes.ok) {
      const errText = await resendRes.text()
      throw new Error(`Resend ${resendRes.status}: ${errText}`)
    }

    console.info(`[send-signup-notification] sent to ${adminEmails.length} admin(s) for ${email}`)
    return json({ ok: true, sent: adminEmails.length })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[send-signup-notification]', msg)
    return json({ error: msg }, 500)
  }
})

// ─── HTML 이메일 빌더 ────────────────────────────────────────────────────────

function buildHtml(p: {
  name:        string
  email:       string
  department?: string
  approveUrl:  string
  rejectUrl:   string
}): string {
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 14px;font-weight:600;color:#374151;white-space:nowrap;
                 background:#f9fafb;border-bottom:1px solid #e5e7eb;width:80px">${label}</td>
      <td style="padding:10px 14px;color:#111827;background:#f9fafb;
                 border-bottom:1px solid #e5e7eb">${value}</td>
    </tr>`

  const actionButtons = p.approveUrl ? `
      <div style="margin-top:28px;display:flex;gap:12px;justify-content:center">
        <a href="${p.approveUrl}"
           style="display:inline-block;background:#16a34a;color:#fff;
                  text-decoration:none;padding:12px 32px;border-radius:8px;
                  font-size:14px;font-weight:600;letter-spacing:.3px">
          ✅ 승인
        </a>
        <a href="${p.rejectUrl}"
           style="display:inline-block;background:#dc2626;color:#fff;
                  text-decoration:none;padding:12px 32px;border-radius:8px;
                  font-size:14px;font-weight:600;letter-spacing:.3px">
          ❌ 거절
        </a>
      </div>` : `
      <div style="margin-top:28px;text-align:center">
        <p style="font-size:13px;color:#9ca3af">관리자 페이지에서 직접 승인해 주세요.</p>
      </div>`

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background:#f3f4f6;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:0 auto">

    <div style="background:linear-gradient(135deg,#0f3460 0%,#00b4d8 100%);
                border-radius:12px 12px 0 0;padding:24px 32px">
      <p style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:.5px">
        ⚓ MTL Link
      </p>
      <p style="margin:4px 0 0;color:rgba(255,255,255,.65);font-size:12px">
        Maritime Team Link
      </p>
    </div>

    <div style="background:#fff;padding:32px;border-left:1px solid #e5e7eb;
                border-right:1px solid #e5e7eb">
      <h2 style="margin:0 0 8px;font-size:16px;font-weight:700;color:#111827">
        새 가입 신청이 있습니다
      </h2>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6">
        아래 사용자가 MTL Link 가입을 신청했습니다.<br>
        승인 또는 거절 버튼을 눌러 처리해 주세요.
      </p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;
                    border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
        ${row('이름', p.name)}
        ${row('이메일', p.email)}
        ${p.department ? row('소속', p.department) : ''}
      </table>

      ${actionButtons}
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
