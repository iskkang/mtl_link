// supabase/functions/daily-briefing/locales.ts

type Lang = 'ko' | 'en' | 'zh' | 'ja' | 'ru' | 'uz'

interface Locale {
  systemPrompt: string
  greeting: (name: string) => string
  summary: (msgCount: number, itemCount: number) => string
}

const COMMON_RULES = `당신은 MTL Shipping Agency 직원의 일일 브리핑 비서.

다음은 직원이 지난 24시간 동안 주고받은 메시지입니다.
물류·해운·통관 도메인 관점에서 다음 4가지 카테고리로 항목을 추출하세요:

1. deadline — 시한이 명시되거나 임박한 사항 (예: "오늘 18시까지", "5/15 마감")
2. action — 본인이 해야 할 구체적 일 (예: "WJ에게 사진 요청", "P/L 작성")
3. pending — 다른 사람의 회신을 기다리는 사항 (예: "운임 회신 대기 3일째")
4. alert — 통관/선적/운임 리스크 신호 (예: "통관 지연 가능성", "선적 일정 변경")

규칙:
- 메시지 ID, 채팅방 ID/이름은 정확히 보존
- 최대 8개 항목. 중요도 순.
- 단순 인사·잡담은 제외
- 이미 완료된 일은 제외
- 본인 발신 메시지에서도 본인이 약속한 일은 action으로 추출

각 항목은 다음 JSON 형식:
{
  "category": "deadline|action|pending|alert",
  "title": "짧고 명확하게 (15자 이내 권장)",
  "description": "1-2문장 설명, 출처 정보 포함",
  "source_message_id": "원본 메시지 UUID",
  "source_room_id": "채팅방 UUID",
  "source_room_name": "채팅방 이름",
  "due_at": "ISO 8601 또는 null",
  "priority": "high|medium|low"
}

전체 응답은 JSON 배열로: { "items": [...] }`

const LOCALES: Record<Lang, Locale> = {
  ko: {
    systemPrompt: COMMON_RULES + '\n\n**모든 출력 텍스트(title, description)는 한국어로 작성하세요.**',
    greeting: (name) => `${name}님, 오늘의 브리핑입니다.`,
    summary: (n, k) => `지난 24시간 동안 메시지 ${n}개를 분석했어요. 중요한 ${k}가지를 추려봤습니다.`,
  },
  en: {
    systemPrompt: COMMON_RULES + '\n\n**Output all text (title, description) in English.**',
    greeting: (name) => `Good morning, ${name}.`,
    summary: (n, k) => `Analyzed ${n} messages from the last 24 hours. Here are the ${k} key items.`,
  },
  zh: {
    systemPrompt: COMMON_RULES + '\n\n**所有输出文本(title, description)请用简体中文。**',
    greeting: (name) => `${name}，早上好。今日简报已送达。`,
    summary: (n, k) => `分析了过去24小时的${n}条消息，整理出${k}个重要事项。`,
  },
  ja: {
    systemPrompt: COMMON_RULES + '\n\n**すべての出力テキスト(title, description)は日本語で書いてください。**',
    greeting: (name) => `${name}さん、今日のブリーフィングです。`,
    summary: (n, k) => `過去24時間のメッセージ${n}件を分析しました。重要な${k}件をまとめました。`,
  },
  ru: {
    systemPrompt: COMMON_RULES + '\n\n**Весь вывод (title, description) на русском языке.**',
    greeting: (name) => `${name}, доброе утро. Ваш сегодняшний брифинг.`,
    summary: (n, k) => `Проанализировал ${n} сообщений за последние 24 часа. Выбрал ${k} важных пунктов.`,
  },
  uz: {
    systemPrompt: COMMON_RULES + "\n\n**Barcha matnni (title, description) o'zbek tilida yozing.**",
    greeting: (name) => `Xayrli tong, ${name}. Bugungi brifing.`,
    summary: (n, k) => `So'nggi 24 soatda ${n} ta xabar tahlil qilindi. ${k} ta muhim element ajratildi.`,
  },
}

export function getLocale(lang: string | null | undefined): Locale {
  const key = ((lang ?? 'ko').toLowerCase()) as Lang
  return LOCALES[key] ?? LOCALES.ko
}
