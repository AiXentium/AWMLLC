-- 1. Configurable, server-enforced intake limits ---------------------------------
CREATE TABLE public.intake_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  max_pdf_bytes bigint NOT NULL DEFAULT 1073741824,
  max_zip_bytes bigint NOT NULL DEFAULT 104857600,
  max_archive_entries integer NOT NULL DEFAULT 2000,
  max_uncompressed_bytes bigint NOT NULL DEFAULT 1610612736,
  max_compression_ratio numeric NOT NULL DEFAULT 120,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.intake_settings TO authenticated;
GRANT ALL ON public.intake_settings TO service_role;
ALTER TABLE public.intake_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intake_settings_read" ON public.intake_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "intake_settings_admin_write" ON public.intake_settings
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER intake_settings_updated_at BEFORE UPDATE ON public.intake_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.intake_settings (id) VALUES (true);

-- 2. Intake jobs -----------------------------------------------------------------
CREATE TABLE public.intake_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid,
  status text NOT NULL DEFAULT 'queued',
  label text,
  total_files integer NOT NULL DEFAULT 0,
  accepted_count integer NOT NULL DEFAULT 0,
  ignored_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_jobs TO authenticated;
GRANT ALL ON public.intake_jobs TO service_role;
ALTER TABLE public.intake_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intake_jobs_view" ON public.intake_jobs
  FOR SELECT TO authenticated USING (public.can_view_project(project_id, auth.uid()));
CREATE POLICY "intake_jobs_edit" ON public.intake_jobs
  FOR ALL TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()))
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));

CREATE TRIGGER intake_jobs_updated_at BEFORE UPDATE ON public.intake_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX intake_jobs_project_idx ON public.intake_jobs (project_id, created_at DESC);

-- 3. Intake files ----------------------------------------------------------------
CREATE TABLE public.intake_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.intake_jobs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_file_id uuid REFERENCES public.intake_files(id) ON DELETE CASCADE,
  source_kind text NOT NULL DEFAULT 'pdf',
  original_filename text NOT NULL,
  source_archive text,
  source_folder text,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  checksum text,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  error_message text,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  duplicate_of uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_files TO authenticated;
GRANT ALL ON public.intake_files TO service_role;
ALTER TABLE public.intake_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intake_files_view" ON public.intake_files
  FOR SELECT TO authenticated USING (public.can_view_project(project_id, auth.uid()));
CREATE POLICY "intake_files_edit" ON public.intake_files
  FOR ALL TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()))
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));

CREATE TRIGGER intake_files_updated_at BEFORE UPDATE ON public.intake_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX intake_files_job_idx ON public.intake_files (job_id, created_at);
CREATE INDEX intake_files_project_idx ON public.intake_files (project_id, status);

-- 4. Plan set metadata -----------------------------------------------------------
ALTER TABLE public.documents
  ADD COLUMN checksum text,
  ADD COLUMN category text,
  ADD COLUMN source_archive text,
  ADD COLUMN source_folder text,
  ADD COLUMN building text,
  ADD COLUMN revision text,
  ADD COLUMN intake_file_id uuid REFERENCES public.intake_files(id) ON DELETE SET NULL,
  ADD COLUMN supersedes_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  ADD COLUMN pages_processed integer NOT NULL DEFAULT 0,
  ADD COLUMN pages_failed integer NOT NULL DEFAULT 0;

CREATE INDEX documents_checksum_idx ON public.documents (project_id, checksum);

-- 5. Idempotent page processing --------------------------------------------------
DELETE FROM public.pages a
  USING public.pages b
  WHERE a.document_id = b.document_id
    AND a.page_number = b.page_number
    AND a.ctid > b.ctid;

CREATE UNIQUE INDEX pages_document_page_unique ON public.pages (document_id, page_number);