import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { MINT_SYSTEM_PROMPT } from '../_shared/mintPrompt.ts'
import { buildSystem, callAnthropicWithRetry } from '../_shared/anthropic.ts'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BOT_USER_ID = '00000000-0000-0000-0000-000000000001'

const LANGUAGE_NAMES: Record<string, string> = {
  ko: 'Korean', en: 'English', ru: 'Russian', uz: 'Uzbek', zh: 'Chinese', ja: 'Japanese',
}

// ── RAG: knowledge_base 검색 ───────────────────────────────────────────────

async function searchKnowledgeBase(
  db: ReturnType<typeof createClient>,
  openaiKey: string,
  query: string,
  issueType: string | null = null,
): Promise<string> {
  try {
    // 1. 쿼리 임베딩 생성
    const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query.slice(0, 2000),
      }),
    })

    if (!embedRes.ok) {
      console.warn('[RAG] embedding failed:', await embedRes.text())
      return ''
    }

    const embedData = await embedRes.json() as { data: { embedding: number[] }[] }
    const embedding = embedData.data[0].embedding

    // 2. knowledge_base 유사도 검색
    const { data, error } = await db.rpc('match_knowledge_base', {
      query_embedding:    embedding,
      match_threshold:    0.5,    // 함수 내부에서 미사용, 호출 측에서 후처리
      match_count:        20,     // 여유 있게 가져와서 threshold 후처리
      filter_issue_type:  issueType,
      filter_region:      null,
    })

    if (error || !data) {
      console.warn('[RAG] search error:', error)
      return ''
    }

    // threshold 필터는 호출 측에서 후처리 (서브쿼리 금지 — IVFFlat 인덱스 비활성화됨)
    const SIMILARITY_THRESHOLD = 0.40
    const TOP_K = 4
    const filtered = (data as { filename: string; content: string; similarity: number }[])
      .filter(d => d.similarity >= SIMILARITY_THRESHOLD)
      .slice(0, TOP_K)

    if (filtered.length === 0) return ''

    // 3. 검색 결과를 컨텍스트 문자열로 변환
    const context = filtered
      .map(d => `[${d.filename}]\n${d.content}`)
      .join('\n\n---\n\n')

    return `\n\n[참고 데이터 - 반드시 이 데이터를 기반으로 답변하되, 파일명이나 헤더는 사용자에게 노출하지 마세요]\n${context}\n\n위 데이터에 있는 정확한 수치와 정보를 그대로 사용하세요. 데이터에 없는 내용은 추측하지 마세요.`

  } catch (e) {
    console.warn('[RAG] search error:', e)
    return ''
  }
}

// ── Issue Type 간단 분류 ───────────────────────────────────────────────────

function detectIssueType(text: string): string | null {
  const t = text.toLowerCase()
  if (t.includes('delay') || t.includes('지연') || t.includes('발차') || t.includes('적체')) return 'TRANSIT_DELAY'
  if (t.includes('customs') || t.includes('통관') || t.includes('세관')) return 'CUSTOMS_DELAY'
  if (t.includes('document') || t.includes('서류') || t.includes('invoice') || t.includes('packing list')) return 'DOC_MISSING'
  if (t.includes('border') || t.includes('국경') || t.includes('khorgos') || t.includes('altynkol')) return 'BORDER_ISSUE'
  if (t.includes('damage') || t.includes('파손') || t.includes('손상')) return 'CARGO_DAMAGE'
  if (t.includes('claim') || t.includes('클레임')) return 'CUSTOMER_CLAIM'
  if (t.includes('cost') || t.includes('비용') || t.includes('charge')) return 'COST_DISPUTE'
  if (t.includes('poa') || t.includes('위임장')) return 'DOC_MISSING'
  if (t.includes('eta') || t.includes('arrival') || t.includes('도착')) return 'ETA_RISK'
  return null
}

// ── 요약 명령 감지 (기존 유지) ─────────────────────────────────────────────

