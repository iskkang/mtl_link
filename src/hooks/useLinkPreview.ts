import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface LinkPreview {
  url:         string
  title:       string | null
  description: string | null
  image_url:   string | null
  domain:      string | null
}

const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g

export function extractUrls(text: string): string[] {
  return [...new Set(text.match(URL_REGEX) ?? [])].slice(0, 1)
}

export function useLinkPreview(messageId: string, roomId: string, messageContent: string) {
  const [preview, setPreview]  = useState<LinkPreview | null>(null)
  const [loading, setLoading]  = useState(false)

  const url = extractUrls(messageContent)[0] ?? null

  useEffect(() => {
    if (!url) { setPreview(null); return }

    let cancelled = false
    setLoading(true)

    async function load() {
      const { data: cached } = await supabase
        .from('message_links')
        .select('url,title,description,image_url,domain')
        .eq('message_id', messageId)
        .eq('url', url)
        .maybeSingle()

      if (cancelled) return
      if (cached) { setPreview(cached as LinkPreview); setLoading(false); return }

      try {
        const { data: fn } = await supabase.functions.invoke('fetch-link-preview', {
          body: { message_id: messageId, room_id: roomId, url },
        })
        if (!cancelled && fn?.preview) setPreview(fn.preview as LinkPreview)
      } catch {
        // 미리보기 없이 렌더링
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [messageId, roomId, url])

  return { preview, loading, hasUrl: !!url }
}
