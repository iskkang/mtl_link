-- =============================================
-- 1. profiles에 role 컬럼 추가
-- =============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member'
  CHECK (role IN ('admin', 'member', 'read_only'));

UPDATE public.profiles SET role = 'admin' WHERE is_admin = true;

-- =============================================
-- 2. quotation_requests
-- =============================================
CREATE TABLE IF NOT EXISTS public.quotation_requests (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_name     text,
  raw_inquiry       text,
  item_name         text,
  origin            text,
  destination       text,
  gross_weight      numeric,
  cbm               numeric,
  incoterms         text,
  missing_info      jsonb,
  checklist         jsonb,
  customer_message  text,
  status            text        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'waiting_info', 'quoted', 'closed')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quotation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can manage own requests"
  ON public.quotation_requests FOR ALL
  USING (auth.uid() = created_by);

-- =============================================
-- 3. hs_code_notes
-- =============================================
CREATE TABLE IF NOT EXISTS public.hs_code_notes (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name           text        NOT NULL,
  item_description    text,
  country             text        NOT NULL,
  hs_code_candidate   text,
  customs_notes       text,
  required_documents  jsonb,
  risk_notes          text,
  source              text,
  confidence_label    text        NOT NULL DEFAULT 'Medium'
    CHECK (confidence_label IN ('High', 'Medium', 'Low')),
  approval_status     text        NOT NULL DEFAULT 'draft'
    CHECK (approval_status IN ('draft', 'pending_review', 'verified', 'rejected', 'expired')),
  created_by          uuid        NOT NULL REFERENCES public.profiles(id),
  approved_by         uuid        REFERENCES public.profiles(id),
  approved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hs_code_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can view hs_code_notes"
  ON public.hs_code_notes FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "members can insert hs_code_notes"
  ON public.hs_code_notes FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "admins can update hs_code_notes"
  ON public.hs_code_notes FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- 4. knowledge_base
-- =============================================
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text        NOT NULL,
  category        text        NOT NULL DEFAULT 'general'
    CHECK (category IN ('hs', 'customs', 'message', 'quotation', 'tracking', 'claim', 'general')),
  content         text        NOT NULL,
  tags            text[],
  country         text,
  item_category   text,
  status          text        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'verified', 'rejected', 'expired')),
  created_by      uuid        NOT NULL REFERENCES public.profiles(id),
  approved_by     uuid        REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can view verified knowledge"
  ON public.knowledge_base FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "members can insert knowledge"
  ON public.knowledge_base FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "admins can update knowledge"
  ON public.knowledge_base FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- 5. tracking_helpers
-- =============================================
CREATE TABLE IF NOT EXISTS public.tracking_helpers (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by            uuid        NOT NULL REFERENCES public.profiles(id),
  tracking_type         text        NOT NULL DEFAULT 'unknown'
    CHECK (tracking_type IN ('ocean_container', 'air_awb', 'bl', 'booking', 'unknown')),
  tracking_no           text        NOT NULL,
  carrier_name          text,
  official_tracking_url text,
  current_status        text,
  current_location      text,
  eta                   timestamptz,
  memo                  text,
  customer_message      text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tracking_helpers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can manage own tracking"
  ON public.tracking_helpers FOR ALL
  USING (auth.uid() = created_by);

-- =============================================
-- 6. audit_logs
-- =============================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES public.profiles(id),
  action_type   text        NOT NULL,
  target_table  text        NOT NULL,
  target_id     uuid,
  before_value  jsonb,
  after_value   jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins can view audit_logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "system can insert audit_logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
