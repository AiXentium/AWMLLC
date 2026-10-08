
-- ============ enums ============
create type public.app_role as enum ('owner_admin','estimator','reviewer','viewer');
create type public.project_status as enum ('active','review','approved','ready_for_quote','completed','on_hold','archived');
create type public.file_scan_status as enum ('scanning','clean','quarantined','rejected','manual_review');
create type public.review_status as enum ('pending','review','approved','rejected');

-- ============ shared helpers ============
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- ============ profiles ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- ============ roles ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = 'owner_admin');
$$;

create or replace function public.can_edit(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('owner_admin','estimator','reviewer'));
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role)
  values (new.id, 'viewer') on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "profiles self update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles self insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create trigger t_profiles_updated before update on public.profiles for each row execute function public.update_updated_at_column();

create policy "roles readable by authenticated" on public.user_roles for select to authenticated using (true);

-- ============ customers ============
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  email text,
  phone text,
  address text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;
create policy "customers read" on public.customers for select to authenticated using (true);
create policy "customers write" on public.customers for insert to authenticated with check (public.can_edit(auth.uid()));
create policy "customers update" on public.customers for update to authenticated using (public.can_edit(auth.uid()));
create policy "customers delete" on public.customers for delete to authenticated using (public.is_admin(auth.uid()));
create trigger t_customers_updated before update on public.customers for each row execute function public.update_updated_at_column();

-- ============ projects ============
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  customer_id uuid references public.customers(id) on delete set null,
  status project_status not null default 'active',
  project_type text,
  address text,
  city text,
  state text default 'FL',
  postal_code text,
  latitude numeric,
  longitude numeric,
  description text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);
grant select, insert, update, delete on public.project_members to authenticated;
grant all on public.project_members to service_role;
alter table public.project_members enable row level security;

create or replace function public.can_view_project(_project_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin(_user_id)
    or exists (select 1 from public.projects p where p.id = _project_id and p.owner_id = _user_id)
    or exists (select 1 from public.project_members m where m.project_id = _project_id and m.user_id = _user_id);
$$;

create or replace function public.can_edit_project(_project_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_view_project(_project_id, _user_id) and public.can_edit(_user_id);
$$;

create policy "projects read" on public.projects for select to authenticated using (public.can_view_project(id, auth.uid()));
create policy "projects insert" on public.projects for insert to authenticated with check (owner_id = auth.uid() and public.can_edit(auth.uid()));
create policy "projects update" on public.projects for update to authenticated using (public.can_edit_project(id, auth.uid()));
create policy "projects delete" on public.projects for delete to authenticated using (owner_id = auth.uid() or public.is_admin(auth.uid()));
create trigger t_projects_updated before update on public.projects for each row execute function public.update_updated_at_column();

create policy "members read" on public.project_members for select to authenticated using (public.can_view_project(project_id, auth.uid()));
create policy "members insert" on public.project_members for insert to authenticated with check (public.can_edit_project(project_id, auth.uid()));
create policy "members update" on public.project_members for update to authenticated using (public.can_edit_project(project_id, auth.uid()));
create policy "members delete" on public.project_members for delete to authenticated using (public.can_edit_project(project_id, auth.uid()));

-- ============ documents / versions / pages ============
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  kind text not null default 'plan_set',
  status text not null default 'processing',
  storage_path text,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  page_count integer default 0,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version_number integer not null default 1,
  label text,
  storage_path text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  page_number integer not null,
  sheet_number text,
  title text,
  discipline text,
  building text,
  floor text,
  revision text,
  classification text default 'unclassified',
  state text not null default 'all',
  tags text[] default '{}',
  thumbnail_path text,
  width numeric,
  height numeric,
  rotation integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, page_number)
);
grant select, insert, update, delete on public.documents, public.document_versions, public.pages to authenticated;
grant all on public.documents, public.document_versions, public.pages to service_role;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.pages enable row level security;

create policy "documents read" on public.documents for select to authenticated using (public.can_view_project(project_id, auth.uid()));
create policy "documents insert" on public.documents for insert to authenticated with check (public.can_edit_project(project_id, auth.uid()));
create policy "documents update" on public.documents for update to authenticated using (public.can_edit_project(project_id, auth.uid()));
create policy "documents delete" on public.documents for delete to authenticated using (public.can_edit_project(project_id, auth.uid()));
create trigger t_documents_updated before update on public.documents for each row execute function public.update_updated_at_column();

create policy "doc versions read" on public.document_versions for select to authenticated
  using (exists (select 1 from public.documents d where d.id = document_id and public.can_view_project(d.project_id, auth.uid())));
