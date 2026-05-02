// Cron Edge Function — 매시간 실행
// Schedule: 0 * * * * (매 정시)
// 24시간 이상 미답변 메시지 발신자에게 Web Push 알림 발송

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

Deno.serve(async (req) => {
  // CRON_SECRET 검증
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret && req.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT')!,
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const renotifyCutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()

  // 24시간 이상 미답변 메시지 조회
  const { data: pendingMessages, error } = await supabase
    .from('messages')
    .select('id, sender_id, room_id, content, created_at, followup_reminded_at')
    .eq('needs_response', true)
    .eq('response_received', false)
    .is('deleted_at', null)
    .lt('created_at', cutoff)

  if (error) {
    console.error('[followup-reminder] query error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  if (!pendingMessages || pendingMessages.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  // 6시간 이내에 이미 알림을 보낸 메시지 제외
  const toNotify = pendingMessages.filter(m =>
    !m.followup_reminded_at || m.followup_reminded_at < renotifyCutoff
  )

  if (toNotify.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  // 사용자별로 그룹화
  const bySender: Record<string, typeof toNotify> = {}
  for (const msg of toNotify) {
    if (!bySender[msg.sender_id]) bySender[msg.sender_id] = []
    bySender[msg.sender_id].push(msg)
  }

  let sent = 0

  for (const [userId, messages] of Object.entries(bySender)) {
    // push_subscriptions 조회
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (!subs || subs.length === 0) continue

    const count = messages.length
    const body  = count === 1
      ? `"${messages[0].content?.slice(0, 50) ?? '…'}" 에 아직 답변이 없습니다`
      : `${count}개의 질문이 24시간 넘게 답변되지 않았습니다`

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: 'MTL Link — 답변 대기', body, url: '/' }),
          { contentEncoding: 'aes128gcm', TTL: 3600 },
        )
        sent++
      } catch (err) {
        console.warn('[followup-reminder] push failed:', err)
      }
    }

    // followup_reminded_at 업데이트 (중복 알림 방지)
    await supabase
      .from('messages')
      .update({ followup_reminded_at: new Date().toISOString() })
      .in('id', messages.map(m => m.id))
  }

  return new Response(JSON.stringify({ sent }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
