CREATE TABLE public.ai_detections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  page_id uuid references public.pages(id) on delete cascade,
  conversation_id uuid,
  product_type text,
  category text not null default 'window',
  label text,
  quantity integer not null default 1,
  width_in numeric,
  height_in numeric,
  confidence numeric,
  reasoning text,
  bbox jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  approved_item_id uuid references public.takeoff_items(id) on delete set null,
  created_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_detections TO authenticated;
GRANT ALL ON public.ai_detections TO service_role;

ALTER TABLE public.ai_detections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View detections on visible projects"
  ON public.ai_detections FOR SELECT TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));

CREATE POLICY "Editors manage detections"
  ON public.ai_detections FOR ALL TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()))
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));

CREATE INDEX ai_detections_page_idx ON public.ai_detections (page_id, status);

CREATE TRIGGER update_ai_detections_updated_at
  BEFORE UPDATE ON public.ai_detections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();