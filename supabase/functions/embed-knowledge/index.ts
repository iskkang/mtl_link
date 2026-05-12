import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

const OPENAI_API_KEY  = Deno.env.get('OPENAI_API_KEY')!
const EMBEDDING_MODEL = 'text-embedding-3-small'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface EmbedRequest {
  title:       string
  category:    string | null
  content:     string
  source_file: string
  chunk_index: number
  chunk_total: number
  created_by:  string
  upload_id?:  string
}

async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000),
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI embedding error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.data[0].embedding as number[]
}

// ── Rate entry parsing ─────────────────────────────────────────────────────

function parseRateLine(line: string): Record<string, string> {
  const parts: Record<string, string> = {}
  line.split(' / ').forEach(seg => {
    const idx = seg.indexOf(': ')
    if (idx !== -1) {
      parts[seg.slice(0, idx).trim()] = seg.slice(idx + 2).trim()
    }
  })
  return parts
}

function toNumeric(v: string | undefined): number | null {
  if (!v) return null
  const n = parseFloat(v.replace(/[^0-9.]/g, ''))
  return isNaN(n) ? null : n
}

async function insertRateEntries(
  content: string,
  sourceFile: string,
  createdBy: string,
  chunkIndex: number,
) {
  const lines = content.split('\n')

  // Extract valid_month from sheet header [202605]
  const sheetMatch = lines[0]?.match(/^\[(.+)\]$/)
  const validMonth = sheetMatch?.[1] ?? null

  // On first chunk, clear existing entries for this source_file
  if (chunkIndex === 0) {
    await supabase.from('rate_entries').delete().eq('source_file', sourceFile)
  }

  const dataLines = lines.filter(l => l.includes('대리점:'))
  if (dataLines.length === 0) return

  const rows = dataLines.map(line => {
    const p = parseRateLine(line)
    const owner = p['Owner'] === '-' ? null : (p['Owner'] ?? null)
    return {
      source_file: sourceFile,
      agent:       p['대리점']   ?? null,
      mode:        p['Mode']    ?? null,
      pol:         p['POL']     ?? null,
      loading:     p['Loading'] ?? null,
      border:      p['Border']  ?? null,
      pod:         p['POD']     ?? null,
      type:        p['Type']    ?? null,
      owner,
      rate_jan:    toNumeric(p['Rate 1월'] ?? p['1월']),
      rate_feb:    toNumeric(p['Rate 2월'] ?? p['2월']),
      rate_mar:    toNumeric(p['Rate 3월'] ?? p['3월']),
      rate_apr:    toNumeric(p['Rate 4월'] ?? p['4월']),
      rate_may:    toNumeric(p['Rate 5월'] ?? p['5월']),
      ltime:       p['Ltime']   ?? null,
      valid_month: validMonth,
      created_by:  createdBy,
    }
  })

  const { error } = await supabase.from('rate_entries').insert(rows)
  if (error) console.error('[embed] rate_entries insert error:', error.message)
  else console.log(`[embed] rate_entries inserted ${rows.length} rows`)
}

// ── Main handler ──────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: EmbedRequest = await req.json()
    const { title, category, content, source_file, chunk_index, chunk_total, created_by, upload_id } = body

    if (!content?.trim()) {
      return Response.json({ error: '내용이 비어있습니다' }, { status: 400, headers: corsHeaders })
    }

    console.log(`[embed] ${source_file} chunk ${chunk_index + 1}/${chunk_total}`)
    const embedding = await getEmbedding(content)

    const chunkTitle = chunk_total > 1
      ? `${title} (${chunk_index + 1}/${chunk_total})`
      : title

    const { data, error } = await supabase
      .from('knowledge_base')
      .insert({
        title:       chunkTitle,
        category,
        content,
        source_file,
        chunk_index,
        chunk_total,
        embedding,
        status:      'pending_review',
        created_by,
        ...(upload_id ? { upload_id } : {}),
      })
      .select('id')
      .single()

    if (error) throw error

    // For rate category, also parse rows into rate_entries
    if (category === 'rate') {
      await insertRateEntries(content, source_file, created_by, chunk_index)
    }

    console.log(`[embed] 저장 완료: ${data.id}`)
    return Response.json(
      { success: true, id: data.id, chunk: `${chunk_index + 1}/${chunk_total}` },
      { headers: corsHeaders },
    )

  } catch (error) {
    console.error('[embed-knowledge] error:', error)
    return new Response(
      JSON.stringify({ error: String(error), stack: (error as Error)?.stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
