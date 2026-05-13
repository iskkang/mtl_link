// src/components/mint/BriefingCard.tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Clock, ClipboardCheck, HelpCircle, AlertTriangle,
  ArrowRight, ThumbsUp, ThumbsDown,
  // reserved for Tasks 3-5:
  Pin as _Pin, X as _X, Circle as _Circle, CheckCircle2 as _CheckCircle2,
  Trash2 as _Trash2, CalendarPlus as _CalendarPlus,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { chatEvents } from '../../lib/aiEvents'

interface BriefingItem {
  category: 'deadline' | 'action' | 'pending' | 'alert'
  title: string
  description: string
  source_message_id: string | null
  source_room_id: string | null
  source_room_name: string | null
  due_at: string | null
  priority: 'high' | 'medium' | 'low'
  completed?: boolean
  pinned?: boolean
  dismissed?: boolean
}

export interface BriefingPayload {
  briefing_id: string
  briefing_type?: 'daily' | 'weekly'
  locale: string
  greeting: string
  summary: string
  message_count: number
  items: BriefingItem[]
}

export async function updateBriefingItem(
  messageId: string,
  itemIndex: number,
  patch: Partial<BriefingItem>,
) {
  const { data: msg } = await supabase
    .from('messages')
    .select('payload')
    .eq('id', messageId)
    .single()
  if (!msg) return
  const existing = msg.payload as Record<string, unknown>
  const updatedItems = [...((existing.items as BriefingItem[]) ?? [])]
  updatedItems[itemIndex] = { ...updatedItems[itemIndex], ...patch }
  await (supabase as any)
    .from('messages')
    .update({ payload: { ...existing, items: updatedItems } })
    .eq('id', messageId)
}

const CATEGORY_CONFIG = {
  deadline: { bg: '#FCEBEB', fg: '#A32D2D', Icon: Clock,          i18nKey: 'briefingDeadline' },
  action:   { bg: '#E6F1FB', fg: '#0C447C', Icon: ClipboardCheck, i18nKey: 'briefingAction'   },
  pending:  { bg: '#FEF3C7', fg: '#92400E', Icon: HelpCircle,     i18nKey: 'briefingPending'  },
  alert:    { bg: '#FEE2E2', fg: '#991B1B', Icon: AlertTriangle,  i18nKey: 'briefingAlert'    },
} as const

function formatDueAt(iso: string): string {
  const date  = new Date(iso)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}까지`
  }
  return `${date.getMonth() + 1}/${date.getDate()}까지`
}

export function BriefingCard({
  payload,
  messageId: _messageId,
}: {
  payload: BriefingPayload
  messageId: string
}) {
  const { t } = useTranslation()
  const [feedback, setFeedback] = useState<1 | -1 | null>(null)
  const [items, _setItems] = useState<BriefingItem[]>(payload.items)
  const [_deleted, _setDeleted] = useState(false)
  const isWeekly = (payload.briefing_type ?? 'daily') === 'weekly'

  const handleViewChat = (item: BriefingItem) => {
    if (!item.source_room_id || !item.source_message_id) return
    chatEvents.emitNavigateToMessage(item.source_room_id, item.source_message_id)
  }

  const handleFeedback = async (e: React.MouseEvent, score: 1 | -1) => {
    e.stopPropagation()
    if (feedback !== null) return
    setFeedback(score)
    await (supabase as any)
      .from('ai_briefings')
      .update({ feedback_score: score, feedback_at: new Date().toISOString() })
      .eq('id', payload.briefing_id)
  }

  return (
    <div className="max-w-[540px]">
      <div className="flex items-center gap-2 mb-1">
        {isWeekly && (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex-shrink-0">
            {t('briefingWeeklyLabel')}
          </span>
        )}
        <span className="text-[14px] text-[#0f172a] leading-[1.5] font-medium">
          {payload.greeting}
        </span>
      </div>
      <div className="text-[12px] text-[#64748b] mb-[14px]">
        {payload.summary}
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item, idx) => {
          const cfg = CATEGORY_CONFIG[item.category]
          const borderClass = item.category === 'alert' ? 'border-red-200' : 'border-black/[0.08]'

          return (
            <div
              key={idx}
              className={`bg-white border-[0.5px] ${borderClass} rounded-[10px] p-3 shadow-sm`}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                  style={{ background: cfg.bg, color: cfg.fg }}
                >
                  <cfg.Icon size={11} />
                  {t(cfg.i18nKey)}
                </span>
                {item.due_at && (
                  <span className="text-[11px] font-medium" style={{ color: cfg.fg }}>
                    {formatDueAt(item.due_at)}
                  </span>
                )}
              </div>
              <div className="text-[13px] font-medium text-[#0f172a] mb-1">
                {item.title}
              </div>
              <div className="text-[12px] text-[#64748b] mb-2.5 leading-[1.5]">
                {item.description}
              </div>
              {item.source_room_id && item.source_message_id && (
                <button
                  onClick={() => handleViewChat(item)}
                  className="inline-flex items-center gap-1 text-[11px] text-[#0d9488] font-medium hover:underline"
                >
                  {t('briefingViewChat')}
                  <ArrowRight size={12} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-[14px] pt-3 border-t border-black/[0.08] flex justify-end items-center">
        <div className="flex gap-1.5">
          <button
            onClick={e => handleFeedback(e, 1)}
            disabled={feedback !== null}
            className={`w-6 h-6 flex items-center justify-center border-[0.5px] border-[#ccfbf1] rounded-md transition-colors ${
              feedback === 1 ? 'bg-[#f0fdfa] text-[#0d9488]' : 'text-[#64748b] hover:text-[#0d9488]'
            }`}
            aria-label="유용했어요"
          >
            <ThumbsUp size={13} />
          </button>
          <button
            onClick={e => handleFeedback(e, -1)}
            disabled={feedback !== null}
            className={`w-6 h-6 flex items-center justify-center border-[0.5px] border-[#ccfbf1] rounded-md transition-colors ${
              feedback === -1 ? 'bg-red-50 text-red-600' : 'text-[#64748b] hover:text-red-600'
            }`}
            aria-label="별로였어요"
          >
            <ThumbsDown size={13} />
          </button>
        </div>
      </div>

      <div className="text-[10px] text-[#94a3b8] mt-2.5 text-center leading-[1.5]">
        {t('briefingPrivacy')}
        {' · '}
        <button className="text-[#0d9488] hover:underline">
          {t('briefingLearnMore')}
        </button>
      </div>
    </div>
  )
}