create policy "doc versions write" on public.document_versions for all to authenticated
  using (exists (select 1 from public.documents d where d.id = document_id and public.can_edit_project(d.project_id, auth.uid())))
  with check (exists (select 1 from public.documents d where d.id = document_id and public.can_edit_project(d.project_id, auth.uid())));

create policy "pages read" on public.pages for select to authenticated using (public.can_view_project(project_id, auth.uid()));
create policy "pages write" on public.pages for all to authenticated
  using (public.can_edit_project(project_id, auth.uid())) with check (public.can_edit_project(project_id, auth.uid()));
create trigger t_pages_updated before update on public.pages for each row execute function public.update_updated_at_column();

-- ============ working sets ============
create table public.working_sets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  category text not null default 'custom',
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.working_set_pages (
  id uuid primary key default gen_random_uuid(),
  working_set_id uuid not null references public.working_sets(id) on delete cascade,
  page_id uuid not null references public.pages(id) on delete cascade,
  sort_order integer default 0,
  unique (working_set_id, page_id)
);
grant select, insert, update, delete on public.working_sets, public.working_set_pages to authenticated;
grant all on public.working_sets, public.working_set_pages to service_role;
alter table public.working_sets enable row level security;
alter table public.working_set_pages enable row level security;
create policy "ws read" on public.working_sets for select to authenticated using (public.can_view_project(project_id, auth.uid()));
create policy "ws write" on public.working_sets for all to authenticated
  using (public.can_edit_project(project_id, auth.uid())) with check (public.can_edit_project(project_id, auth.uid()));
create trigger t_ws_updated before update on public.working_sets for each row execute function public.update_updated_at_column();
create policy "wsp read" on public.working_set_pages for select to authenticated
  using (exists (select 1 from public.working_sets w where w.id = working_set_id and public.can_view_project(w.project_id, auth.uid())));
create policy "wsp write" on public.working_set_pages for all to authenticated
  using (exists (select 1 from public.working_sets w where w.id = working_set_id and public.can_edit_project(w.project_id, auth.uid())))
  with check (exists (select 1 from public.working_sets w where w.id = working_set_id and public.can_edit_project(w.project_id, auth.uid())));

