// Cron Edge Function — 매일 오전 9:00 KST 실행
// supabase schedule: "0 0 * * *" (UTC 00:00 = KST 09:00)
// Sends push notifications to users who have pending action items due today or overdue

Deno.serve(async (req) => {
  const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const dbHeaders     = {
    apikey:        SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  }

  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get('Authorization')
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const now = new Date()
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

  // Fetch all pending/snoozed tasks due today or overdue, with assignee
  const tasksRes = await fetch(
    `${SUPABASE_URL}/rest/v1/action_items` +
    `?status=in.(pending,snoozed)` +
    `&due_date=lte.${endOfToday}` +
    `&select=id,title,due_date,assigned_to,assignee:profiles!action_items_assigned_to_fkey(id,name)`,
    { headers: dbHeaders },
  )
  const tasks = await tasksRes.json()
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  // Group by assignee
  const byUser: Record<string, { userId: string; tasks: { title: string; due_date: string | null }[] }> = {}
  for (const task of tasks) {
    const uid = task.assigned_to
    if (!byUser[uid]) byUser[uid] = { userId: uid, tasks: [] }
    byUser[uid].tasks.push({ title: task.title, due_date: task.due_date })
  }

  let sent = 0

  for (const { userId, tasks: userTasks } of Object.values(byUser)) {
    // Fetch push subscriptions for this user
    const subsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${userId}&select=endpoint,p256dh,auth`,
      { headers: dbHeaders },
    )
    const subs = await subsRes.json()
    if (!Array.isArray(subs) || subs.length === 0) continue

    const overdueCount = userTasks.filter(t => t.due_date && new Date(t.due_date) < now).length
    const todayCount   = userTasks.length - overdueCount

    const body = [
      overdueCount > 0 ? `마감 지남 ${overdueCount}개` : '',
      todayCount   > 0 ? `오늘 마감 ${todayCount}개` : '',
    ].filter(Boolean).join(' · ')

    // Send via send-push-notification function (re-use existing webpush logic)
    // We call the function for each user's tasks as a summary push
    for (const sub of subs) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: { ...dbHeaders, Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            p256dh:   sub.p256dh,
            auth:     sub.auth,
            title:    'MTL Link — 할 일 요약',
            body,
            icon:     '/icons/icon-192x192.png',
          }),
        })
        sent++
      } catch (e) {
        console.warn('[daily-task-summary] push failed:', e)
      }
    }
  }

  return new Response(JSON.stringify({ sent }), { status: 200 })
})
