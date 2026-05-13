// supabase/functions/daily-briefing/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getLocale } from './locales.ts'

const BOT_USER_ID = '00000000-0000-0000-0000-000000000001'

interface BriefingItem {
  category: 'deadline' | 'action' | 'pending' | 'alert'
  title: string
  description: string
  source_message_id: string | null
  source_room_id: string | null
  source_room_name: string | null
  due_at: string | null
  priority: 'high' | 'medium' | 'low'
}

interface MessageRow {
  id: string
  room_id: string
  room_name: string
  sender_id: string
  sender_name: string
  content: string
  created_at: string
}

// deno-lint-ignore no-explicit-any
async function getOrCreateMintRoom(db: any, userId: string): Promise<string> {
  const { data: existing } = await db
    .from('room_members')
    .select('room_id, rooms!inner(room_type)')
    .eq('user_id', userId)
    .eq('rooms.room_type', 'mint_dm')
    .maybeSingle() as { data: { room_id: string } | null }

  if (existing?.room_id) return existing.room_id

  const { data: newRoom } = await db
    .from('rooms')
    .insert({ room_type: 'mint_dm' })
    .select()
    .single() as { data: { id: string } }

  await db.from('room_members').insert([
    { room_id: newRoom.id, user_id: userId },
    { room_id: newRoom.id, user_id: BOT_USER_ID },
  ])

  return newRoom.id
}

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const openaiKey   = Deno.env.get('OPENAI_API_KEY')!

  const db    = createClient(supabaseUrl, serviceKey)
  const today = new Date().toISOString().split('T')[0]
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: users } = await db
    .from('profiles')
    .select('id, name, preferred_language')
    .eq('is_bot', false) as { data: { id: string; name: string; preferred_language: string | null }[] | null }

  if (!users?.length) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const results: unknown[] = []

  for (const user of users) {
    try {
      const { data: existing } = await db
        .from('ai_briefings')
        .select('id')
        .eq('user_id', user.id)
        .eq('briefing_date', today)
        .maybeSingle()

      if (existing) {
        results.push({ user_id: user.id, status: 'skipped' })
        continue
      }

      const { data: messages } = await db.rpc('get_user_related_messages', {
        p_user_id: user.id,
        p_since: since,
        p_limit: 200,
      }) as { data: MessageRow[] | null }

      const msgs = messages ?? []
      if (msgs.length === 0) {
        results.push({ user_id: user.id, status: 'no_messages' })
        continue
      }

      const locale    = getLocale(user.preferred_language)
      const formatted = msgs
        .map(m => `[${m.id}] (${m.room_name}, ${m.sender_name}, ${m.created_at}) ${m.content}`)
        .join('\n')

      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: locale.systemPrompt },
            { role: 'user',   content: `직원: ${user.name}\n\n메시지:\n${formatted}` },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
      })

      if (!aiRes.ok) {
        console.error(`[daily-briefing] OpenAI error for ${user.id}:`, await aiRes.text())
        results.push({ user_id: user.id, status: 'openai_error' })
        continue
      }

      const aiData = await aiRes.json() as {
        choices: { message: { content: string } }[]
        usage?: { total_tokens: number }
      }
      const parsed = JSON.parse(aiData.choices[0].message.content) as { items: BriefingItem[] }
      const items  = parsed.items ?? []

      if (items.length === 0) {
        results.push({ user_id: user.id, status: 'no_items' })
        continue
      }

      const { data: briefing, error: insertErr } = await db
        .from('ai_briefings')
        .insert({
          user_id:       user.id,
          briefing_date: today,
          items,
          message_count: msgs.length,
          tokens_used:   aiData.usage?.total_tokens ?? 0,
        })
        .select()
        .single()

      if (insertErr || !briefing) {
        console.error(`[daily-briefing] insert error for ${user.id}:`, insertErr)
        results.push({ user_id: user.id, status: 'insert_error' })
        continue
      }

      const mintRoomId = await getOrCreateMintRoom(db, user.id)

      const { data: msg } = await db
        .from('messages')
        .insert({
          room_id:      mintRoomId,
          sender_id:    BOT_USER_ID,
          message_type: 'mint_briefing',
          payload: {
            briefing_id:   briefing.id,
            locale:        user.preferred_language ?? 'ko',
            greeting:      locale.greeting(user.name),
            summary:       locale.summary(msgs.length, items.length),
            message_count: msgs.length,
            items,
          },
          content: locale.greeting(user.name),
        })
        .select()
        .single()

      if (msg) {
        await db
          .from('ai_briefings')
          .update({
            delivered_at:         new Date().toISOString(),
            delivered_message_id: msg.id,
          })
          .eq('id', briefing.id)
      }

      results.push({ user_id: user.id, items: items.length, status: 'ok' })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[daily-briefing] error for ${user.id}:`, errMsg)
      results.push({ user_id: user.id, status: 'failed', error: errMsg })
    }
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
