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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: EmbedRequest = await req.json()
    const { title, category, content, source_file, chunk_index, chunk_total, created_by } = body

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
      })
      .select('id')
      .single()

    if (error) throw error

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
