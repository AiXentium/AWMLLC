CREATE TABLE public.project_cloud_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  provider text NOT NULL,
  folder_id text,
  folder_path text NOT NULL DEFAULT '',
  folder_name text,
  account_label text,
  sync_status text NOT NULL DEFAULT 'idle',
  sync_error text,
  last_checked_at timestamptz,
  last_synced_at timestamptz,
  linked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, provider)
);

CREATE TABLE public.cloud_source_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  provider text NOT NULL,
  remote_id text NOT NULL,
  remote_path text NOT NULL,
  remote_name text NOT NULL,
  remote_rev text,
  remote_content_hash text,
  remote_modified_time timestamptz,
  latest_rev text,
  latest_modified_time timestamptz,
  web_url text,
  mime_type text,
  size_bytes bigint,
  checksum text,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  intake_file_id uuid,
  revision_number integer NOT NULL DEFAULT 1,
  supersedes_source_file_id uuid REFERENCES public.cloud_source_files(id) ON DELETE SET NULL,
  update_available boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'imported',
  sync_note text,
  imported_by uuid,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cloud_source_files_project_idx ON public.cloud_source_files (project_id, provider);
CREATE INDEX cloud_source_files_remote_idx ON public.cloud_source_files (project_id, provider, remote_id);

CREATE TABLE public.cloud_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  provider text NOT NULL,
  export_id uuid,
  filename text NOT NULL,
  file_type text,
  mime_type text,
  remote_id text,
  remote_path text,
  folder_path text,
  folder_name text,
  web_url text,
  action text NOT NULL DEFAULT 'created',
  size_bytes bigint,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cloud_exports_project_idx ON public.cloud_exports (project_id, provider);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_cloud_links TO authenticated;
GRANT ALL ON public.project_cloud_links TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloud_source_files TO authenticated;
GRANT ALL ON public.cloud_source_files TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloud_exports TO authenticated;
GRANT ALL ON public.cloud_exports TO service_role;

ALTER TABLE public.project_cloud_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_source_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cloud links viewable by project viewers" ON public.project_cloud_links
  FOR SELECT TO authenticated USING (public.can_view_project(project_id, auth.uid()));
CREATE POLICY "cloud links managed by project editors" ON public.project_cloud_links
  FOR ALL TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()))
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));

CREATE POLICY "cloud sources viewable by project viewers" ON public.cloud_source_files
  FOR SELECT TO authenticated USING (public.can_view_project(project_id, auth.uid()));
CREATE POLICY "cloud sources managed by project editors" ON public.cloud_source_files
  FOR ALL TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()))
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));

CREATE POLICY "cloud exports viewable by project viewers" ON public.cloud_exports
  FOR SELECT TO authenticated USING (public.can_view_project(project_id, auth.uid()));
CREATE POLICY "cloud exports managed by project editors" ON public.cloud_exports
  FOR ALL TO authenticated
  USING (public.can_edit_project(project_id, auth.uid()))
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));

CREATE TRIGGER project_cloud_links_updated_at BEFORE UPDATE ON public.project_cloud_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER cloud_source_files_updated_at BEFORE UPDATE ON public.cloud_source_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();