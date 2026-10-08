alter table public.contact_submissions
  add column if not exists assigned_to uuid,
  add column if not exists priority text not null default 'normal',
  add column if not exists internal_notes text,
  add column if not exists source text not null default 'website_quote_form',
  add column if not exists last_activity_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists converted_project_id uuid references public.projects(id) on delete set null,
  add column if not exists public_token uuid not null default gen_random_uuid();

create unique index if not exists contact_submissions_public_token_key on public.contact_submissions(public_token);

drop trigger if exists contact_submissions_updated_at on public.contact_submissions;
create trigger contact_submissions_updated_at
  before update on public.contact_submissions
  for each row execute function public.update_updated_at_column();

create table if not exists public.quote_request_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.contact_submissions(id) on delete cascade,
  file_name text not null,
  original_filename text not null,
  size_bytes bigint not null default 0,
  mime_type text,
  kind text not null default 'other',
  checksum text,
  storage_path text not null,
  classification text,
  document_id uuid references public.documents(id) on delete set null,
  intake_file_id uuid references public.intake_files(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.quote_request_documents to authenticated;
grant all on public.quote_request_documents to service_role;
alter table public.quote_request_documents enable row level security;
create policy "Staff manage quote request documents"
  on public.quote_request_documents for all to authenticated
  using (public.can_edit(auth.uid()) or public.is_admin(auth.uid()))
  with check (public.can_edit(auth.uid()) or public.is_admin(auth.uid()));

drop trigger if exists quote_request_documents_updated_at on public.quote_request_documents;
create trigger quote_request_documents_updated_at
  before update on public.quote_request_documents
  for each row execute function public.update_updated_at_column();

create table if not exists public.quote_request_activity (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.contact_submissions(id) on delete cascade,
  actor_id uuid,
  kind text not null,
  detail text,
  created_at timestamptz not null default now()
);

grant select, insert on public.quote_request_activity to authenticated;
grant all on public.quote_request_activity to service_role;
alter table public.quote_request_activity enable row level security;
create policy "Staff read quote request activity"
  on public.quote_request_activity for select to authenticated
  using (public.can_edit(auth.uid()) or public.is_admin(auth.uid()));
create policy "Staff write quote request activity"
  on public.quote_request_activity for insert to authenticated
  with check (public.can_edit(auth.uid()) or public.is_admin(auth.uid()));

create index if not exists quote_request_documents_submission_idx on public.quote_request_documents(submission_id);
create index if not exists quote_request_activity_submission_idx on public.quote_request_activity(submission_id);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='contact_submissions' and policyname='Staff manage quote requests'
  ) then
    create policy "Staff manage quote requests"
      on public.contact_submissions for all to authenticated
      using (public.can_edit(auth.uid()) or public.is_admin(auth.uid()))
      with check (public.can_edit(auth.uid()) or public.is_admin(auth.uid()));
  end if;
end $$;