function detectSummaryCommand(content: string): { isSummary: boolean; range: 'today' | 'week' } {
  const text = content.toLowerCase()
  const isSummary =
    text.includes('요약') || text.includes('정리') ||
    text.includes('summary') || text.includes('summarize') ||
    text.includes('まとめ') || text.includes('要約') ||
    text.includes('总结') || text.includes('總結') ||
    text.includes('резюме') || text.includes('сводка') ||
    text.includes('qisqacha') || text.includes('xulosa')
  const range: 'today' | 'week' =
    (
      text.includes('이번 주') || text.includes('주간') ||
      text.includes('week') ||
      text.includes('週間') || text.includes('今週') ||
      text.includes('本周') || text.includes('本週') ||
      text.includes('неделю') || text.includes('недел') ||
      text.includes('hafta')
    ) ? 'week' : 'today'
  return { isSummary, range }
}

// ── 채널 메시지 조회 (기존 유지) ──────────────────────────────────────────

interface MessageForSummary {
  content:    string
  senderName: string
  createdAt:  string
}

async function fetchChannelMessages(
  db: ReturnType<typeof createClient>,
  roomId: string,
  range: 'today' | 'week',
): Promise<MessageForSummary[]> {
  const since = new Date()
  if (range === 'week') {
    since.setDate(since.getDate() - 7)
  } else {
    since.setHours(0, 0, 0, 0)
  }

  const { data: msgs, error } = await db
    .from('messages')
    .select('content, created_at, sender_id')
    .eq('room_id', roomId)
    .neq('sender_id', BOT_USER_ID)
    .is('deleted_at', null)
    .eq('message_type', 'text')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) {
    console.error('[summary] messages error:', error.message)
    return []
  }

  const messages = (msgs ?? []).filter(
    // deno-lint-ignore no-explicit-any
    (m: any) => (m.content as string)?.trim()
  )
  if (messages.length === 0) return []

  // deno-lint-ignore no-explicit-any
  const senderIds = [...new Set(messages.map((m: any) => m.sender_id as string))]
  const { data: profiles } = await db
    .from('profiles')
    .select('id, name')
    .in('id', senderIds)

  const nameMap: Record<string, string> = {}
  for (const p of (profiles ?? []) as { id: string; name: string }[]) {
    nameMap[p.id] = p.name
  }

  // deno-lint-ignore no-explicit-any
  return messages.map((m: any) => ({
    content:    m.content as string,
    senderName: nameMap[m.sender_id as string] ?? '알 수 없음',
    createdAt:  m.created_at as string,
  }))
}

// ── Claude 호출 — callAnthropicWithRetry로 위임 ────────────────────────────

async function callClaude(
  anthropicKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  maxTokens = 1200,
): Promise<string> {
  const { text } = await callAnthropicWithRetry(anthropicKey, {
    model:     'claude-haiku-4-5-20251001',
    maxTokens,
    system:    buildSystem(systemPrompt),
    messages,
  })
  return text
}

// ── 요약 생성 (기존 유지) ──────────────────────────────────────────────────

async function generateSummary(
  anthropicKey: string,
  messages: MessageForSummary[],
  roomName: string,
  range: 'today' | 'week',
): Promise<string> {
  const rangeLabel = range === 'today' ? '오늘' : '이번 주'

  if (messages.length === 0) {
    return `${rangeLabel} ${roomName}에 대화 내용이 없습니다.`
  }

  const transcript = messages
    .map(m => {
      const time = new Date(m.createdAt).toLocaleTimeString('ko-KR', {
        hour: '2-digit', minute: '2-digit',
      })
      return `[${time}] ${m.senderName}: ${m.content}`
    })
    .join('\n')

  const systemPrompt = `You are a logistics team assistant summarizing internal channel conversations.
Always respond in Korean (한국어).
Be concise. Use bullet points. No markdown bold/italic.
Separate: decided items, requested items, in-progress items.`

  const userPrompt = `다음은 ${roomName} 채널의 ${rangeLabel} 업무 대화입니다 (${messages.length}건).
핵심 내용을 불릿 포인트로 간결하게 요약해주세요.
결정된 사항, 요청된 사항, 처리 중인 사항을 구분해서 정리해주세요.

대화 내용:
${transcript}

요약 형식 (반드시 이 형식으로):
📋 ${rangeLabel} #${roomName} 요약 (${messages.length}건)
• [내용] (담당자)
...`

  return await callClaude(anthropicKey, systemPrompt, [{ role: 'user', content: userPrompt }], 1000)
}

