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

function page(emoji: string, title: string, body: string): Response {
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{padding:60px 16px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:center}
.card{max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:48px 32px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.icon{font-size:52px;margin-bottom:20px}
h1{font-size:22px;font-weight:700;color:#111;margin-bottom:10px}
.msg{color:#6b7280;font-size:14px;line-height:1.6}
.foot{margin-top:24px;font-size:12px;color:#9ca3af}
</style>
</head>
<body>
  <div class="card">
    <div class="icon">${emoji}</div>
    <h1>${title}</h1>
    <p class="msg">${body}</p>
    <p class="foot">MTL Link 관리 시스템</p>
  </div>
</body>
</html>`
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    },
  })
}

Deno.serve(async (req: Request) => {
  const url    = new URL(req.url)
  const uid    = url.searchParams.get('uid')    ?? ''
  const action = url.searchParams.get('action') ?? 'approve'
  const sig    = url.searchParams.get('sig')    ?? ''

  const secret = Deno.env.get('APPROVAL_SECRET')
  if (!secret) return page('⚠️', '설정 오류', 'APPROVAL_SECRET 환경변수가 설정되지 않았습니다.')
  if (!uid)    return page('⚠️', '잘못된 링크', '유저 ID가 없습니다.')

  const expected = await sign(`${uid}:${action}`, secret)
  if (sig !== expected) return page('⚠️', '인증 실패', '유효하지 않거나 만료된 링크입니다.')

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const projectUrl = Deno.env.get('SUPABASE_URL') ?? ''

  const newStatus = action === 'reject' ? 'rejected' : 'active'

  const res = await fetch(`${projectUrl}/rest/v1/profiles?id=eq.${uid}`, {
    method: 'PATCH',
    headers: {
      'apikey':         serviceKey,
      'Authorization':  `Bearer ${serviceKey}`,
      'Content-Type':   'application/json',
      'Prefer':         'return=minimal',
    },
    body: JSON.stringify({ status: newStatus }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[approve-user]', res.status, errText)
    return page('⚠️', '처리 실패', `DB 업데이트에 실패했습니다. (${res.status})`)
  }

  // 신청자에게 결과 이메일 발송 (비동기, 실패해도 페이지 응답에 영향 없음)
  const projectUrl2 = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey2 = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  fetch(`${projectUrl2}/functions/v1/send-approval-notification`, {
    method:  'POST',
    headers: {
      'Authorization':  `Bearer ${serviceKey2}`,
      'Content-Type':   'application/json',
    },
    body: JSON.stringify({ userId: uid, action }),
  }).catch(e => console.warn('[approve-user] notification email failed:', e))

  if (action === 'reject') {
    return page('❌', '가입 거절 완료', '해당 사용자의 가입 신청이 거절됐습니다.')
  }
  return page('✅', '승인 완료', '사용자가 성공적으로 승인됐습니다.<br>이제 MTL Link에 로그인할 수 있습니다.')
})
