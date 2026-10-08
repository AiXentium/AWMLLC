
-- ============ 1. SOFT DELETE COLUMNS ============
do $$
declare t text;
begin
  foreach t in array array[
    'documents','pages','working_sets','exports','incoming_files','intake_files',
    'quote_request_documents','project_address_candidates','project_field_extractions',
    'plan_schedule_entries','project_quantity_estimates'
  ] loop
    execute format('alter table public.%I
      add column if not exists deleted_at timestamptz,
      add column if not exists deleted_by uuid,
      add column if not exists deletion_reason text,
      add column if not exists original_parent_id uuid,
      add column if not exists restore_status text not null default ''active''', t);
    execute format('create index if not exists %I on public.%I (deleted_at)', t||'_deleted_at_idx', t);
  end loop;
end $$;

alter table public.takeoff_items
  add column if not exists deleted_by uuid,
  add column if not exists deletion_reason text,
  add column if not exists original_parent_id uuid,
  add column if not exists restore_status text not null default 'active';

alter table public.projects
  add column if not exists deleted_by uuid,
  add column if not exists deletion_reason text,
  add column if not exists restore_status text not null default 'active',
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid,
  add column if not exists lock_reason text,
  add column if not exists archived_at timestamptz,
  add column if not exists archive_version integer not null default 0;

alter table public.documents
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid,
  add column if not exists lock_reason text;

alter table public.pages
  add column if not exists excluded_at timestamptz,
  add column if not exists excluded_by uuid,
  add column if not exists exclusion_reason text;

-- ============ 2. ADDRESS CANDIDATE LIFECYCLE ============
alter table public.project_address_candidates
  add column if not exists review_status text not null default 'candidate',
  add column if not exists duplicate_of uuid,
  add column if not exists dedupe_key text,
  add column if not exists normalized_address text,
  add column if not exists geocode_confidence numeric,
  add column if not exists confirmed_by uuid,
  add column if not exists confirmed_at timestamptz,
  add column if not exists pin_adjusted boolean not null default false,
  add column if not exists municipality text,
  add column if not exists notes text;

create index if not exists project_address_candidates_dedupe_idx
  on public.project_address_candidates (project_id, dedupe_key);

alter table public.project_field_extractions
  add column if not exists dedupe_key text,
  add column if not exists suppressed boolean not null default false;

-- ============ 3. PROJECT CONTACTS ============
create table if not exists public.project_contacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  run_id uuid,
  document_id uuid,
  page_id uuid,
  role text not null,
  role_label text,
  person_name text,
  company text,
  license_number text,
  email text,
  phone text,
  phone_secondary text,
  address text,
  city text,
  state text,
  postal_code text,
  website text,
  source_kind text not null default 'document',
  source_document text,
  source_sheet text,
  source_page_number integer,
  source_text text,
  sources jsonb not null default '[]'::jsonb,
  confidence numeric,
  verification_status text not null default 'unverified',
  user_corrected boolean not null default false,
  last_verified_at timestamptz,
  dedupe_key text,
  duplicate_of uuid,
  review_status text not null default 'candidate',
  notes text,
  deleted_at timestamptz,
  deleted_by uuid,
  deletion_reason text,
  original_parent_id uuid,
  restore_status text not null default 'active',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_contacts_project_idx on public.project_contacts (project_id);
create index if not exists project_contacts_dedupe_idx on public.project_contacts (project_id, dedupe_key);

grant select, insert, update, delete on public.project_contacts to authenticated;
grant all on public.project_contacts to service_role;
alter table public.project_contacts enable row level security;
create policy "View contacts in visible projects" on public.project_contacts
  for select using (public.can_view_project(project_id, auth.uid()));
create policy "Edit contacts in editable projects" on public.project_contacts
  for all using (public.can_edit_project(project_id, auth.uid()))
  with check (public.can_edit_project(project_id, auth.uid()));
create trigger project_contacts_updated_at before update on public.project_contacts
  for each row execute function public.update_updated_at_column();

-- ============ 4. PROJECT AUTHORITIES ============
create table if not exists public.project_authorities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  department_type text not null,
  department_name text,
  jurisdiction_level text,
  jurisdiction_name text,
  address text,
  city text,
  state text,
  postal_code text,
  phone text,
  email text,
  website text,
  permit_portal text,
  contact_person text,
  hours text,
  services text,
  source_kind text not null default 'online',
  official_source_url text,
  retrieved_at timestamptz,
  confidence numeric,
  verification_status text not null default 'candidate',
  user_notes text,
  dedupe_key text,
  deleted_at timestamptz,
  deleted_by uuid,
  deletion_reason text,
  original_parent_id uuid,
  restore_status text not null default 'active',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_authorities_project_idx on public.project_authorities (project_id);

grant select, insert, update, delete on public.project_authorities to authenticated;
grant all on public.project_authorities to service_role;
alter table public.project_authorities enable row level security;
create policy "View authorities in visible projects" on public.project_authorities
  for select using (public.can_view_project(project_id, auth.uid()));
create policy "Edit authorities in editable projects" on public.project_authorities
  for all using (public.can_edit_project(project_id, auth.uid()))
  with check (public.can_edit_project(project_id, auth.uid()));
create trigger project_authorities_updated_at before update on public.project_authorities
  for each row execute function public.update_updated_at_column();

-- ============ 5. ARCHIVE SNAPSHOTS ============
create table if not exists public.project_archives (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version integer not null,
  label text,
  reason text,
  snapshot jsonb not null default '{}'::jsonb,
  counts jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);
grant select, insert on public.project_archives to authenticated;
grant all on public.project_archives to service_role;
alter table public.project_archives enable row level security;
create policy "View archives in visible projects" on public.project_archives
  for select using (public.can_view_project(project_id, auth.uid()));
create policy "Create archives in editable projects" on public.project_archives
  for insert with check (public.can_edit_project(project_id, auth.uid()));

-- ============ 6. LOCK ENFORCEMENT ============
create or replace function public.is_project_locked(_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select locked_at is not null from public.projects where id = _project_id), false);
$$;

create or replace function public.block_when_project_locked()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if tg_op = 'DELETE' then
    execute format('select ($1).%I', tg_argv[0]) into pid using old;
  else
    execute format('select ($1).%I', tg_argv[0]) into pid using new;
  end if;
  if pid is not null and public.is_project_locked(pid) then
    raise exception 'Project is locked and read-only. Unlock it to make changes.'
      using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create or replace function public.block_working_set_pages_when_locked()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select project_id into pid from public.working_sets
    where id = coalesce(new.working_set_id, old.working_set_id);
  if pid is not null and public.is_project_locked(pid) then
    raise exception 'Project is locked and read-only. Unlock it to make changes.'
      using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'documents','pages','working_sets','takeoff_items','annotations','ai_detections',
    'project_intelligence_facts','project_quantity_estimates','project_contacts',
    'project_authorities','project_address_candidates','project_field_extractions',
    'plan_schedule_entries','page_scales'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t||'_locked_guard', t);
    execute format(
      'create trigger %I before insert or update or delete on public.%I
       for each row execute function public.block_when_project_locked(%L)',
      t||'_locked_guard', t, 'project_id');
  end loop;
end $$;

drop trigger if exists working_set_pages_locked_guard on public.working_set_pages;
create trigger working_set_pages_locked_guard
  before insert or update or delete on public.working_set_pages
  for each row execute function public.block_working_set_pages_when_locked();

-- projects itself: allow lock/unlock/archive edits, block everything else while locked
create or replace function public.block_project_edit_when_locked()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.locked_at is not null then
    if (to_jsonb(new) - 'locked_at' - 'locked_by' - 'lock_reason' - 'archived_at'
        - 'archive_version' - 'updated_at' - 'deleted_at' - 'deleted_by'
        - 'deletion_reason' - 'restore_status' - 'status')
       is distinct from
       (to_jsonb(old) - 'locked_at' - 'locked_by' - 'lock_reason' - 'archived_at'
        - 'archive_version' - 'updated_at' - 'deleted_at' - 'deleted_by'
        - 'deletion_reason' - 'restore_status' - 'status') then
      raise exception 'Project is locked and read-only. Unlock it to make changes.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists projects_locked_guard on public.projects;
create trigger projects_locked_guard before update on public.projects
  for each row execute function public.block_project_edit_when_locked();