-- ============ scales + annotations ============
create table public.page_scales (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  scale_label text,
  units text not null default 'ft',
  pixels_per_unit numeric,
  calibrated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_id)
);
create table public.annotations (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  tool text not null,
  geometry jsonb not null default '{}'::jsonb,
  style jsonb not null default '{}'::jsonb,
  label text,
  takeoff_item_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.page_scales, public.annotations to authenticated;
grant all on public.page_scales, public.annotations to service_role;
alter table public.page_scales enable row level security;
alter table public.annotations enable row level security;
create policy "scales read" on public.page_scales for select to authenticated using (public.can_view_project(project_id, auth.uid()));
create policy "scales write" on public.page_scales for all to authenticated
  using (public.can_edit_project(project_id, auth.uid())) with check (public.can_edit_project(project_id, auth.uid()));
create trigger t_scales_updated before update on public.page_scales for each row execute function public.update_updated_at_column();
create policy "annotations read" on public.annotations for select to authenticated using (public.can_view_project(project_id, auth.uid()));
create policy "annotations write" on public.annotations for all to authenticated
  using (public.can_edit_project(project_id, auth.uid())) with check (public.can_edit_project(project_id, auth.uid()));
create trigger t_annotations_updated before update on public.annotations for each row execute function public.update_updated_at_column();

-- ============ takeoff ============
create table public.takeoff_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  page_id uuid references public.pages(id) on delete set null,
  mark text,
  category text not null default 'window',
  type_name text,
  quantity integer not null default 1,
  width_in numeric,
  height_in numeric,
  building text,
  floor text,
  room text,
  operation text,
  glass text,
  color text,
  frame_type text,
  notes text,
  status review_status not null default 'pending',
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.takeoff_item_images (
  id uuid primary key default gen_random_uuid(),
  takeoff_item_id uuid not null references public.takeoff_items(id) on delete cascade,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.takeoff_items, public.takeoff_item_images to authenticated;
grant all on public.takeoff_items, public.takeoff_item_images to service_role;
alter table public.takeoff_items enable row level security;
alter table public.takeoff_item_images enable row level security;
create policy "takeoff read" on public.takeoff_items for select to authenticated using (public.can_view_project(project_id, auth.uid()));
create policy "takeoff write" on public.takeoff_items for all to authenticated
  using (public.can_edit_project(project_id, auth.uid())) with check (public.can_edit_project(project_id, auth.uid()));
create trigger t_takeoff_updated before update on public.takeoff_items for each row execute function public.update_updated_at_column();
create policy "takeoff img read" on public.takeoff_item_images for select to authenticated
  using (exists (select 1 from public.takeoff_items t where t.id = takeoff_item_id and public.can_view_project(t.project_id, auth.uid())));
create policy "takeoff img write" on public.takeoff_item_images for all to authenticated
  using (exists (select 1 from public.takeoff_items t where t.id = takeoff_item_id and public.can_edit_project(t.project_id, auth.uid())))
  with check (exists (select 1 from public.takeoff_items t where t.id = takeoff_item_id and public.can_edit_project(t.project_id, auth.uid())));

-- ============ combinations ============
create table public.combinations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  mark text,
  layout text not null default 'twin',
  mull_type text,
  reinforcement text,
  status review_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.combination_members (
  id uuid primary key default gen_random_uuid(),
  combination_id uuid not null references public.combinations(id) on delete cascade,
  takeoff_item_id uuid references public.takeoff_items(id) on delete set null,
  position integer not null default 0,
  quantity integer not null default 1
);
grant select, insert, update, delete on public.combinations, public.combination_members to authenticated;
grant all on public.combinations, public.combination_members to service_role;
alter table public.combinations enable row level security;
alter table public.combination_members enable row level security;
create policy "comb read" on public.combinations for select to authenticated using (public.can_view_project(project_id, auth.uid()));
create policy "comb write" on public.combinations for all to authenticated
  using (public.can_edit_project(project_id, auth.uid())) with check (public.can_edit_project(project_id, auth.uid()));
create trigger t_comb_updated before update on public.combinations for each row execute function public.update_updated_at_column();
create policy "comb mem read" on public.combination_members for select to authenticated
  using (exists (select 1 from public.combinations c where c.id = combination_id and public.can_view_project(c.project_id, auth.uid())));
create policy "comb mem write" on public.combination_members for all to authenticated
  using (exists (select 1 from public.combinations c where c.id = combination_id and public.can_edit_project(c.project_id, auth.uid())))
  with check (exists (select 1 from public.combinations c where c.id = combination_id and public.can_edit_project(c.project_id, auth.uid())));

-- ============ schedules ============
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  schedule_type text not null default 'window',
  source text not null default 'manual',
  column_mapping jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.schedule_rows (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  mark text,
  quantity integer,
  width_in numeric,
  height_in numeric,
  material text,
  glass text,
  operation text,
  remarks text,
  raw jsonb not null default '{}'::jsonb
);
create table public.schedule_conflicts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  schedule_id uuid references public.schedules(id) on delete cascade,
  mark text,
  conflict_type text not null,
  severity text not null default 'warning',
  detail text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.schedules, public.schedule_rows, public.schedule_conflicts to authenticated;
grant all on public.schedules, public.schedule_rows, public.schedule_conflicts to service_role;
alter table public.schedules enable row level security;
alter table public.schedule_rows enable row level security;
alter table public.schedule_conflicts enable row level security;
create policy "sched read" on public.schedules for select to authenticated using (public.can_view_project(project_id, auth.uid()));
create policy "sched write" on public.schedules for all to authenticated
  using (public.can_edit_project(project_id, auth.uid())) with check (public.can_edit_project(project_id, auth.uid()));
create trigger t_sched_updated before update on public.schedules for each row execute function public.update_updated_at_column();
create policy "sched rows read" on public.schedule_rows for select to authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_view_project(s.project_id, auth.uid())));
create policy "sched rows write" on public.schedule_rows for all to authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_edit_project(s.project_id, auth.uid())))
  with check (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_edit_project(s.project_id, auth.uid())));
create policy "sched conflicts read" on public.schedule_conflicts for select to authenticated using (public.can_view_project(project_id, auth.uid()));
create policy "sched conflicts write" on public.schedule_conflicts for all to authenticated
  using (public.can_edit_project(project_id, auth.uid())) with check (public.can_edit_project(project_id, auth.uid()));

