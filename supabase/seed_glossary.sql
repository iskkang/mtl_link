-- F-1: 물류 업종 기본 용어집 초기 데이터 (38개)
-- 실행: Supabase Dashboard → SQL Editor → Run

INSERT INTO translation_glossary
  (term_ko, term_en, term_ru, term_uz, term_zh, term_ja, category, definition_ko)
VALUES
  -- ── 선하증권 / 서류 ──────────────────────────────
  ('선하증권',      'Bill of Lading',              'Коносамент',               'Akkreditiv',            '提单',       '船荷証券',         'document',  '화물 운송 계약의 증거 서류'),
  ('화물 인도 지시서','Delivery Order',             'Приказ о выдаче груза',    'Yuk topshirish buyrug''i','交货单',    '貨物引渡指図書',    'document',  '화물 인도를 지시하는 서류'),
  ('원산지 증명서',  'Certificate of Origin',       'Сертификат происхождения', 'Kelib chiqish sertifikati','原产地证书', '原産地証明書',     'document',  '상품의 원산지를 증명하는 서류'),
  ('포장 명세서',   'Packing List',                'Упаковочный лист',         'Qadoqlash ro''yxati',   '装箱单',     'パッキングリスト',  'document',  '화물의 포장 내용을 기재한 서류'),
  ('상업 송장',     'Commercial Invoice',          'Коммерческий счёт',        'Tijorat schyot-fakturasi','商业发票',  'コマーシャルインボイス','document','거래 내용과 금액을 기재한 청구서'),
  ('신용장',        'Letter of Credit',            'Аккредитив',               'Akkreditiv maktubi',    '信用证',     '信用状',           'document',  '은행이 지급을 보증하는 서류'),

  -- ── 컨테이너 / 화물 ──────────────────────────────
  ('컨테이너',      'Container',                   'Контейнер',                'Konteyner',             '集装箱',     'コンテナ',         'cargo',     '화물 수송용 금속 상자'),
  ('20피트 컨테이너','20-foot Container (TEU)',     '20-футовый контейнер',     '20 futlik konteyner',   '20英尺集装箱','20フィートコンテナ','cargo',    '표준 20피트 컨테이너'),
  ('40피트 컨테이너','40-foot Container (FEU)',     '40-футовый контейнер',     '40 futlik konteyner',   '40英尺集装箱','40フィートコンテナ','cargo',    '표준 40피트 컨테이너'),
  ('냉동 컨테이너', 'Reefer Container',            'Рефрижераторный контейнер','Sovutgichli konteyner', '冷藏集装箱', 'リーファーコンテナ','cargo',    '온도 조절이 가능한 냉동 컨테이너'),
  ('벌크 화물',     'Bulk Cargo',                  'Навалочный груз',          'Vrachga yuklar',        '散货',       'バルク貨物',       'cargo',     '포장 없이 산적 운송되는 화물'),
  ('위험물',        'Dangerous Goods (DG)',        'Опасные грузы',            'Xavfli yuklar',         '危险品',     '危険物',           'cargo',     '운송 시 특별 취급이 필요한 위험 화물'),

  -- ── 항구 / 터미널 ──────────────────────────────
  ('항구',          'Port',                        'Порт',                     'Port',                  '港口',       '港',               'port',      '선박이 접안하여 화물을 처리하는 시설'),
  ('터미널',        'Terminal',                    'Терминал',                 'Terminal',              '码头',       'ターミナル',       'port',      '항만 내 컨테이너 처리 전용 시설'),
  ('부두',          'Berth / Quay',                'Причал / Набережная',      'Qayiq rasosi',          '泊位/码头',  '岸壁/埠頭',        'port',      '선박이 접안하는 시설'),
  ('야적장',        'Container Yard (CY)',          'Контейнерный двор',        'Konteyner maydoni',     '集装箱堆场', 'コンテナヤード',   'port',      '항만의 컨테이너 보관 구역'),
  ('환적',          'Transshipment',               'Перегрузка',               'Tranzit yukni o''tkazish','转运',     'トランシップ',     'port',      '중간 항구에서 다른 선박으로 화물을 옮기는 것'),

  -- ── 운임 / 비용 ──────────────────────────────────
  ('운임',          'Freight',                     'Фрахт',                    'Yuk tashish narxi',     '运费',       '運賃',             'fee',       '화물 운송에 대한 요금'),
  ('해상 운임',     'Ocean Freight',               'Морской фрахт',            'Dengiz yuk tashish narxi','海运费',   '海上運賃',         'fee',       '해상 운송에 대한 요금'),
  ('항만 이용료',   'Port Dues',                   'Портовые сборы',           'Port to''lovlari',      '港口费',     '入港料',           'fee',       '항만 시설 이용에 따른 요금'),
  ('THC (터미널 화물 처리비)','Terminal Handling Charge','Сбор за обработку в терминале','Terminal uchun to''lov','码头操作费','ターミナルハンドリングチャージ','fee','터미널에서 컨테이너 처리 비용'),
  ('체선료',        'Demurrage',                   'Демередж',                 'Kech turish jarimasi',  '滞期费',     'デマレージ',       'fee',       '컨테이너 반납 지연 시 부과되는 요금'),
  ('지체료',        'Detention',                   'Простой',                  'Kechikish to''lovi',    '滞留费',     'ディテンション',   'fee',       '장치 기간 초과 시 부과되는 요금'),

  -- ── 통관 / 세관 ──────────────────────────────────
  ('통관',          'Customs Clearance',           'Таможенное оформление',    'Bojxona rasmiylashtiruvi','清关',     '通関',             'customs',   '세관에서 화물의 수출입을 허가받는 절차'),
  ('세관',          'Customs',                     'Таможня',                  'Bojxona',               '海关',       '税関',             'customs',   '수출입 화물의 검사와 세금을 담당하는 기관'),
  ('관세',          'Customs Duty / Tariff',       'Таможенная пошлина',       'Bojxona boji',          '关税',       '関税',             'customs',   '수입 화물에 부과되는 세금'),
  ('HS 코드',       'HS Code',                     'Код ТН ВЭД',              'HS kodi',               'HS编码',     'HSコード',         'customs',   '국제 표준 상품 분류 코드'),

  -- ── 운송 방식 ──────────────────────────────────
  ('해상 운송',     'Sea Freight / Ocean Freight', 'Морские перевозки',        'Dengiz tashuvlari',     '海运',       '海上輸送',         'transport', '선박을 이용한 화물 운송'),
  ('항공 운송',     'Air Freight',                 'Авиаперевозки',            'Havo tashuvlari',       '空运',       '航空輸送',         'transport', '항공기를 이용한 화물 운송'),
  ('육상 운송',     'Land Transport / Road Freight','Автомобильные перевозки', 'Quruqlik tashuvlari',   '陆运',       '陸上輸送',         'transport', '트럭 등 육로를 이용한 화물 운송'),
  ('복합 운송',     'Multimodal Transport',        'Мультимодальные перевозки','Multimodal tashish',    '多式联运',   '複合輸送',         'transport', '둘 이상의 운송 수단을 결합한 방식'),

  -- ── 인코텀즈 ──────────────────────────────────────
  ('FOB',           'Free On Board',               'Франко борт',             'FOB',                   'FOB（船上交货）','本船渡し',        'incoterms', '선적항에서 본선 적재 완료 시 위험 이전'),
  ('CIF',           'Cost, Insurance and Freight', 'Стоимость, страхование и фрахт','CIF',             'CIF（成本加保险加运费）','運賃保険料込み','incoterms','도착항까지의 운임·보험료 포함 조건'),
  ('EXW',           'Ex Works',                    'Ex Works (самовывоз)',     'EXW',                   '工厂交货',   '工場渡し',         'incoterms', '매도인 공장에서 인도하는 최소 의무 조건'),
  ('DDP',           'Delivered Duty Paid',         'Поставка с оплатой пошлины','DDP',                 '完税后交货', '関税込み持込渡し', 'incoterms', '수입 관세까지 매도인이 부담하는 조건'),

  -- ── 선사 / 대리점 ─────────────────────────────────
  ('선사',          'Shipping Line / Carrier',     'Судоходная компания',      'Kema kompaniyasi',      '船公司',     '船会社',           'agent',     '선박을 운항하여 화물을 운송하는 회사'),
  ('포워더',        'Freight Forwarder',           'Экспедитор',               'Yuk ekspeditori',       '货运代理',   'フレートフォワーダー','agent',   '화주를 대신하여 운송을 주선하는 업체'),
  ('선박 대리점',   'Shipping Agent',              'Судовой агент',            'Kema agenti',           '船舶代理',   '船舶代理店',       'agent',     '항구에서 선사를 대리하는 업체')
ON CONFLICT (term_ko) DO UPDATE SET
  term_en       = EXCLUDED.term_en,
  term_ru       = EXCLUDED.term_ru,
  term_uz       = EXCLUDED.term_uz,
  term_zh       = EXCLUDED.term_zh,
  term_ja       = EXCLUDED.term_ja,
  category      = EXCLUDED.category,
  definition_ko = EXCLUDED.definition_ko,
  updated_at    = now();
