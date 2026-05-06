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
  return new Response(
    `<!DOCTYPE html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:60px 16px;background:#f3f4f6;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:center">
  <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:16px;
              padding:48px 32px;box-shadow:0 4px 24px rgba(0,0,0,.08)">
    <div style="font-size:52px;margin-bottom:20px">${emoji}</div>
    <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#111">${title}</h1>
    <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6">${body}</p>
    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">MTL Link 관리 시스템</p>
  </div>
</body></html>`,
    { headers: { 'Content-Type': 'text/html;charset=utf-8' } },
  )
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

  if (action === 'reject') {
    return page('❌', '가입 거절 완료', '해당 사용자의 가입 신청이 거절됐습니다.')
  }
  return page('✅', '승인 완료', '사용자가 성공적으로 승인됐습니다.<br>이제 MTL Link에 로그인할 수 있습니다.')
})
