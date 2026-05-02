import webpush from 'npm:web-push@3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { roomId, senderId, body: notifBody } = await req.json()

    const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

    // 발신자 이름 조회
    const senderRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${senderId}&select=name`,
      { headers },
    )
    const [sender] = await senderRes.json()
    const title = sender?.name ?? 'MTL Link'

    // 수신 대상 (발신자 제외 방 멤버)
    const membersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/room_members?room_id=eq.${roomId}&user_id=neq.${senderId}&select=user_id`,
      { headers },
    )
    const members: { user_id: string }[] = await membersRes.json()
    if (!members.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userIds = members.map(m => m.user_id).join(',')

    // 해당 유저들의 푸시 구독 조회
    const subsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=in.(${userIds})&select=endpoint,p256dh,auth`,
      { headers },
    )
    const subscriptions: { endpoint: string; p256dh: string; auth: string }[] = await subsRes.json()
    if (!subscriptions.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT')!,
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    )

    const payload = JSON.stringify({ title, body: notifBody, roomId, url: `/?room=${roomId}` })

    const results = await Promise.allSettled(
      subscriptions.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
      ),
    )

    // 만료된 구독(410/404) 자동 정리
    const expired = subscriptions.filter((_, i) => {
      const r = results[i]
      if (r.status === 'rejected') {
        const status = (r.reason as { statusCode?: number })?.statusCode
        return status === 410 || status === 404
      }
      return false
    })
    if (expired.length) {
      const epList = expired.map(s => `"${s.endpoint}"`).join(',')
      await fetch(
        `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=in.(${epList})`,
        { method: 'DELETE', headers },
      )
    }

    const sent = results.filter(r => r.status === 'fulfilled').length
    return new Response(
      JSON.stringify({ ok: true, sent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error('[send-push-notification]', e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
