import { useState, useEffect, useRef } from 'react'
import { translateMessage } from '../services/translationService'
import type { MessageWithSender } from '../types/chat'

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
  isOwn: boolean,
): TranslationState {
  const [translatedText, setTranslatedText] = useState<string | null>(() => {
    // Hydrate from cache immediately on mount
    const key = `${message.id}:${myLanguage}`
    return cache.get(key) ?? null
  })
  const [isTranslating, setIsTranslating] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const srcLang  = message.source_language
  const isTranslatable =
    !isOwn &&
    message.message_type === 'text' &&
    message._status === 'sent' &&
    !!message.content &&
    !!message.room_id &&
    !!srcLang &&
    srcLang !== myLanguage &&
    !shouldSkip(message.content)

  useEffect(() => {
    if (!isTranslatable || !message.content || !srcLang) return

    const key = `${message.id}:${myLanguage}`

    // Memory cache hit — already set in initializer or previous effect
    if (cache.has(key)) {
      setTranslatedText(cache.get(key)!)
      return
    }

    // Deduplicate in-flight requests for the same key
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
        if (mounted.current) setTranslatedText(text)
      })
      .catch(err => {
        console.warn('[useMessageTranslation] failed:', err)
      })
      .finally(() => {
        pending.delete(key)
        if (mounted.current) setIsTranslating(false)
      })
  }, [message.id, message.content, message.room_id, myLanguage, isTranslatable, srcLang])

  return { translatedText, isTranslating, isTranslatable }
}
