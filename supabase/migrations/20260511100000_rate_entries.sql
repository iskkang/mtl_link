-- Rate Finder: structured rate data from Excel uploads
CREATE TABLE IF NOT EXISTS public.rate_entries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file   text,
  agent         text,
  mode          text,
  pol           text,
  loading       text,
  border        text,
  pod           text,
  type          text,
  owner         text,
  rate_jan      numeric,
  rate_feb      numeric,
  rate_mar      numeric,
  rate_apr      numeric,
  rate_may      numeric,
  ltime         text,
  remark        text,
  valid_month   text,
  created_by    uuid REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can view rate_entries"
  ON public.rate_entries FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "members can insert rate_entries"
  ON public.rate_entries FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "members can delete own rate_entries"
  ON public.rate_entries FOR DELETE
  USING (auth.uid() = created_by);
