// supabase/functions/member-offboarding/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MINT_BOT_ID    = '00000000-0000-0000-0000-000000000001'
const LOOKBACK_DAYS  = parseInt(Deno.env.get('OFFBOARDING_LOOKBACK_DAYS') ?? '30')

interface PendingItem {
  title:    string
  status:   '회신_대기' | '진행_중' | '약속함'
  context:  string
  priority: 'high' | 'medium' | 'low'
}

interface Payload {
  user_id:        string
  deactivated_by?: string
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

  const { user_id } = payload
  if (!user_id) {
    return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400 })
  }

  try {
    const result = await handleOffboarding(db, openaiKey, user_id)
    console.log('[member-offboarding]', JSON.stringify(result))
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('[member-offboarding] unhandled error:', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})

async function handleOffboarding(
  db: DB,
  openaiKey: string,
  userId: string,
): Promise<Record<string, unknown>> {
  // 1. 사용자 정보 조회
  const { data: user } = await db
    .from('profiles')
    .select('id, name, preferred_language')
    .eq('id', userId)
    .single() as { data: { id: string; name: string; preferred_language: string | null } | null }

  if (!user) {
    console.error('[member-offboarding] user not found:', userId)
    return { status: 'user_not_found', user_id: userId }
  }

  console.log(`[member-offboarding] processing offboarding for ${user.name}`)

  // 2. 사용자가 속한 채널 목록 조회
  const { data: memberships } = await db
    .from('room_members')
    .select('room_id, rooms!inner(id, name, room_type)')
    .eq('user_id', userId)
    .eq('rooms.room_type', 'channel') as {
      data: Array<{ room_id: string; rooms: { id: string; name: string; room_type: string } }> | null
    }

  if (!memberships || memberships.length === 0) {
    console.log(`[member-offboarding] ${user.name} has no channel memberships`)
    return { status: 'no_channels', user_id: userId }
  }

  console.log(`[member-offboarding] ${user.name} is in ${memberships.length} channel(s)`)

  // 3. 각 채널 순차 처리 (Promise.allSettled → 실패해도 나머지 처리)
  const results = await Promise.allSettled(
    memberships.map(m => processChannel(db, openaiKey, user, m.rooms))
  )

  const summary = results.map((r, i) => ({
    channel: memberships[i].rooms.name,
    result:  r.status === 'fulfilled' ? r.value : { status: 'error', error: String(r.reason) },
  }))

  return {
    status:     'completed',
    user_name:  user.name,
    channels:   memberships.length,
    summary,
  }
}

async function processChannel(
  db: DB,
  openaiKey: string,
  user: { id: string; name: string },
  room: { id: string; name: string },
): Promise<Record<string, unknown>> {
  const roomId = room.id

  try {
    // 최근 N일 메시지 fetch (봇 제외)
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString()

    const { data: messages } = await db
      .from('messages')
      .select('id, content, sender_id, created_at')
      .eq('room_id', roomId)
      .eq('message_type', 'text')
      .is('deleted_at', null)
      .gte('created_at', since)
      .order('created_at', { ascending: true }) as {
        data: Array<{ id: string; content: string | null; sender_id: string; created_at: string }> | null
      }

    const userMessages = (messages ?? []).filter(m => m.sender_id === user.id)

    if (userMessages.length === 0) {
      // 해당 채널에서 최근 활동 없음 → 조용히 제거
      await db.from('room_members').delete().eq('room_id', roomId).eq('user_id', user.id)
      await db.from('offboarding_logs').insert({
        user_id:       user.id,
        room_id:       roomId,
        status:        'removed_only',
        pending_items: [],
      })
      console.log(`[member-offboarding] ${room.name}: no activity, silently removed`)
      return { status: 'removed_only', channel: room.name }
    }

    // GPT로 미완료 사안 추출
    const items = await extractPendingItems(openaiKey, userMessages, user.name, room.name)
    const messageContent = formatOffboardingMessage(user.name, items)

    // MINT 발신 메시지 INSERT (service role → RLS bypass)
    const { data: postedMessage } = await db
      .from('messages')
      .insert({
        room_id:      roomId,
        sender_id:    MINT_BOT_ID,
        content:      messageContent,
        message_type: 'text',
      })
      .select('id')
      .single() as { data: { id: string } | null }

    // room_members에서 제거
    await db.from('room_members').delete().eq('room_id', roomId).eq('user_id', user.id)

    // audit log
    await db.from('offboarding_logs').insert({
      user_id:                  user.id,
      room_id:                  roomId,
      pending_items:            items,
      notification_message_id:  postedMessage?.id ?? null,
      status:                   items.length > 0 ? 'success' : 'no_items',
    })

    console.log(`[member-offboarding] ${room.name}: sent message (${items.length} items), removed member`)
    return { status: items.length > 0 ? 'success' : 'no_items', channel: room.name, pending_items: items.length }
  } catch (e) {
    await db.from('offboarding_logs').insert({
      user_id: user.id,
      room_id: roomId,
      status:  'failed',
      error:   String(e),
    }).catch(() => {})
    throw e
  }
}

async function extractPendingItems(
  openaiKey: string,
  messages: Array<{ content: string | null; created_at: string }>,
  userName: string,
  channelName: string,
): Promise<PendingItem[]> {
  const transcript = messages
    .map(m => `[${m.created_at.slice(0, 16)}] ${m.content ?? ''}`)
    .join('\n')

  const prompt = `당신은 물류 업무 인수인계 도우미입니다.
아래는 "${userName}"이(가) 최근 ${LOOKBACK_DAYS}일간 채널 "${channelName}"에서 작성한 메시지입니다.

이 사람이 담당하던 미완료 사안을 추출하세요.
다음 형식의 JSON 객체로 출력 (items 키 안에 배열):
{"items":[{"title":"한 줄 요약","status":"회신_대기|진행_중|약속함","context":"1-2문장 요약","priority":"high|medium|low"}]}

미완료가 없으면 {"items":[]} 반환.

---
${transcript}
---`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model:           'gpt-4o-mini',
        messages:        [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature:     0.2,
        max_tokens:      800,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenAI ${res.status}: ${err}`)
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> }
    const text = data.choices?.[0]?.message?.content ?? '{"items":[]}'
    const parsed = JSON.parse(text) as { items?: PendingItem[] }
    return Array.isArray(parsed.items) ? parsed.items : []
  } catch (e) {
    console.error('[member-offboarding] GPT error:', e)
    return []
  }
}

function formatOffboardingMessage(userName: string, items: PendingItem[]): string {
  const priorityEmoji: Record<string, string> = { high: '🔴', medium: '🟡', low: '🟢' }

  if (items.length === 0) {
    return `👤 ${userName}님이 이 채널을 떠났습니다.\n(최근 ${LOOKBACK_DAYS}일간 진행 중이던 사안은 발견되지 않았습니다.)`
  }

  const lines = items.map(
    it => `${priorityEmoji[it.priority] ?? '⚪'} [${it.status}] ${it.title}\n   ${it.context}`
  )

  return [
    `👤 ${userName}님이 이 채널을 떠났습니다.`,
    '',
    `📋 미완료 사안 정리 (최근 ${LOOKBACK_DAYS}일 기준):`,
    ...lines,
    '',
    '새로운 담당자를 지정해 주세요.',
  ].join('\n')
}
