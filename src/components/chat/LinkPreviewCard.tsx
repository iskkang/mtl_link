import { useState, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface LinkPreview {
  url:         string
  title:       string | null
  description: string | null
  image_url:   string | null
  domain:      string | null
}

interface Props {
  messageId: string
  roomId:    string
  url:       string
  isOwn:     boolean
}

export function LinkPreviewCard({ messageId, roomId, url, isOwn }: Props) {
  const [preview, setPreview] = useState<LinkPreview | null>(null)
  const [ready,   setReady]   = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      // 1. DB 캐시 확인
      const { data } = await supabase
        .from('message_links')
        .select('url,title,description,image_url,domain')
        .eq('message_id', messageId)
        .eq('url', url)
        .maybeSingle()

      if (cancelled) return
      if (data) { setPreview(data as LinkPreview); setReady(true); return }

      // 2. Edge Function 호출
      try {
        const { data: fn } = await supabase.functions.invoke('fetch-link-preview', {
          body: { message_id: messageId, room_id: roomId, url },
        })
        if (!cancelled && fn?.preview) setPreview(fn.preview as LinkPreview)
      } catch {
        // 무시 — 미리보기 없이 렌더링
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    load()
    return () => { cancelled = true }
  }, [messageId, roomId, url])

  if (!ready || !preview) return null
  if (!preview.title && !preview.description && !preview.image_url) return null

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-1.5 flex gap-3 p-3 rounded-xl overflow-hidden
                  border transition-colors group no-underline block
                  ${isOwn
                    ? 'bg-black/10 dark:bg-black/20 border-black/10 dark:border-white/10 hover:bg-black/15 dark:hover:bg-black/30'
                    : 'bg-gray-50 dark:bg-surface-input border-gray-200 dark:border-[#374045] hover:bg-gray-100 dark:hover:bg-surface-hover'
                  }`}
      onClick={e => e.stopPropagation()}
    >
      {preview.image_url && (
        <img
          src={preview.image_url}
          alt=""
          className="w-16 h-16 object-cover rounded-lg flex-shrink-0 bg-gray-100 dark:bg-surface-input"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        {preview.domain && (
          <p className="text-[10px] text-gray-400 dark:text-[#8696a0] uppercase tracking-wider mb-0.5 truncate">
            {preview.domain}
          </p>
        )}
        {preview.title && (
          <p className="text-xs font-semibold leading-snug line-clamp-2 text-gray-800 dark:text-[#e9edef]">
            {preview.title}
          </p>
        )}
        {preview.description && (
          <p className="text-[11px] mt-0.5 line-clamp-2 leading-snug text-gray-500 dark:text-[#aebac1]">
            {preview.description}
          </p>
        )}
      </div>
      <ExternalLink
        size={13}
        className="flex-shrink-0 mt-0.5 text-gray-300 dark:text-[#556e78]
                   group-hover:text-gray-500 dark:group-hover:text-[#8696a0] transition-colors"
      />
    </a>
  )
}
