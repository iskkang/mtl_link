-- FBX 운임지수 테이블
-- Python 스크래퍼(fbx_scraper/scraper.py)가 주 1회 갱신
CREATE TABLE IF NOT EXISTS public.fbx_rates (
  code        text PRIMARY KEY,
  route       text NOT NULL,
  value       text NOT NULL,
  change      text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fbx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fbx_rates_read_all"
  ON public.fbx_rates FOR SELECT USING (true);

-- 초기 시드 데이터 (Python 스크래퍼 실행 전 표시용 — 실제 값으로 자동 교체됨)
INSERT INTO public.fbx_rates (code, route, value, change, sort_order) VALUES
  ('FBX01', '중국 - 북미서안',   '$2,350', '+1.20%',  1),
  ('FBX02', '북미서안 - 중국',   '$440',   '-2.10%',  2),
  ('FBX03', '중국 - 북미동안',   '$3,100', '+0.80%',  3),
  ('FBX04', '북미동안 - 중국',   '$480',   '0.00%',   4),
  ('FBX11', '중국 - 북유럽',     '$2,100', '+3.40%',  5),
  ('FBX12', '북유럽 - 중국',     '$580',   '-1.50%',  6),
  ('FBX13', '중국 - 지중해',     '$2,200', '+2.10%',  7),
  ('FBX14', '지중해 - 중국',     '$620',   '0.00%',   8),
  ('FBX21', '북미동안 - 북유럽', '$1,800', '-0.90%',  9),
  ('FBX22', '북유럽 - 북미동안', '$1,450', '+1.70%', 10),
  ('FBX24', '유럽 - 남미동안',   '$2,300', '+2.50%', 11),
  ('FBX26', '유럽 - 남미서안',   '$1,750', '0.00%',  12)
ON CONFLICT (code) DO NOTHING;
