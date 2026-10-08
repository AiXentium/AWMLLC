create table public.project_intelligence_facts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  run_id uuid,
  document_id uuid,
  page_id uuid,
  fact_type text not null,
  fact_key text not null,
  label text,
  value jsonb not null default '{}'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  reasoning text,
  confidence numeric not null default 0,
  version integer not null default 1,
  status text not null default 'ai_suggested',
  superseded boolean not null default false,
  created_by uuid,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, fact_type, fact_key)
);

grant select, insert, update, delete on public.project_intelligence_facts to authenticated;
grant all on public.project_intelligence_facts to service_role;
alter table public.project_intelligence_facts enable row level security;

create policy "view project intelligence" on public.project_intelligence_facts
  for select to authenticated using (public.can_view_project(project_id, auth.uid()));
create policy "edit project intelligence" on public.project_intelligence_facts
  for all to authenticated using (public.can_edit_project(project_id, auth.uid()))
  with check (public.can_edit_project(project_id, auth.uid()));

create index project_intelligence_facts_project_type_idx
  on public.project_intelligence_facts (project_id, fact_type);

create trigger project_intelligence_facts_updated_at
  before update on public.project_intelligence_facts
  for each row execute function public.update_updated_at_column();

create table public.project_quantity_estimates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  run_id uuid,
  bucket text not null,
  label text not null,
  quantity integer not null default 0,
  user_quantity integer,
  confidence numeric not null default 0,
  coverage text,
  reasoning text,
  source_counts jsonb not null default '[]'::jsonb,
  marks jsonb not null default '[]'::jsonb,
  status text not null default 'ai_suggested',
  version integer not null default 1,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, bucket)
);

grant select, insert, update, delete on public.project_quantity_estimates to authenticated;
grant all on public.project_quantity_estimates to service_role;
alter table public.project_quantity_estimates enable row level security;

create policy "view project quantities" on public.project_quantity_estimates
  for select to authenticated using (public.can_view_project(project_id, auth.uid()));
create policy "edit project quantities" on public.project_quantity_estimates
  for all to authenticated using (public.can_edit_project(project_id, auth.uid()))
  with check (public.can_edit_project(project_id, auth.uid()));

create trigger project_quantity_estimates_updated_at
  before update on public.project_quantity_estimates
  for each row execute function public.update_updated_at_column();