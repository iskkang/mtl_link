import { useState, useEffect, useRef } from 'react'
import { translateMessage } from '../services/translationService'
import type { MessageWithSender } from '../types/chat'
import { useMessageStore } from '../stores/messageStore'
import { detectLanguage } from '../utils/detectLanguage'

// Module-level cache — shared across all hook instances, persists for session
const cache   = new Map<string, string>()
const pending = new Set<string>()

function shouldSkip(text: string): boolean {
  const t = text.trim()
  if (t.length <= 2) return true
  if (/^[\p{Emoji}\s]+$/u.test(t)) return true
  if (/^[\d\s.,+\-()]+$/.test(t)) return true
  return false
}

interface TranslationState {
  translatedText: string | null
  isTranslating:  boolean
  isTranslatable: boolean
}

export function useMessageTranslation(
  message: MessageWithSender,
  myLanguage: string,
): TranslationState {
  const srcLang = message.source_language ?? (message.content ? detectLanguage(message.content) : null)

  const isTranslatable =
    message.message_type === 'text' &&
    message._status === 'sent' &&
    !!message.content &&
    !!message.room_id &&
    !!srcLang &&
    srcLang !== myLanguage &&
    !shouldSkip(message.content)

  const [translatedText, setTranslatedText] = useState<string | null>(() => {
    if (!isTranslatable) return null
    const key = `${message.id}:${myLanguage}`
    // 1. In-memory cache (fastest)
    if (cache.has(key)) return cache.get(key)!
    // 2. DB-cached translation joined from message_translations
    const dbText = message.translations?.find(t => t.language === myLanguage)?.translated_text
    if (dbText) { cache.set(key, dbText); return dbText }
    return null
  })

  const [isTranslating, setIsTranslating] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!isTranslatable || !message.content || !srcLang) return

    const key = `${message.id}:${myLanguage}`

    // 1. Memory cache hit
    if (cache.has(key)) {
      setTranslatedText(cache.get(key)!)
      return
    }

    // 2. DB-cached translation from joined data (populated after fetch/re-fetch)
    const dbText = message.translations?.find(t => t.language === myLanguage)?.translated_text
    if (dbText) {
      cache.set(key, dbText)
      setTranslatedText(dbText)
      return
    }

    // 3. Deduplicate in-flight Edge Function requests
    if (pending.has(key)) return

    pending.add(key)
    setIsTranslating(true)

    translateMessage({
      message_id:      message.id,
      room_id:         message.room_id,
      source_text:     message.content,
      source_language: srcLang,
      target_language: myLanguage,
    })
      .then(text => {
        cache.set(key, text)
        if (message.room_id) {
          useMessageStore.getState().setTranslation(message.room_id, message.id, text)
        }
        if (mounted.current) setTranslatedText(text)
      })
      .catch(err => {
        console.warn('[useMessageTranslation] failed:', err)
      })
      .finally(() => {
        pending.delete(key)
        if (mounted.current) setIsTranslating(false)
      })
  // message.translations added: re-run when DB join data arrives after Realtime re-fetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id, message.content, message.room_id, message.translations, myLanguage, isTranslatable, srcLang])

  return { translatedText, isTranslating, isTranslatable }
}
