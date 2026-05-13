// supabase/functions/member-onboarding/locales.ts

type Lang = 'ko' | 'en' | 'zh' | 'ja' | 'ru' | 'uz'

interface Locale {
  systemPrompt: string
  userPrompt:   (memberName: string, channelName: string, messages: string) => string
  simpleGreeting: (name: string, channel: string) => string
}

const LOCALES: Record<Lang, Locale> = {
  ko: {
    systemPrompt: `당신은 MTL Link의 물류 어시스턴트 MINT입니다.
새 멤버가 채널에 입장했습니다. 채널의 최근 활동을 분석하여 환영 인사와 채널 컨텍스트 요약을 작성하세요.

형식:
1. 환영 인사 (1문장, 친근하게)
2. 이 채널의 주요 활동 (2-3문장)
3. 주요 거래처·진행 사안 (있는 경우 간결하게)
4. "자세히 알고 싶은 점은 MINT에게 물어보세요" (마지막 문장)

톤: 친근하고 전문적. 5-7문장 정도. 너무 길지 않게. 마크다운 사용 금지.`,
    userPrompt: (name, channel, messages) =>
`${name}님이 "${channel}" 채널에 입장했습니다.

이 채널의 최근 30일 대화입니다:
---
${messages}
---

위 내용을 분석하여 환영 인사와 채널 컨텍스트 요약을 작성하세요.
주요 거래처 이름, 진행 중인 사안, 최근 이슈를 짚어주세요.`,
    simpleGreeting: (name, channel) =>
`${name}님, "${channel}" 채널에 오신 것을 환영합니다!

채널에서 자유롭게 활동을 시작하세요. 도움이 필요하면 언제든 MINT에게 물어보세요.`,
  },

  en: {
    systemPrompt: `You are MINT, MTL Link's logistics assistant.
A new member just joined a channel. Analyze the channel's recent activity and write a welcome message with context summary.

Format:
1. Welcome greeting (1 friendly sentence)
2. Main activity of this channel (2-3 sentences)
3. Key partners and ongoing matters (briefly if any)
4. "Feel free to ask MINT for more details." (closing line)

Tone: friendly and professional. About 5-7 sentences total. No markdown.`,
    userPrompt: (name, channel, messages) =>
`${name} just joined the "${channel}" channel.

Recent 30 days of conversation:
---
${messages}
---

Write a welcome message with channel context summary.
Highlight key partners, ongoing matters, and recent issues.`,
    simpleGreeting: (name, channel) =>
`Welcome to "${channel}", ${name}!

Feel free to start participating. If you need anything, just ask MINT.`,
  },

  zh: {
    systemPrompt: `你是 MTL Link 的物流助手 MINT。
新成员刚刚加入频道。请分析频道近期活动，撰写欢迎词和频道背景摘要。

格式：
1. 欢迎语（1句，亲切自然）
2. 本频道的主要活动（2-3句）
3. 主要合作方和进行中的事项（简要列出）
4. "如需了解更多，请向 MINT 咨询。"（结尾）

语气：专业且友好。总计约5-7句。不使用 Markdown。`,
    userPrompt: (name, channel, messages) =>
`${name} 刚刚加入了"${channel}"频道。

以下是该频道近30天的对话：
---
${messages}
---

请分析以上内容，撰写欢迎词和频道背景摘要，重点说明主要合作方、进行中的事项和近期问题。`,
    simpleGreeting: (name, channel) =>
`${name}，欢迎加入"${channel}"频道！

请自由参与频道讨论。如有需要，随时向 MINT 咨询。`,
  },

  ja: {
    systemPrompt: `あなたは MTL Link の物流アシスタント MINT です。
新しいメンバーがチャンネルに参加しました。チャンネルの最近の活動を分析し、歓迎メッセージとコンテキストの要約を作成してください。

フォーマット：
1. 歓迎の挨拶（1文、親しみやすく）
2. このチャンネルの主な活動（2-3文）
3. 主要な取引先・進行中の案件（ある場合、簡潔に）
4. 「詳しくはMINTにお聞きください。」（締めの一文）

トーン：親しみやすく、プロフェッショナルに。全体で5-7文程度。マークダウン禁止。`,
    userPrompt: (name, channel, messages) =>
`${name}さんが「${channel}」チャンネルに参加しました。

このチャンネルの直近30日間の会話です：
---
${messages}
---

上記を分析し、歓迎メッセージとチャンネルのコンテキスト要約を作成してください。
主要取引先、進行中の案件、最近の課題をまとめてください。`,
    simpleGreeting: (name, channel) =>
`${name}さん、「${channel}」チャンネルへようこそ！

自由にご参加ください。何かあればいつでも MINT にご相談ください。`,
  },

  ru: {
    systemPrompt: `Вы — MINT, логистический ассистент MTL Link.
В канал вступил новый участник. Проанализируйте недавнюю активность канала и напишите приветствие с кратким обзором контекста.

Формат:
1. Приветствие (1 дружелюбное предложение)
2. Основная деятельность канала (2-3 предложения)
3. Ключевые партнёры и текущие вопросы (кратко, если есть)
4. «Если хотите узнать больше, спросите MINT.» (завершающее предложение)

Тон: профессиональный и дружелюбный. Около 5-7 предложений. Без Markdown.`,
    userPrompt: (name, channel, messages) =>
`${name} вступил(а) в канал «${channel}».

Последние 30 дней переписки:
---
${messages}
---

Проанализируйте переписку и напишите приветствие с обзором контекста канала. Укажите ключевых партнёров, текущие задачи и недавние проблемы.`,
    simpleGreeting: (name, channel) =>
`${name}, добро пожаловать в канал «${channel}»!

Присоединяйтесь к обсуждениям. Если нужна помощь — обращайтесь к MINT.`,
  },

  uz: {
    systemPrompt: `Siz MTL Link'ning logistika yordamchisi MINTsiz.
Kanalga yangi a'zo qo'shildi. Kanal faoliyatini tahlil qilib, xush kelibsiz xabari va kontekst qisqachasini yozing.

Format:
1. Xush kelibsiz (1 ta do'stona gap)
2. Kanalning asosiy faoliyati (2-3 gap)
3. Asosiy hamkorlar va joriy masalalar (qisqacha, agar mavjud bo'lsa)
4. «Batafsil ma'lumot uchun MINTga murojaat qiling.» (yakunlovchi gap)

Ohang: professional va do'stona. Jami 5-7 gap atrofida. Markdown ishlatilmasin.`,
    userPrompt: (name, channel, messages) =>
`${name} "${channel}" kanaliga qo'shildi.

Kanalning so'nggi 30 kunlik suhbati:
---
${messages}
---

Yuqoridagi ma'lumotni tahlil qilib, xush kelibsiz xabari va kanal konteksti qisqachasini yozing.
Asosiy hamkorlar, joriy masalalar va so'nggi muammolarni ko'rsating.`,
    simpleGreeting: (name, channel) =>
`${name}, "${channel}" kanaliga xush kelibsiz!

Erkin ishtirok eting. Yordam kerak bo'lsa, istalgan vaqt MINTga murojaat qiling.`,
  },
}

export function getLocale(lang: string | null | undefined): Locale {
  const key = ((lang ?? 'ko').toLowerCase()) as Lang
  return LOCALES[key] ?? LOCALES.ko
}
