/**
 * MTL Shipping Agency — Logistics Domain Glossary
 *
 * Standard term mappings for 6 languages.
 * Used as reference for the translate-text Edge Function system prompt.
 * To add a term: append to LOGISTICS_GLOSSARY, then redeploy the edge function.
 */

export interface GlossaryEntry {
  ko: string
  en: string
  zh: string
  ja: string
  ru: string
  uz: string
  note?: string
}

export const LOGISTICS_GLOSSARY: GlossaryEntry[] = [
  // ─── 운송 수단/장비 ───
  { ko: '컨테이너',      en: 'container',   zh: '集装箱', ja: 'コンテナ',      ru: 'контейнер',                   uz: 'konteyner',
    note: '中文에서 "箱子"도 물류 문맥에서는 컨테이너로 번역' },
  { ko: '트레일러',      en: 'trailer',     zh: '拖车',   ja: 'トレーラー',    ru: 'трейлер',                     uz: 'treyler' },
  { ko: '섀시',          en: 'chassis',     zh: '底盘',   ja: 'シャーシ',      ru: 'шасси',                       uz: 'shassi' },
  { ko: '선박',          en: 'vessel',      zh: '船舶',   ja: '船舶',          ru: 'судно',                       uz: 'kema' },
  { ko: '선사',          en: 'carrier',     zh: '船公司', ja: '船会社',        ru: 'судоходная компания',          uz: 'tashuvchi' },
  { ko: '포워더',        en: 'forwarder',   zh: '货代',   ja: 'フォワーダー',  ru: 'экспедитор',                  uz: 'ekspeditor' },

  // ─── 항구/시설 ───
  { ko: '항구',          en: 'port',        zh: '港口',   ja: '港',            ru: 'порт',                        uz: 'port' },
  { ko: '터미널',        en: 'terminal',    zh: '码头',   ja: 'ターミナル',    ru: 'терминал',                    uz: 'terminal' },
  { ko: '창고',          en: 'warehouse',   zh: '仓库',   ja: '倉庫',          ru: 'склад',                       uz: 'ombor' },
  { ko: '보세창고',      en: 'bonded warehouse', zh: '保税仓库', ja: '保税倉庫', ru: 'таможенный склад',           uz: 'bojxona ombori' },
  { ko: '출발지',        en: 'origin',      zh: '起运地', ja: '出発地',        ru: 'пункт отправления',           uz: "jo'natuvchi joy" },
  { ko: '도착지',        en: 'destination', zh: '目的地', ja: '目的地',        ru: 'пункт назначения',            uz: 'manzil' },

  // ─── 서류/절차 ───
  { ko: 'B/L',           en: 'B/L',         zh: '提单',   ja: '船荷証券',      ru: 'коносамент',                  uz: 'konosament',
    note: 'Bill of Lading — 약어 그대로 유지' },
  { ko: '통관',          en: 'customs clearance', zh: '报关', ja: '通関',      ru: 'таможенное оформление',       uz: 'bojxona rasmiylashtirish' },
  { ko: '수출신고',      en: 'export declaration', zh: '出口报关', ja: '輸出申告', ru: 'экспортная декларация',   uz: 'eksport deklaratsiyasi' },
  { ko: '수입신고',      en: 'import declaration', zh: '进口报关', ja: '輸入申告', ru: 'импортная декларация',    uz: 'import deklaratsiyasi' },
  { ko: '인보이스',      en: 'invoice',     zh: '发票',   ja: 'インボイス',    ru: 'инвойс',                      uz: 'invoys' },
  { ko: '패킹리스트',    en: 'packing list',zh: '装箱单', ja: 'パッキングリスト', ru: 'упаковочный лист',        uz: "qadoqlash ro'yxati" },
  { ko: '원산지증명서',  en: 'certificate of origin', zh: '原产地证书', ja: '原産地証明書', ru: 'сертификат происхождения', uz: 'kelib chiqishi sertifikati' },
  { ko: 'HS코드',        en: 'HS code',     zh: 'HS编码', ja: 'HSコード',      ru: 'HS-код',                      uz: 'HS kodi' },

  // ─── 비용 ───
  { ko: '해상운임',      en: 'ocean freight',   zh: '海运费', ja: '海上運賃', ru: 'морской фрахт',              uz: 'dengiz fraxti' },
  { ko: '항공운임',      en: 'air freight',     zh: '空运费', ja: '航空運賃', ru: 'авиафрахт',                  uz: 'havo fraxti' },
  { ko: '철도운임',      en: 'rail freight',    zh: '铁路运费',ja: '鉄道運賃',ru: 'железнодорожный фрахт',     uz: "temir yo'l fraxti" },
  { ko: '부대비',        en: 'surcharge',       zh: '附加费', ja: '付加料金', ru: 'дополнительный сбор',        uz: "qo'shimcha to'lov" },
  { ko: 'THC',           en: 'THC',             zh: 'THC',    ja: 'THC',      ru: 'THC',                        uz: 'THC',
    note: 'Terminal Handling Charge — 약어 그대로 유지' },
  { ko: '데머리지',      en: 'demurrage',       zh: '滞期费', ja: 'デマレージ',ru: 'демередж',                  uz: 'demerej' },
  { ko: '디테션',        en: 'detention',       zh: '滞箱费', ja: 'ディテンション', ru: 'детеншн',               uz: 'detenshn' },

  // ─── 행위/상태 ───
  { ko: '선적',          en: 'loading',         zh: '装船',   ja: '船積み',   ru: 'погрузка',                   uz: 'yuklash' },
  { ko: '양하',          en: 'unloading',       zh: '卸船',   ja: '荷揚げ',   ru: 'выгрузка',                   uz: 'tushirish' },
  { ko: '컨테이너 적입', en: 'stuffing',        zh: '装柜',   ja: 'バンニング',ru: 'затарка контейнера',        uz: 'konteynerga yuklash' },
  { ko: '컨테이너 적출', en: 'devanning',       zh: '拆柜',   ja: 'デバンニング', ru: 'разгрузка контейнера',  uz: 'konteynerdan tushirish' },
  { ko: '출항',          en: 'departure',       zh: '开船',   ja: '出港',     ru: 'отправление',                uz: "jo'nash" },
  { ko: '입항',          en: 'arrival',         zh: '到港',   ja: '入港',     ru: 'прибытие',                   uz: 'kelish' },
  { ko: 'ETD',           en: 'ETD',             zh: 'ETD',    ja: 'ETD',      ru: 'ETD',                        uz: 'ETD',
    note: 'Estimated Time of Departure' },
  { ko: 'ETA',           en: 'ETA',             zh: 'ETA',    ja: 'ETA',      ru: 'ETA',                        uz: 'ETA' },

  // ─── 사람/직책 ───
  { ko: '화주',          en: 'shipper',         zh: '货主',   ja: '荷主',     ru: 'грузоотправитель',           uz: 'yuk egasi' },
  { ko: '수하인',        en: 'consignee',       zh: '收货人', ja: '荷受人',   ru: 'грузополучатель',            uz: 'qabul qiluvchi' },
  { ko: '대리점',        en: 'agent',           zh: '代理',   ja: '代理店',   ru: 'агент',                      uz: 'agent' },
  { ko: '기사',          en: 'driver',          zh: '司机',   ja: '運転手',   ru: 'водитель',                   uz: 'haydovchi' },

  // ─── 운송 구간 ───
  { ko: 'CY',            en: 'CY',              zh: '堆场',   ja: 'CY',       ru: 'CY',                         uz: 'CY',
    note: 'Container Yard' },
  { ko: 'CFS',           en: 'CFS',             zh: '集装箱货运站', ja: 'CFS', ru: 'CFS',                       uz: 'CFS',
    note: 'Container Freight Station' },
  { ko: 'FCL',           en: 'FCL',             zh: '整箱',   ja: 'FCL',      ru: 'FCL',                        uz: 'FCL' },
  { ko: 'LCL',           en: 'LCL',             zh: '拼箱',   ja: 'LCL',      ru: 'LCL',                        uz: 'LCL' },

  // ─── 노선 ───
  { ko: 'TCR',           en: 'TCR',             zh: '中欧班列',ja: 'TCR',     ru: 'ТЦР',                        uz: 'TCR',
    note: 'Trans-China Railway' },
  { ko: 'TSR',           en: 'TSR',             zh: '俄铁',   ja: 'TSR',      ru: 'Транссиб',                   uz: 'TSR',
    note: 'Trans-Siberian Railway' },
]
