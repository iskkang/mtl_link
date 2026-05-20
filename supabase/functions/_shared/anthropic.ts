// Shared Anthropic API client — prompt caching + retry with backoff/jitter
//
// Haiku 4.5 minimum cacheable prefix: 4096 tokens.
// Current system prompts are ~900-1500 tokens, so cache writes will occur
// but cache reads will be near-zero until prompts grow. The infrastructure
// is in place. Retry logic (429/529/503) is immediately effective.

interface CachedBlock {
  type: 'text'
  text: string
  cache_control: { type: 'ephemeral' }
}

interface PlainBlock {
  type: 'text'
  text: string
}

export type SystemBlock = CachedBlock | PlainBlock

export interface AnthropicUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

export interface AnthropicResult {
  text: string
  usage: AnthropicUsage
}

/**
 * Build system array: stableText is marked for caching; volatileText (e.g.
 * RAG context) is appended without cache_control so it doesn't invalidate
 * the stable prefix's cache entry.
 */
export function buildSystem(stableText: string, volatileText?: string): SystemBlock[] {
  const blocks: SystemBlock[] = [
    { type: 'text', text: stableText, cache_control: { type: 'ephemeral' } },
  ]
  if (volatileText) {
    blocks.push({ type: 'text', text: volatileText })
  }
  return blocks
}

/**
 * Call Anthropic /v1/messages with:
 * - system prompt caching (cache_control on stable blocks)
 * - exponential backoff + jitter on 429 / 529 / 503
 */
export async function callAnthropicWithRetry(
  apiKey: string,
  params: {
    model:     string
    maxTokens: number
    system:    SystemBlock[]
    messages:  { role: string; content: string }[]
  },
  maxRetries = 4,
): Promise<AnthropicResult> {
  const body = JSON.stringify({
    model:      params.model,
    max_tokens: params.maxTokens,
    system:     params.system,
    messages:   params.messages,
  })

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body,
    })

    if (res.status === 429 || res.status === 529 || res.status === 503) {
      if (attempt === maxRetries) {
        const errText = await res.text()
        throw new Error(`Rate limited after ${maxRetries} retries: ${errText}`)
      }
      const retryAfter = res.headers.get('retry-after')
      const baseWait = retryAfter
        ? parseInt(retryAfter) * 1_000
        : Math.min(1_000 * 2 ** attempt, 16_000)
      const jitter = Math.random() * 500
      const waitMs = Math.round(baseWait + jitter)
      console.warn(`[anthropic] ${res.status} — retry ${attempt + 1}/${maxRetries} in ${waitMs}ms`)
      await new Promise(r => setTimeout(r, waitMs))
      continue
    }

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Anthropic API ${res.status}: ${errText}`)
    }

    const data = await res.json() as {
      content?: { type: string; text: string }[]
      usage?:   AnthropicUsage
    }

    const text = data.content?.[0]?.text?.trim()
    if (!text) throw new Error('Empty response from Anthropic')

    const u = data.usage ?? { input_tokens: 0, output_tokens: 0 }
    console.info(
      `[anthropic] cache_creation=${u.cache_creation_input_tokens ?? 0}`,
      `cache_read=${u.cache_read_input_tokens ?? 0}`,
      `input=${u.input_tokens} output=${u.output_tokens}`,
    )

    return { text, usage: u }
  }

  // unreachable — for loop always exits via return or throw
  throw new Error('callAnthropicWithRetry: unreachable')
}
