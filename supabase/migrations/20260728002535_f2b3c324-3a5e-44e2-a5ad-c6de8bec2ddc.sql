
alter table public.projects
  add column if not exists unit_suite text,
  add column if not exists country text,
  add column if not exists parcel_id text,
  add column if not exists subdivision text,
  add column if not exists owner_developer text,
  add column if not exists engineer text,
  add column if not exists permit_number text,
  add column if not exists drawing_set_title text,
  add column if not exists issue_date date,
  add column if not exists revision_date date,
  add column if not exists occupancy_type text,
  add column if not exists construction_type text,
  add column if not exists building_count integer,
  add column if not exists story_count integer,
  add column if not exists unit_count integer,
  add column if not exists phase_count integer,
  add column if not exists wind_speed text,
  add column if not exists exposure_category text,
  add column if not exists risk_category text,
  add column if not exists flood_zone text,
  add column if not exists design_pressure_notes text,
  add column if not exists code_edition text;

create table if not exists public.project_extraction_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  status text not null default 'queued',
  stage_message text,
  pages_scanned integer not null default 0,
  pages_total integer not null default 0,
  fields_found integer not null default 0,
  used_vision boolean not null default false,
  error_message text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_field_extractions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  run_id uuid references public.project_extraction_runs(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  page_id uuid references public.pages(id) on delete set null,
  field_key text not null,
  value text not null,
  confidence numeric not null default 0,
  source_sheet text,
  source_page_number integer,
  snippet text,
  bbox jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  applied boolean not null default false,
  conflict_value text,
  decided_by uuid,
  decided_at timestamptz,
  extracted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_field_extractions_project_idx
  on public.project_field_extractions (project_id, field_key);

create table if not exists public.project_address_candidates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  run_id uuid references public.project_extraction_runs(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  page_id uuid references public.pages(id) on delete set null,
  raw_address text not null,
  role text not null default 'unknown',
  score numeric not null default 0,
  label text,
  source_sheet text,
  selected boolean not null default false,
  latitude numeric,
  longitude numeric,
  city text,
  county text,
  state text,
  postal_code text,
  country text,
  geocode_status text not null default 'pending',
  geocode_provider text,
  geocode_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_address_candidates_project_idx
  on public.project_address_candidates (project_id);

grant select, insert, update, delete on public.project_extraction_runs to authenticated;
grant all on public.project_extraction_runs to service_role;
grant select, insert, update, delete on public.project_field_extractions to authenticated;
grant all on public.project_field_extractions to service_role;
grant select, insert, update, delete on public.project_address_candidates to authenticated;
grant all on public.project_address_candidates to service_role;

alter table public.project_extraction_runs enable row level security;
alter table public.project_field_extractions enable row level security;
alter table public.project_address_candidates enable row level security;

create policy "View extraction runs in visible projects"
  on public.project_extraction_runs for select to authenticated
  using (public.can_view_project(project_id, auth.uid()));
create policy "Edit extraction runs in editable projects"
  on public.project_extraction_runs for all to authenticated
  using (public.can_edit_project(project_id, auth.uid()))
  with check (public.can_edit_project(project_id, auth.uid()));

create policy "View extracted fields in visible projects"
  on public.project_field_extractions for select to authenticated
  using (public.can_view_project(project_id, auth.uid()));
create policy "Edit extracted fields in editable projects"
  on public.project_field_extractions for all to authenticated
  using (public.can_edit_project(project_id, auth.uid()))
  with check (public.can_edit_project(project_id, auth.uid()));

create policy "View address candidates in visible projects"
  on public.project_address_candidates for select to authenticated
  using (public.can_view_project(project_id, auth.uid()));
create policy "Edit address candidates in editable projects"
  on public.project_address_candidates for all to authenticated
  using (public.can_edit_project(project_id, auth.uid()))
  with check (public.can_edit_project(project_id, auth.uid()));

create trigger update_project_extraction_runs_updated_at
  before update on public.project_extraction_runs
  for each row execute function public.update_updated_at_column();
create trigger update_project_field_extractions_updated_at
  before update on public.project_field_extractions
  for each row execute function public.update_updated_at_column();
create trigger update_project_address_candidates_updated_at
  before update on public.project_address_candidates
  for each row execute function public.update_updated_at_column();
