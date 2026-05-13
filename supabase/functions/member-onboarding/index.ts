// supabase/functions/member-onboarding/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getLocale } from './locales.ts'

const BOT_USER_ID = '00000000-0000-0000-0000-000000000001'
const GPT_THRESHOLD = 5    // 메시지 수 기준으로 GPT 사용 여부 결정
const MSG_LIMIT     = 100  // GPT에 넘길 최대 메시지 수

interface Payload {
  room_id: string
  user_id: string
}

// deno-lint-ignore no-explicit-any
type DB = any

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const openaiKey   = Deno.env.get('OPENAI_API_KEY')!

  const db: DB = createClient(supabaseUrl, serviceKey)

  let payload: Payload
  try {
    payload = await req.json() as Payload
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }

  const { room_id, user_id } = payload

  if (!room_id || !user_id) {
    return new Response(JSON.stringify({ error: 'room_id and user_id required' }), { status: 400 })
  }

  const result = await handleOnboarding(db, openaiKey, room_id, user_id)

  console.log('[member-onboarding]', JSON.stringify(result))

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  })
})

async function handleOnboarding(
  db: DB,
  openaiKey: string,
  room_id: string,
  user_id: string,
): Promise<Record<string, unknown>> {

  // 1. 봇 자기 자신이면 skip
  if (user_id === BOT_USER_ID) {
    console.log('[member-onboarding] skipped: bot self')
    return { status: 'skipped_bot' }
  }

  // 2. 채널 정보 확인
  const { data: room, error: roomErr } = await db
    .from('rooms')
    .select('id, name, room_type')
    .eq('id', room_id)
    .single() as { data: { id: string; name: string; room_type: string } | null; error: unknown }

  if (roomErr || !room) {
    console.error('[member-onboarding] room fetch error:', roomErr)
    return { status: 'room_not_found', room_id }
  }

  if (room.room_type !== 'channel') {
    console.log('[member-onboarding] skipped: not a channel, type=', room.room_type)
    return { status: 'skipped_not_channel' }
  }

  // 3. 이 채널에 신규 멤버 외 다른 사람이 있는지 확인 (봇 제외)
  const { data: otherMembers } = await db
    .from('room_members')
    .select('user_id')
    .eq('room_id', room_id)
    .neq('user_id', user_id)
    .neq('user_id', BOT_USER_ID) as { data: { user_id: string }[] | null }

  if (!otherMembers || otherMembers.length === 0) {
    console.log('[member-onboarding] skipped: first member (no other non-bot members)')
    return { status: 'skipped_first_member' }
  }

  // 4. 신규 멤버 프로필 조회 (이름 + 언어)
  const { data: userProfile } = await db
    .from('profiles')
    .select('name, preferred_language')
    .eq('id', user_id)
    .single() as { data: { name: string; preferred_language: string | null } | null }

  const userName = userProfile?.name ?? 'Member'
  const lang     = userProfile?.preferred_language ?? 'ko'
  const locale   = getLocale(lang)

  console.log(`[member-onboarding] user=${userName} lang=${lang} channel=${room.name}`)

  // 5. 채널 최근 30일 메시지 fetch (봇 제외, 텍스트만)
  const since = new Date()
  since.setDate(since.getDate() - 30)

  const { data: messages } = await db
    .from('messages')
    .select('id, content, sender:profiles!sender_id(name), created_at')
    .eq('room_id', room_id)
    .eq('message_type', 'text')
    .is('deleted_at', null)
    .gte('created_at', since.toISOString())
    .neq('sender_id', BOT_USER_ID)
    .order('created_at', { ascending: false })
    .limit(150) as { data: Array<{ id: string; content: string | null; sender: { name: string } | null; created_at: string }> | null }

  const msgCount = messages?.length ?? 0
  console.log(`[member-onboarding] fetched ${msgCount} messages from last 30 days`)

  // 6. 메시지 수에 따라 분기
  let messageContent: string
  let usedGpt = false

  if (msgCount < GPT_THRESHOLD) {
    // 간단한 인사만 (GPT 호출 없음)
    messageContent = locale.simpleGreeting(userName, room.name ?? '')
    console.log('[member-onboarding] using simple greeting (low message count)')
  } else {
    // GPT-4o-mini로 컨텍스트 요약
    const formatted = (messages ?? [])
      .slice(0, MSG_LIMIT)
      .reverse()
      .map(m => `${m.sender?.name ?? '?'}: ${m.content ?? ''}`)
      .join('\n')

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          model:      'gpt-4o-mini',
          messages:   [
            { role: 'system', content: locale.systemPrompt },
            { role: 'user',   content: locale.userPrompt(userName, room.name ?? '', formatted) },
          ],
          max_tokens:  600,
          temperature: 0.7,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`OpenAI ${res.status}: ${errText}`)
      }

      const json = await res.json() as {
        choices: Array<{ message: { content: string } }>
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
      }

      messageContent = json.choices[0].message.content ?? locale.simpleGreeting(userName, room.name ?? '')
      usedGpt = true
      console.log(`[member-onboarding] GPT tokens used: ${JSON.stringify(json.usage ?? {})}`)
    } catch (err) {
      // GPT 실패 시 간단한 인사로 폴백
      console.error('[member-onboarding] GPT error, falling back to simple greeting:', err)
      messageContent = locale.simpleGreeting(userName, room.name ?? '')
    }
  }

  // 7. MINT 발신 메시지 INSERT
  const { error: insertErr } = await db
    .from('messages')
    .insert({
      room_id,
      sender_id:    BOT_USER_ID,
      content:      messageContent,
      message_type: 'text',
    })

  if (insertErr) {
    console.error('[member-onboarding] insert error:', insertErr)
    return { status: 'insert_error', error: String(insertErr) }
  }

  console.log(`[member-onboarding] sent onboarding message (gpt=${usedGpt}, chars=${messageContent.length})`)

  return {
    status:         'sent',
    user_name:      userName,
    channel:        room.name,
    message_length: messageContent.length,
    used_gpt:       usedGpt,
    message_count:  msgCount,
  }
}