-- ============ jurisdiction + safety + quality ============
create table public.jurisdiction_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  ahj_name text,
  adopted_code text,
  amendments text,
  design_wind_speed text,
  debris_region text,
  impact_required boolean,
  energy_requirements text,
  egress_requirements text,
  safety_glazing_notes text,
  upper_floor_restrictions text,
  permit_notes text,
  source_url text,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.safety_checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  takeoff_item_id uuid references public.takeoff_items(id) on delete cascade,
  check_type text not null,
  sill_height_in numeric,
  exterior_drop_in numeric,
  requires_wocd boolean,
  requires_guard boolean,
  requires_safety_glazing boolean,
  meets_egress boolean,
  status review_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.quality_issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  area text not null,
  severity text not null default 'warning',
  message text not null,
  entity_type text,
  entity_id uuid,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.jurisdiction_records, public.safety_checks, public.quality_issues to authenticated;
grant all on public.jurisdiction_records, public.safety_checks, public.quality_issues to service_role;
alter table public.jurisdiction_records enable row level security;
alter table public.safety_checks enable row level security;
alter table public.quality_issues enable row level security;
create policy "juris read" on public.jurisdiction_records for select to authenticated using (public.can_view_project(project_id, auth.uid()));
create policy "juris write" on public.jurisdiction_records for all to authenticated
  using (public.can_edit_project(project_id, auth.uid())) with check (public.can_edit_project(project_id, auth.uid()));
create trigger t_juris_updated before update on public.jurisdiction_records for each row execute function public.update_updated_at_column();
create policy "safety read" on public.safety_checks for select to authenticated using (public.can_view_project(project_id, auth.uid()));
create policy "safety write" on public.safety_checks for all to authenticated
  using (public.can_edit_project(project_id, auth.uid())) with check (public.can_edit_project(project_id, auth.uid()));
create trigger t_safety_updated before update on public.safety_checks for each row execute function public.update_updated_at_column();
create policy "quality read" on public.quality_issues for select to authenticated using (public.can_view_project(project_id, auth.uid()));
create policy "quality write" on public.quality_issues for all to authenticated
  using (public.can_edit_project(project_id, auth.uid())) with check (public.can_edit_project(project_id, auth.uid()));

-- ============ YKK catalog + mapping ============
create table public.ykk_products (
  id uuid primary key default gen_random_uuid(),
  family text not null,
  series text,
  model text not null,
  product_type text not null,
  description text,
  application text,
  frame_options text[] default '{}',
  glass_options text[] default '{}',
  color_options text[] default '{}',
  hardware_options text[] default '{}',
  florida_approval text,
  miami_dade_noa text,
  documents jsonb not null default '[]'::jsonb,
  verified boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.ykk_products to authenticated;
grant select on public.ykk_products to anon;
grant all on public.ykk_products to service_role;
alter table public.ykk_products enable row level security;
create policy "ykk public read" on public.ykk_products for select to anon using (active and verified);
create policy "ykk auth read" on public.ykk_products for select to authenticated using (true);
create policy "ykk admin write" on public.ykk_products for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create trigger t_ykk_updated before update on public.ykk_products for each row execute function public.update_updated_at_column();

create table public.ykk_mappings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  takeoff_item_id uuid references public.takeoff_items(id) on delete cascade,
  combination_id uuid references public.combinations(id) on delete cascade,
  ykk_product_id uuid references public.ykk_products(id) on delete set null,
  status text not null default 'unmapped',
  confidence numeric,
  configuration jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.ykk_mappings to authenticated;
grant all on public.ykk_mappings to service_role;
alter table public.ykk_mappings enable row level security;
create policy "mapping read" on public.ykk_mappings for select to authenticated using (public.can_view_project(project_id, auth.uid()));
create policy "mapping write" on public.ykk_mappings for all to authenticated
  using (public.can_edit_project(project_id, auth.uid())) with check (public.can_edit_project(project_id, auth.uid()));
create trigger t_mapping_updated before update on public.ykk_mappings for each row execute function public.update_updated_at_column();

-- ============ quotes + exports + audit ============
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft',
  snapshot jsonb not null default '{}'::jsonb,
  total_amount numeric,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  mark text,
  description text,
  quantity integer not null default 1,
  unit_price numeric,
  line_total numeric,
  metadata jsonb not null default '{}'::jsonb
);
create table public.exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  export_type text not null,
  status text not null default 'pending',
  storage_path text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.quotes, public.quote_items, public.exports to authenticated;
grant select, insert on public.audit_log to authenticated;
grant all on public.quotes, public.quote_items, public.exports, public.audit_log to service_role;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.exports enable row level security;
alter table public.audit_log enable row level security;
create policy "quotes read" on public.quotes for select to authenticated using (public.can_view_project(project_id, auth.uid()));
create policy "quotes write" on public.quotes for all to authenticated
  using (public.can_edit_project(project_id, auth.uid())) with check (public.can_edit_project(project_id, auth.uid()));
