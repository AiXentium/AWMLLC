-- Complete fresh-project permissions, missing private storage, and company isolation.
-- Do not trust user_metadata or an email domain when granting application roles.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- Membership lookups bypass recursive RLS but always bind to the caller's UUID.
create or replace function private.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.org_members m
    where m.org_id = org and m.user_id = (select auth.uid())
  );
$$;
create or replace function private.is_org_admin(org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.org_members m
    where m.org_id = org and m.user_id = (select auth.uid()) and m.role in ('owner', 'admin')
  );
$$;
revoke all on function private.is_org_member(uuid), private.is_org_admin(uuid) from public, anon;
grant execute on function private.is_org_member(uuid), private.is_org_admin(uuid) to authenticated, service_role;

create or replace function public.is_org_member(p_org_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select private.is_org_member(p_org_id);
$$;
create or replace function public.is_org_admin(p_org_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select private.is_org_admin(p_org_id);
$$;
revoke all on function public.is_org_member(uuid), public.is_org_admin(uuid) from public, anon;
grant execute on function public.is_org_member(uuid), public.is_org_admin(uuid) to authenticated, service_role;

-- The earlier security migration removed PUBLIC execute without granting users
-- the helpers required by their policies. Keep these inaccessible to anon.
-- RPC callers must not probe another user's roles through definer functions.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select _user_id = (select auth.uid()) and exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  );
$$;
create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role(_user_id, 'owner_admin'::public.app_role);
$$;
create or replace function public.can_edit(_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select _user_id = (select auth.uid()) and exists (
    select 1 from public.user_roles where user_id = _user_id
    and role in ('owner_admin', 'estimator', 'reviewer')
  );
$$;
grant execute on function public.has_role(uuid, public.app_role), public.is_admin(uuid),
  public.can_edit(uuid), public.can_view_project(uuid, uuid),
  public.can_edit_project(uuid, uuid) to authenticated, service_role;

-- Company membership is granted by trusted staff or an existing company admin.
-- The former self-join policy allowed choosing any company and the owner role.
drop policy if exists "org members self join" on public.org_members;
drop policy if exists "org members manage" on public.org_members;
create policy "org members manage" on public.org_members for all to authenticated
  using (public.is_admin((select auth.uid())) or public.is_org_admin(org_id))
  with check (public.is_admin((select auth.uid())) or public.is_org_admin(org_id));
drop policy if exists "orgs insert" on public.orgs;
create policy "orgs insert" on public.orgs for insert to authenticated
  with check (public.is_admin((select auth.uid())));
create policy "orgs staff read" on public.orgs for select to authenticated
  using (public.is_admin((select auth.uid())));
create policy "orgs admin update" on public.orgs for update to authenticated
  using (public.is_admin((select auth.uid())) or public.is_org_admin(id))
  with check (public.is_admin((select auth.uid())) or public.is_org_admin(id));
alter table public.org_members add constraint org_members_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.org_members add constraint org_members_role_check
  check (role in ('owner', 'admin', 'estimator', 'reviewer', 'viewer'));
create index org_members_user_org_idx on public.org_members (user_id, org_id);

-- A project grant does not cross the company boundary. Staff administrators
-- retain their explicit, server-provisioned application-wide access.
create or replace function public.can_view_project(_project_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select _user_id = (select auth.uid()) and (
    public.is_admin(_user_id) or exists (
      select 1 from public.projects p where p.id = _project_id
      and (p.org_id is null or private.is_org_member(p.org_id))
      and (p.owner_id = _user_id or private.is_org_admin(p.org_id) or exists (
        select 1 from public.project_members m where m.project_id = p.id and m.user_id = _user_id
      ))
    )
  );
$$;
drop policy if exists "projects insert" on public.projects;
create policy "projects insert" on public.projects for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.can_edit((select auth.uid()))
    and (org_id is null or public.is_org_member(org_id)));
drop policy if exists "projects update" on public.projects;
create policy "projects update" on public.projects for update to authenticated
  using (public.can_edit_project(id, (select auth.uid())))
  with check (public.is_admin((select auth.uid())) or (
    org_id is null or (public.is_org_member(org_id) and exists (
      select 1 from public.org_members m where m.org_id = projects.org_id and m.user_id = projects.owner_id
    ))
  ));

-- Restrict directory and customer records instead of exposing them to every login.
drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin((select auth.uid())) or exists (
    select 1 from public.project_members m
    where m.user_id = profiles.id and public.can_view_project(m.project_id, (select auth.uid()))
  ) or exists (
    select 1 from public.org_members m where m.user_id = profiles.id and public.is_org_member(m.org_id)
  ));
drop policy if exists "roles readable by authenticated" on public.user_roles;
create policy "roles readable by authenticated" on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin((select auth.uid())));
drop policy if exists "customers read" on public.customers;
create policy "customers read" on public.customers for select to authenticated
  using (created_by = (select auth.uid()) or public.is_admin((select auth.uid())) or exists (
    select 1 from public.projects p where p.customer_id = customers.id
    and public.can_view_project(p.id, (select auth.uid()))
  ));
drop policy if exists "customers write" on public.customers;
create policy "customers write" on public.customers for insert to authenticated
  with check (public.is_admin((select auth.uid())) or (
    created_by = (select auth.uid()) and public.can_edit((select auth.uid()))
  ));
drop policy if exists "customers update" on public.customers;
create policy "customers update" on public.customers for update to authenticated
  using (public.is_admin((select auth.uid())) or (created_by = (select auth.uid()) and public.can_edit((select auth.uid()))))
  with check (public.is_admin((select auth.uid())) or (created_by = (select auth.uid()) and public.can_edit((select auth.uid()))));

-- Public catalog entries remain public; company-specific entries stay scoped.
drop policy if exists "ykk public read" on public.ykk_products;
create policy "ykk public read" on public.ykk_products for select to anon
  using (org_id is null and active and verified);
drop policy if exists "ykk auth read" on public.ykk_products;
create policy "ykk auth read" on public.ykk_products for select to authenticated
  using (org_id is null or public.is_org_member(org_id) or public.is_admin((select auth.uid())));

-- Unassigned bids must belong to a user instead of being writable by all users.
alter table public.bids add column created_by uuid references auth.users(id) default auth.uid();
drop policy if exists "bids read" on public.bids;
create policy "bids read" on public.bids for select to authenticated using (
  public.is_admin((select auth.uid())) or
  (project_id is null and created_by = (select auth.uid())) or
  public.can_view_project(project_id, (select auth.uid()))
);
drop policy if exists "bids write" on public.bids;
create policy "bids write" on public.bids for all to authenticated
  using (public.is_admin((select auth.uid())) or
    (project_id is null and created_by = (select auth.uid()) and public.can_edit((select auth.uid()))) or
    public.can_edit_project(project_id, (select auth.uid())))
  with check (public.is_admin((select auth.uid())) or
    (project_id is null and created_by = (select auth.uid()) and public.can_edit((select auth.uid()))) or
    public.can_edit_project(project_id, (select auth.uid())));

-- Backfill accounts created before application migrations were installed.
insert into public.profiles (id, email, full_name)
select id, email, coalesce(raw_user_meta_data->>'full_name', email) from auth.users
on conflict (id) do nothing;
insert into public.user_roles (user_id, role)
select id, 'viewer'::public.app_role from auth.users
where not exists (select 1 from public.user_roles r where r.user_id = auth.users.id)
on conflict do nothing;

-- Every application table has RLS. Explicitly grant only operations for which
-- an applicable policy exists; fresh projects may not have legacy default grants.
do $$
declare t record; p record; role_name text; command text;
begin
  for t in select c.oid, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('alter table public.%I enable row level security', t.relname);
    execute format('grant all on public.%I to service_role', t.relname);
    for p in select polcmd, polroles from pg_policy where polrelid = t.oid loop
      foreach role_name in array array['anon', 'authenticated'] loop
        if 0::oid = any(p.polroles) or (role_name::regrole)::oid = any(p.polroles) then
          command := case p.polcmd when 'r' then 'select' when 'a' then 'insert'
            when 'w' then 'update' when 'd' then 'delete' else 'select, insert, update, delete' end;
          execute format('grant %s on public.%I to %I', command, t.relname, role_name);
        end if;
      end loop;
    end loop;
  end loop;
end;
$$;
grant usage on schema public to anon, authenticated, service_role;

-- These buckets are used by the app but were never created by its migrations.
insert into storage.buckets (id, name, public, file_size_limit) values
  ('project-exports', 'project-exports', false, 104857600),
  ('quote-uploads', 'quote-uploads', false, 524288000)
on conflict (id) do update set public = false;
create policy "project exports read" on storage.objects for select to authenticated
  using (bucket_id = 'project-exports' and public.can_view_project(((storage.foldername(name))[1])::uuid, (select auth.uid())));
create policy "project exports insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-exports' and public.can_edit_project(((storage.foldername(name))[1])::uuid, (select auth.uid())));
create policy "project exports update" on storage.objects for update to authenticated
  using (bucket_id = 'project-exports' and public.can_edit_project(((storage.foldername(name))[1])::uuid, (select auth.uid())))
  with check (bucket_id = 'project-exports' and public.can_edit_project(((storage.foldername(name))[1])::uuid, (select auth.uid())));
create policy "project exports delete" on storage.objects for delete to authenticated
  using (bucket_id = 'project-exports' and public.can_edit_project(((storage.foldername(name))[1])::uuid, (select auth.uid())));
-- quote-uploads is service-role/signed-URL only; grant no direct public policies.
notify pgrst, 'reload schema';
