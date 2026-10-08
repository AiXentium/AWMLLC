
-- Storage policies for plan-files and project-exports (path: <project_id>/...)
create policy "plan files viewable by project members"
on storage.objects for select to authenticated
using (
  bucket_id in ('plan-files','project-exports')
  and public.can_view_project(nullif(split_part(name, '/', 1), '')::uuid, auth.uid())
);

create policy "plan files insertable by project editors"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('plan-files','project-exports')
  and public.can_edit_project(nullif(split_part(name, '/', 1), '')::uuid, auth.uid())
);

create policy "plan files updatable by project editors"
on storage.objects for update to authenticated
using (
  bucket_id in ('plan-files','project-exports')
  and public.can_edit_project(nullif(split_part(name, '/', 1), '')::uuid, auth.uid())
)
with check (
  bucket_id in ('plan-files','project-exports')
  and public.can_edit_project(nullif(split_part(name, '/', 1), '')::uuid, auth.uid())
);

create policy "plan files deletable by project editors"
on storage.objects for delete to authenticated
using (
  bucket_id in ('plan-files','project-exports')
  and public.can_edit_project(nullif(split_part(name, '/', 1), '')::uuid, auth.uid())
);

-- Project detail fields
alter table public.projects
  add column if not exists project_number text,
  add column if not exists county text,
  add column if not exists general_contractor text,
  add column if not exists architect text,
  add column if not exists municipality text,
  add column if not exists building_department text,
  add column if not exists buildings text[],
  add column if not exists floors text[],
  add column if not exists plan_date date,
  add column if not exists revision text,
  add column if not exists due_date date,
  add column if not exists estimator_id uuid,
  add column if not exists reviewer_id uuid,
  add column if not exists notes text;

-- Takeoff item detail fields
alter table public.takeoff_items
  add column if not exists unit text,
  add column if not exists elevation text,
  add column if not exists product_type text,
  add column if not exists description text,
  add column if not exists system text,
  add column if not exists finish text,
  add column if not exists impact boolean,
  add column if not exists manufacturer text,
  add column if not exists series text,
  add column if not exists source_x numeric,
  add column if not exists source_y numeric,
  add column if not exists ai_confidence numeric,
  add column if not exists primary_image_path text;

-- Export bookkeeping
alter table public.exports
  add column if not exists filename text,
  add column if not exists size_bytes bigint,
  add column if not exists error_message text;

-- Pages processing / thumbnails
alter table public.pages
  add column if not exists processing_error text;

create index if not exists idx_pages_document on public.pages(document_id, page_number);
create index if not exists idx_annotations_page on public.annotations(page_id) where deleted_at is null;
create index if not exists idx_takeoff_items_project on public.takeoff_items(project_id) where deleted_at is null;
create index if not exists idx_documents_project on public.documents(project_id);
