import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MENTION_PREFIX: Record<string, string> = {
  ko: '멘션됨',
  en: 'Mentioned you',
  ru: 'Упомянул вас',
  uz: "Sizni eslatib o'tdi",
  zh: '提到了你',
  ja: 'あなたをメンション',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { roomId, senderId, body: notifBody, mentions = [] } = await req.json()
    console.log('[push] roomId:', roomId, 'senderId:', senderId, 'mentions:', mentions.length)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const dbHeaders    = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

    // 발신자 이름 조회
    const senderRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${senderId}&select=name`,
      { headers: dbHeaders },
    )
    const [sender] = await senderRes.json()
    const title = sender?.name ?? 'MTL Link'
    console.log('[push] sender name:', title)

    // 수신 대상 (발신자 제외 방 멤버)
    const membersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/room_members?room_id=eq.${roomId}&user_id=neq.${senderId}&select=user_id`,
      { headers: dbHeaders },
    )
    const members: { user_id: string }[] = await membersRes.json()
    console.log('[push] target members:', members.length)

    if (!members.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userIds = members.map(m => m.user_id).join(',')

    // 멘션된 수신자의 preferred_language 조회 (prefix 언어 결정용)
    const mentionedIds: string[] = (mentions as string[]).filter((uid: string) =>
      members.some(m => m.user_id === uid),
    )
    let langMap: Record<string, string> = {}
    if (mentionedIds.length > 0) {
      const profilesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=in.(${mentionedIds.join(',')})&select=id,preferred_language`,
        { headers: dbHeaders },
      )
      const profiles: { id: string; preferred_language: string }[] = await profilesRes.json()
      langMap = Object.fromEntries(profiles.map(p => [p.id, p.preferred_language]))
    }

    // 해당 유저들의 푸시 구독 조회 (user_id 포함)
    const subsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=in.(${userIds})&select=user_id,endpoint,p256dh,auth`,
      { headers: dbHeaders },
    )
    const subscriptions: { user_id: string; endpoint: string; p256dh: string; auth: string }[] = await subsRes.json()
    console.log('[push] push_subscriptions found:', subscriptions.length)

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

    const results = await Promise.allSettled(
      subscriptions.map(sub => {
        const isMentioned = (mentions as string[]).includes(sub.user_id)
        const lang        = langMap[sub.user_id] ?? 'ko'
        const prefix      = isMentioned ? (MENTION_PREFIX[lang] ?? MENTION_PREFIX.en) : null
        const body        = prefix ? `[${prefix}] ${notifBody}` : notifBody
        const payload     = JSON.stringify({ title, body, roomId, url: `/?room=${roomId}` })

        return webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { contentEncoding: 'aes128gcm' },
        )
      }),
    )

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[push] sub[${i}] failed:`, r.reason)
      }
    })

    // 만료된 구독(410/404) 자동 정리
    const expiredEndpoints = subscriptions
      .filter((_, i) => {
        const r = results[i]
        if (r.status !== 'rejected') return false
        const status = (r.reason as { statusCode?: number })?.statusCode
        return status === 410 || status === 404
      })
      .map(s => s.endpoint)

    if (expiredEndpoints.length) {
      console.log('[push] Cleaning up', expiredEndpoints.length, 'expired subscriptions')
      const epParam = expiredEndpoints.map(e => `"${e}"`).join(',')
      await fetch(
        `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=in.(${epParam})`,
        { method: 'DELETE', headers: dbHeaders },
      )
    }

    const sent = results.filter(r => r.status === 'fulfilled').length
    console.log('[push] sent:', sent, '/', subscriptions.length)

    return new Response(
      JSON.stringify({ ok: true, sent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error('[push] unhandled error:', e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
