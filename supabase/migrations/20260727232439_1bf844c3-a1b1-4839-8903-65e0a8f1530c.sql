CREATE TABLE public.company_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  company_name text not null default 'AWM LLC',
  legal_name text not null default 'American Windows Manufacturer LLC',
  address text,
  phone text,
  email text,
  website text,
  license_number text,
  estimator_name text,
  logo_path text,
  default_report_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own company settings"
ON public.company_settings FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();