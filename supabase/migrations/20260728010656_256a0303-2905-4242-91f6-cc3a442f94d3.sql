CREATE TABLE public.plan_analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  working_set_id uuid REFERENCES public.working_sets(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',
  stage_message text,
  sheets_total integer NOT NULL DEFAULT 0,
  sheets_analyzed integer NOT NULL DEFAULT 0,
  sheets_selected integer NOT NULL DEFAULT 0,
  schedules_found integer NOT NULL DEFAULT 0,
  window_count integer NOT NULL DEFAULT 0,
  door_count integer NOT NULL DEFAULT 0,
  confidence numeric,
  used_vision boolean NOT NULL DEFAULT false,
  provider text,
  model text,
  error_message text,
  approved_at timestamptz,
  approved_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.plan_sheet_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.plan_analysis_runs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  page_id uuid REFERENCES public.pages(id) ON DELETE SET NULL,
  page_number integer NOT NULL,
  sheet_number text,
  title text,
  category text NOT NULL DEFAULT 'other',
  relevance integer NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0.5,
  reason text,
  selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.plan_schedule_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.plan_analysis_runs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  page_id uuid REFERENCES public.pages(id) ON DELETE SET NULL,
  page_number integer,
  source_sheet text,
  schedule_type text NOT NULL DEFAULT 'window',
  mark text,
  type_label text,
  width text,
  height text,
  quantity integer NOT NULL DEFAULT 1,
  material text,
  glazing text,
  operation text,
  notes text,
  callout_matches integer NOT NULL DEFAULT 0,
  callout_sheets text[],
  confidence numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.plan_analysis_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.plan_analysis_runs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  page_id uuid REFERENCES public.pages(id) ON DELETE SET NULL,
  page_number integer,
  source_sheet text,
  kind text NOT NULL DEFAULT 'note',
  severity text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX plan_analysis_runs_project_idx ON public.plan_analysis_runs (project_id, created_at DESC);
CREATE INDEX plan_sheet_classifications_run_idx ON public.plan_sheet_classifications (run_id);
CREATE INDEX plan_sheet_classifications_project_idx ON public.plan_sheet_classifications (project_id);
CREATE INDEX plan_schedule_entries_run_idx ON public.plan_schedule_entries (run_id);
CREATE INDEX plan_schedule_entries_project_idx ON public.plan_schedule_entries (project_id);
CREATE INDEX plan_analysis_issues_run_idx ON public.plan_analysis_issues (run_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_analysis_runs TO authenticated;
GRANT ALL ON public.plan_analysis_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_sheet_classifications TO authenticated;
GRANT ALL ON public.plan_sheet_classifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_schedule_entries TO authenticated;
GRANT ALL ON public.plan_schedule_entries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_analysis_issues TO authenticated;
GRANT ALL ON public.plan_analysis_issues TO service_role;

ALTER TABLE public.plan_analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_sheet_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_analysis_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View plan analysis runs" ON public.plan_analysis_runs
  FOR SELECT TO authenticated USING (public.can_view_project(project_id, auth.uid()));
CREATE POLICY "Edit plan analysis runs" ON public.plan_analysis_runs
  FOR ALL TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()))
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));

CREATE POLICY "View plan sheet classifications" ON public.plan_sheet_classifications
  FOR SELECT TO authenticated USING (public.can_view_project(project_id, auth.uid()));
CREATE POLICY "Edit plan sheet classifications" ON public.plan_sheet_classifications
  FOR ALL TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()))
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));

CREATE POLICY "View plan schedule entries" ON public.plan_schedule_entries
  FOR SELECT TO authenticated USING (public.can_view_project(project_id, auth.uid()));
CREATE POLICY "Edit plan schedule entries" ON public.plan_schedule_entries
  FOR ALL TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()))
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));

CREATE POLICY "View plan analysis issues" ON public.plan_analysis_issues
  FOR SELECT TO authenticated USING (public.can_view_project(project_id, auth.uid()));
CREATE POLICY "Edit plan analysis issues" ON public.plan_analysis_issues
  FOR ALL TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()))
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));

CREATE TRIGGER plan_analysis_runs_updated_at
  BEFORE UPDATE ON public.plan_analysis_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();