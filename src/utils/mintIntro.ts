const INTRO_KEYWORDS = [
  'mint가 뭐야', 'mint는 뭐야', 'mint가 뭔데', 'mint가 뭐예요',
  '민트가 뭐야', '민트는 뭐야', '민트가 뭔데',
  '너 누구야', '넌 누구야', '너는 누구야', '당신은 누구',
  '넌 뭐야', '너 뭐야', '뭐하는 ai', '뭐하는 봇',
  'mint 소개', '민트 소개', '자기소개',
  'what is mint', 'who are you', 'introduce yourself',
]

export function isMintIntroQuery(text: string): boolean {
  const normalized = text.toLowerCase().trim()
  return INTRO_KEYWORDS.some(kw => normalized.includes(kw))
}

export function isMintIntroResponse(text: string): boolean {
  return text.includes('Maritime Intelligent Navigation Tool')
}

export const MINT_INTRO_DATA = {
  greeting:     '안녕하세요! 저는 MINT예요.',
  description:  'Maritime Intelligent Navigation Tool의 약자로, MTL의 물류 업무를 도와드리기 위해 만들어졌어요.',
  features: [
    { icon: '📋', title: '견적 체크리스트', desc: '견적 메일 초안 자동 생성' },
    { icon: '✉️', title: '메시지 작성',      desc: '고객 통보·안내 메일 작성' },
    { icon: '🚢', title: '운송 모드 추천',   desc: '해상/항공/복합 최적 경로 비교' },
    { icon: '🌐', title: '통관 리스크 점검', desc: '수출입 전 위험 요소 확인' },
    { icon: '📦', title: 'HS-code 검색',    desc: '품목 코드 검색 및 메모 저장' },
    { icon: '🔍', title: 'Tracking Helper', desc: '화물 추적 번호 확인·조회' },
  ],
  footer: '또한 팀원들과의 대화를 6개 언어로 실시간 번역해드려요.\n무엇을 도와드릴까요?',
}
