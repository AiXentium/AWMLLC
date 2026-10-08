CREATE TABLE public.app_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connector_id text NOT NULL,
  connection_key_ciphertext text NOT NULL,
  account_email text,
  account_name text,
  scopes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);
GRANT ALL ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.drive_source_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  intake_file_id uuid REFERENCES public.intake_files(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  drive_file_id text NOT NULL,
  drive_name text NOT NULL,
  drive_mime_type text,
  drive_folder_id text,
  drive_folder_name text,
  drive_modified_time timestamptz,
  drive_web_view_link text,
  drive_md5 text,
  size_bytes bigint,
  checksum text,
  status text NOT NULL DEFAULT 'imported',
  update_available boolean NOT NULL DEFAULT false,
  latest_modified_time timestamptz,
  last_checked_at timestamptz,
  imported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX drive_source_files_project_idx ON public.drive_source_files (project_id, created_at DESC);
CREATE INDEX drive_source_files_file_idx ON public.drive_source_files (project_id, drive_file_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drive_source_files TO authenticated;
GRANT ALL ON public.drive_source_files TO service_role;
ALTER TABLE public.drive_source_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drive_source_files_select" ON public.drive_source_files FOR SELECT TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));
CREATE POLICY "drive_source_files_insert" ON public.drive_source_files FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));
CREATE POLICY "drive_source_files_update" ON public.drive_source_files FOR UPDATE TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()))
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));
CREATE POLICY "drive_source_files_delete" ON public.drive_source_files FOR DELETE TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()));
CREATE TRIGGER drive_source_files_updated_at BEFORE UPDATE ON public.drive_source_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.drive_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  export_id uuid REFERENCES public.exports(id) ON DELETE SET NULL,
  drive_file_id text NOT NULL,
  drive_folder_id text,
  drive_folder_name text,
  filename text NOT NULL,
  file_type text,
  mime_type text,
  size_bytes bigint,
  action text NOT NULL DEFAULT 'created',
  drive_web_view_link text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX drive_exports_project_idx ON public.drive_exports (project_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drive_exports TO authenticated;
GRANT ALL ON public.drive_exports TO service_role;
ALTER TABLE public.drive_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drive_exports_select" ON public.drive_exports FOR SELECT TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));
CREATE POLICY "drive_exports_insert" ON public.drive_exports FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));
CREATE POLICY "drive_exports_delete" ON public.drive_exports FOR DELETE TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()));