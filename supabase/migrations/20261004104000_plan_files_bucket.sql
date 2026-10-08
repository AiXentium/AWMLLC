-- Creates the private plan-files storage bucket and RLS policies.
-- Object paths are {project_id}/intake/{file_id}.{ext}, so access is gated
-- on the existing can_view_project / can_edit_project helpers.

insert into storage.buckets (id, name, public)
values ('plan-files', 'plan-files', false)
on conflict (id) do nothing;

-- Allow large plan sets (1 GB) — Supabase defaults to 50 MB.
update storage.buckets set file_size_limit = 1073741824 where id = 'plan-files';

drop policy if exists "plan-files insert" on storage.objects;
create policy "plan-files insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'plan-files'
    and public.can_edit_project(((storage.foldername(name))[1])::uuid, auth.uid())
  );

drop policy if exists "plan-files read" on storage.objects;
create policy "plan-files read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'plan-files'
    and public.can_view_project(((storage.foldername(name))[1])::uuid, auth.uid())
  );

drop policy if exists "plan-files update" on storage.objects;
create policy "plan-files update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'plan-files'
    and public.can_edit_project(((storage.foldername(name))[1])::uuid, auth.uid())
  );

drop policy if exists "plan-files delete" on storage.objects;
create policy "plan-files delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'plan-files'
    and public.can_edit_project(((storage.foldername(name))[1])::uuid, auth.uid())
  );