// ── 인터페이스 (기존 유지) ─────────────────────────────────────────────────

interface BotRequest {
  roomId:       string
  userMessage:  string
  userLanguage: string
}

// ── 메인 핸들러 ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    const { roomId, userMessage, userLanguage } = await req.json() as BotRequest

    if (!roomId || !userMessage) return json({ error: 'missing required fields' }, 400)

    const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
    const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const openaiKey    = Deno.env.get('OPENAI_API_KEY') ?? ''

    if (!anthropicKey) {
      console.warn('[bot-respond] ANTHROPIC_API_KEY not set')
      return json({ error: 'Bot service not configured' }, 500)
    }

    const db = createClient(supabaseUrl, serviceKey)

    // 1. 봇 방 검증
    const { data: botMember } = await db
      .from('room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', BOT_USER_ID)
      .maybeSingle()

    if (!botMember) return json({ error: 'not a bot room' }, 400)

    // 2. 요약 명령 처리
    const { isSummary, range } = detectSummaryCommand(userMessage)

    if (isSummary) {
      const [messagesResult, roomResult] = await Promise.all([
        fetchChannelMessages(db, roomId, range),
        db.from('rooms').select('name').eq('id', roomId).maybeSingle(),
      ])

      const roomName = (roomResult.data as { name: string } | null)?.name ?? '채널'
      const summary  = await generateSummary(anthropicKey, messagesResult, roomName, range)

      const { error: insertError } = await db.from('messages').insert({
        room_id:      roomId,
        sender_id:    BOT_USER_ID,
        content:      summary,
        message_type: 'text',
      })

      if (insertError) throw insertError
      return json({ ok: true, type: 'summary' })
    }

    // 3. Rate limit
    const { data: recentBotMessages } = await db
      .from('messages')
      .select('id')
      .eq('room_id', roomId)
      .eq('sender_id', BOT_USER_ID)
      .gte('created_at', new Date(Date.now() - 60_000).toISOString())

    if ((recentBotMessages?.length ?? 0) >= 10) {
      return new Response('rate limit', { status: 429, headers: CORS })
    }

    // 4. 최근 메시지 컨텍스트
    const { data: recentMsgs } = await db
      .from('messages')
      .select('sender_id, content')
      .eq('room_id', roomId)
      .eq('message_type', 'text')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10)

    const contextMessages = (recentMsgs ?? [])
      .reverse()
      .filter(m => m.content)
      .map(m => ({
        role:    m.sender_id === BOT_USER_ID ? 'assistant' : 'user',
        content: m.content as string,
      }))

    const lastCtx = contextMessages[contextMessages.length - 1]
    if (!lastCtx || lastCtx.role !== 'user' || lastCtx.content !== userMessage) {
      contextMessages.push({ role: 'user', content: userMessage })
    }

    // 5. RAG: knowledge_base 검색 (OpenAI 키 있을 때만)
    let ragContext = ''
    if (openaiKey) {
      const issueType = detectIssueType(userMessage)
      ragContext = await searchKnowledgeBase(db, openaiKey, userMessage, issueType)
    }

    // 6. System prompt 구성 (MINT + RAG 컨텍스트)
    const languageName = LANGUAGE_NAMES[userLanguage] ?? 'English'
    const systemPrompt = MINT_SYSTEM_PROMPT.replace(/{languageName}/g, languageName)
      + ragContext  // RAG 검색 결과 주입

    // 7. Claude 호출
    const botReply = await callClaude(anthropicKey, systemPrompt, contextMessages, 800)

    // 8. 봇 메시지 INSERT
    const { error: insertError } = await db.from('messages').insert({
      room_id:         roomId,
      sender_id:       BOT_USER_ID,
      content:         botReply,
      message_type:    'text',
      source_language: userLanguage,
    })

    if (insertError) throw insertError

    console.info(`[bot-respond] MINT replied in ${userLanguage}, room=${roomId}, rag=${ragContext.length > 0}`)
    return json({ ok: true })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[bot-respond]', msg)
    return json({ error: msg }, 500)
  }
})
