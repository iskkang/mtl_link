import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function extractMeta(html: string, prop: string): string | null {
  // matches both property= and name= variants, content before or after
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["'](?:og|twitter):${prop}["'][^>]+content=["']([^"'<>]+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"'<>]+)["'][^>]+(?:property|name)=["'](?:og|twitter):${prop}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

function extractTitle(html: string): string | null {
  return extractMeta(html, 'title') ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null
}

function extractDescription(html: string): string | null {
  return extractMeta(html, 'description') ??
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"'<>]+)["']/i)?.[1]?.trim() ??
    html.match(/<meta[^>]+content=["']([^"'<>]+)["'][^>]+name=["']description["']/i)?.[1]?.trim() ?? null
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return url }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { message_id, room_id, url } = await req.json() as {
      message_id: string; room_id: string; url: string
    }
    if (!message_id || !room_id || !url) return json({ error: 'message_id, room_id, url required' }, 400)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

    // 인증 확인
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await callerClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    // 방 멤버 확인
    const { data: membership } = await callerClient
      .from('room_members')
      .select('user_id')
      .eq('room_id', room_id)
      .eq('user_id', user.id)
      .single()
    if (!membership) return json({ error: 'Forbidden' }, 403)

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 캐시 확인
    const { data: cached } = await adminClient
      .from('message_links')
      .select('*')
      .eq('message_id', message_id)
      .eq('url', url)
      .single()
    if (cached) return json({ ok: true, preview: cached })

    // OG 메타데이터 fetch
    let title: string | null = null
    let description: string | null = null
    let image_url: string | null = null
    const domain = getDomain(url)

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'MTLLinkBot/1.0',
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(6000),
        redirect: 'follow',
      })
      const ct = res.headers.get('content-type') ?? ''
      if (res.ok && ct.includes('html')) {
        // 최대 200KB만 읽어 파싱
        const reader = res.body?.getReader()
        let html = ''
        let bytes = 0
        if (reader) {
          const decoder = new TextDecoder()
          while (bytes < 200_000) {
            const { value, done } = await reader.read()
            if (done) break
            html  += decoder.decode(value, { stream: true })
            bytes += value?.length ?? 0
          }
          reader.cancel()
        }
        title       = extractTitle(html)
        description = extractDescription(html)
        image_url   = extractMeta(html, 'image')
      }
    } catch {
      // 네트워크 오류 — domain만 저장
    }

    // DB 저장
    const { data: inserted } = await adminClient
      .from('message_links')
      .upsert(
        { message_id, room_id, url, title, description, image_url, domain },
        { onConflict: 'message_id,url' },
      )
      .select()
      .single()

    return json({ ok: true, preview: inserted ?? { url, title, description, image_url, domain } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[fetch-link-preview]', msg)
    return json({ error: msg }, 500)
  }
})