create trigger t_quotes_updated before update on public.quotes for each row execute function public.update_updated_at_column();
create policy "quote items read" on public.quote_items for select to authenticated
  using (exists (select 1 from public.quotes q where q.id = quote_id and public.can_view_project(q.project_id, auth.uid())));
create policy "quote items write" on public.quote_items for all to authenticated
  using (exists (select 1 from public.quotes q where q.id = quote_id and public.can_edit_project(q.project_id, auth.uid())))
  with check (exists (select 1 from public.quotes q where q.id = quote_id and public.can_edit_project(q.project_id, auth.uid())));
create policy "exports read" on public.exports for select to authenticated using (public.can_view_project(project_id, auth.uid()));
create policy "exports write" on public.exports for all to authenticated
  using (public.can_edit_project(project_id, auth.uid())) with check (public.can_edit_project(project_id, auth.uid()));
create policy "audit read" on public.audit_log for select to authenticated
  using (project_id is null and public.is_admin(auth.uid()) or public.can_view_project(project_id, auth.uid()));
create policy "audit insert" on public.audit_log for insert to authenticated with check (user_id = auth.uid());

-- ============ incoming files + connectors + contact ============
create table public.file_connectors (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  display_name text not null,
  status text not null default 'setup_required',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider)
);
grant select on public.file_connectors to authenticated;
grant all on public.file_connectors to service_role;
alter table public.file_connectors enable row level security;
create policy "connectors read" on public.file_connectors for select to authenticated using (true);
create policy "connectors admin write" on public.file_connectors for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create trigger t_conn_updated before update on public.file_connectors for each row execute function public.update_updated_at_column();

create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  email text not null,
  phone text,
  project_type text,
  project_address text,
  product_interest text,
  quantities text,
  deadline text,
  message text,
  consent boolean not null default false,
  plan_link text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);
grant insert on public.contact_submissions to anon, authenticated;
grant select, update on public.contact_submissions to authenticated;
grant all on public.contact_submissions to service_role;
alter table public.contact_submissions enable row level security;
create policy "contact anyone insert" on public.contact_submissions for insert to anon, authenticated with check (true);
create policy "contact admin read" on public.contact_submissions for select to authenticated using (public.is_admin(auth.uid()));
create policy "contact admin update" on public.contact_submissions for update to authenticated using (public.is_admin(auth.uid()));

create table public.incoming_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  submission_id uuid references public.contact_submissions(id) on delete set null,
  source text not null default 'public_upload',
  original_filename text,
  stored_filename text,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  checksum text,
  scan_status file_scan_status not null default 'scanning',
  scan_detail text,
  is_duplicate boolean not null default false,
  assigned_to uuid references auth.users(id) on delete set null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.incoming_files to authenticated;
grant all on public.incoming_files to service_role;
alter table public.incoming_files enable row level security;
create policy "incoming read" on public.incoming_files for select to authenticated using (public.can_edit(auth.uid()));
create policy "incoming update" on public.incoming_files for update to authenticated using (public.can_edit(auth.uid()));
create trigger t_incoming_updated before update on public.incoming_files for each row execute function public.update_updated_at_column();

-- ============ AI agent ============
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  scope text not null default 'conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null,
  content text not null,
  sources jsonb not null default '[]'::jsonb,
  confidence numeric,
  tool_activity jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create table public.ai_memory (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'project',
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  content text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.ai_conversations, public.ai_messages, public.ai_memory to authenticated;
grant all on public.ai_conversations, public.ai_messages, public.ai_memory to service_role;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_memory enable row level security;
create policy "ai conv own" on public.ai_conversations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger t_aiconv_updated before update on public.ai_conversations for each row execute function public.update_updated_at_column();
create policy "ai msg own" on public.ai_messages for all to authenticated
  using (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy "ai memory read" on public.ai_memory for select to authenticated
  using (user_id = auth.uid() or (project_id is not null and public.can_view_project(project_id, auth.uid())) or public.is_admin(auth.uid()));
create policy "ai memory write" on public.ai_memory for all to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()))
  with check (user_id = auth.uid() or public.is_admin(auth.uid()));

-- ============ indexes ============
create index idx_projects_owner on public.projects(owner_id);
create index idx_members_user on public.project_members(user_id);
create index idx_pages_project on public.pages(project_id);
create index idx_pages_document on public.pages(document_id);
create index idx_takeoff_project on public.takeoff_items(project_id);
create index idx_annotations_page on public.annotations(page_id);
create index idx_mappings_project on public.ykk_mappings(project_id);
