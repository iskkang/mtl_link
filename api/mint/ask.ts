import ws from 'ws'
;(globalThis as any).WebSocket = ws

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const VOYAGE_KEY    = process.env.VOYAGE_API_KEY    ?? ''
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? ''
const SB_URL        = process.env.SUPABASE_URL               ?? ''
const SB_KEY        = process.env.SUPABASE_SERVICE_ROLE_KEY  ?? ''

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'
const MATCH_COUNT  = 8

// Service-role client — used only for vector search & auth verification.
// This key is never exposed to the frontend.
const supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } })

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `당신은 MTL(포워딩 회사)의 내부 운영 보조 MINT입니다. 직원의 질문에 과거 사내 메일을 참고해 답합니다.

규칙:
1. 아래 제공된 메일에 근거해서만 답하세요. 메일에 없는 사실을 지어내지 마세요.
2. 운임·담당자·연락처처럼 시간에 따라 바뀌는 정보는 반드시 출처 메일의 날짜를 명시하고 "변경되었을 수 있으니 확인 권장"을 붙이세요.
3. 정보가 부족하면 "관련 기록이 충분하지 않습니다"라고 솔직히 말하세요.
4. 어느 메일을 근거로 했는지 [메일 N] 형태로 표시하세요.
5. 특정 지역·노선·고객·시점에 한정된 규칙은 그 한정 조건을 반드시 유지하세요. 한 사례의 규칙을 모든 경우로 일반화하지 마세요. 예: "유럽 TCR은 40HQ만 가능"은 유럽 한정이며 다른 지역은 20'도 가능할 수 있습니다. 규칙이 한 지역에서만 확인되면 "~의 경우"라고 명시하고 다른 지역은 다를 수 있다고 덧붙이세요.
6. 회사가 쓰는 용어를 원문 그대로 사용하세요. 도메인 용어를 일상어로 바꿔 의역하지 마세요. 예: "스페이스(슬롯) 부족"을 "공간 부족"으로 바꾸지 마세요.`

// ─── Voyage embedding ─────────────────────────────────────────────────────────
interface VoyageResponse {
  data?: Array<{ embedding: number[] }>
}

async function embedQuery(text: string): Promise<number[]> {
  const r = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOYAGE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: [text], model: 'voyage-3', input_type: 'query' }),
  })
  const data = await r.json() as VoyageResponse
  if (!data.data) throw new Error('Voyage 오류: ' + JSON.stringify(data).slice(0, 200))
  return data.data[0].embedding
}

// ─── Claude with retry ────────────────────────────────────────────────────────
interface ClaudeResponse {
  content?: Array<{ type: string; text: string }>
  error?:   { type: string; message: string }
}

async function callClaudeWithRetry(system: string, userPrompt: string): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      CLAUDE_MODEL,
        max_tokens: 3000,
        system,
        messages:   [{ role: 'user', content: userPrompt }],
      }),
    })
    const data = await r.json() as ClaudeResponse
    if (data.content) {
      return data.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n')
    }
    if (data.error?.type === 'overloaded_error' || r.status === 529 || r.status === 429) {
      const delay = Math.min(2000 * 2 ** attempt, 30_000)
      await new Promise(res => setTimeout(res, delay))
      continue
    }
    throw new Error('Claude 오류: ' + JSON.stringify(data).slice(0, 200))
  }
  throw new Error('Claude 과부하 — 잠시 후 다시 시도해주세요.')
}

// ─── Email match type ─────────────────────────────────────────────────────────
interface EmailMatch {
  id:         string
  subject:    string
  from_name:  string
  sent_date:  string | null
  body:       string
  similarity: number
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── 인증: Supabase JWT 검증 ──────────────────────────────────────────────
  const authHeader = (req.headers.authorization ?? '') as string
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    return res.status(401).json({ error: '인증이 필요합니다.' })
  }
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authUser) {
    return res.status(401).json({ error: '유효하지 않은 세션입니다.' })
  }

  // ── 입력 검증 ────────────────────────────────────────────────────────────
  const body = req.body as { question?: unknown } | undefined
  const question = body?.question
  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'question 이 필요합니다.' })
  }

  try {
    // 1. Voyage 임베딩
    const qVec = await embedQuery(question.trim())

    // 2. Supabase 벡터 검색
    const { data: matches, error: rpcError } = await supabase.rpc('match_mint_emails', {
      query_embedding: qVec,
      match_count:     MATCH_COUNT,
    })
    if (rpcError) throw new Error('검색 오류: ' + rpcError.message)

    const emailMatches = (matches ?? []) as EmailMatch[]
    if (emailMatches.length === 0) {
      return res.status(200).json({ answer: '관련 기록이 충분하지 않습니다.', sources: [] })
    }

    // 3. 컨텍스트 조립
    const context = emailMatches.map((m, i) => {
      const date = m.sent_date
        ? new Date(m.sent_date).toISOString().slice(0, 10)
        : '날짜미상'
      return `[메일 ${i + 1}] (${date}, ${m.from_name})\n제목: ${m.subject}\n${m.body}`
    }).join('\n\n---\n\n')

    const userPrompt = `직원 질문: ${question.trim()}\n\n참고 메일:\n${context}`

    // 4. Claude 호출
    const answer = await callClaudeWithRetry(SYSTEM_PROMPT, userPrompt)

    // 5. 출처 목록
    const sources = emailMatches.map((m, i) => ({
      index:      i + 1,
      date:       m.sent_date ? new Date(m.sent_date).toISOString().slice(0, 10) : null,
      from:       m.from_name,
      subject:    m.subject,
      similarity: m.similarity,
    }))

    return res.status(200).json({ answer, sources })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[mint/ask] error:', msg)
    return res.status(500).json({ error: msg })
  }
}
