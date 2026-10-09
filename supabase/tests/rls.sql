-- Test-only identities; this transaction is rolled back after assertions.
begin;
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000001', 'alice@example.test', '{}'),
 ('00000000-0000-0000-0000-000000000002', 'bob@example.test', '{}'),
 ('00000000-0000-0000-0000-000000000003', 'stranger@example.test', '{"role":"owner_admin"}');
insert into public.user_roles (user_id, role) values
 ('00000000-0000-0000-0000-000000000001', 'estimator'),
 ('00000000-0000-0000-0000-000000000002', 'estimator');
insert into public.orgs (id, name) values
 ('10000000-0000-0000-0000-000000000001', 'Company A'),
 ('10000000-0000-0000-0000-000000000002', 'Company B');
insert into public.org_members (org_id, user_id, role) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','estimator'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','owner');
insert into public.customers (id, name, created_by) values
 ('20000000-0000-0000-0000-000000000001','Customer A','00000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002','Customer B','00000000-0000-0000-0000-000000000002');
insert into public.projects (id, name, org_id, owner_id, customer_id) values
 ('30000000-0000-0000-0000-000000000001','Project A','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000002','Project B','10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002');
-- A stale project grant alone must not cross company boundaries.
insert into public.project_members (project_id, user_id) values
 ('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001');
insert into public.documents (project_id, name) values
 ('30000000-0000-0000-0000-000000000001','A plans'),
 ('30000000-0000-0000-0000-000000000002','B plans');
insert into storage.objects (bucket_id, name) values
 ('plan-files','30000000-0000-0000-0000-000000000001/plan.pdf'),
 ('plan-files','30000000-0000-0000-0000-000000000002/plan.pdf'),
 ('project-exports','30000000-0000-0000-0000-000000000001/export.xlsx'),
 ('quote-uploads','submission/private.pdf');
insert into public.bids (gc_name, created_by) values
 ('B lead','00000000-0000-0000-0000-000000000002');
insert into public.ykk_products (id, family, series, model, product_type, org_id, active, verified) values
 ('40000000-0000-0000-0000-000000000001','test','test','Company A private','window','10000000-0000-0000-0000-000000000001',true,true),
 ('40000000-0000-0000-0000-000000000002','test','test','Company B private','window','10000000-0000-0000-0000-000000000002',true,true);

do $$ begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity) then
    raise exception 'Application table has RLS disabled';
  end if;
  if (select count(*) from public.profiles where id in (
    '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003')) <> 3 then
    raise exception 'Auth users did not receive profiles';
  end if;
  if exists (select 1 from public.user_roles where user_id='00000000-0000-0000-0000-000000000003' and role <> 'viewer') then
    raise exception 'User metadata elevated a role';
  end if;
  if (select count(*) from storage.buckets where id in ('plan-files','project-exports','quote-uploads') and not public) <> 3 then
    raise exception 'Required private storage buckets missing';
  end if;
end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.projects) <> 1 then raise exception 'Cross-company project visibility'; end if;
  if (select count(*) from public.documents) <> 1 then raise exception 'Cross-company document visibility'; end if;
  if (select count(*) from public.customers) <> 1 then raise exception 'Cross-company customer visibility'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'Unrelated profile visibility'; end if;
  if exists (select 1 from public.user_roles where user_id <> auth.uid()) then raise exception 'Unrelated role visibility'; end if;
  if (select count(*) from storage.objects) <> 2 then raise exception 'Private files exposed or own files unavailable'; end if;
  if exists (select 1 from public.bids) then raise exception 'Other user unassigned bid visible'; end if;
  if (select count(*) from public.ykk_products where org_id is not null) <> 1 then
    raise exception 'Cross-company catalog visibility';
  end if;
  if not public.can_edit(auth.uid()) or public.has_role('00000000-0000-0000-0000-000000000002','estimator') then
    raise exception 'Role helper accepted another user identity or rejected its caller';
  end if;
  if public.can_view_project('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002') then
    raise exception 'Project helper accepted another user identity';
  end if;
  begin
    insert into public.org_members (org_id,user_id,role) values
      ('10000000-0000-0000-0000-000000000002',auth.uid(),'owner');
    raise exception 'Self-assigned company owner';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.user_roles (user_id,role) values (auth.uid(),'owner_admin');
    raise exception 'Self-assigned global admin';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.projects (name,org_id,owner_id) values
      ('Intrusion','10000000-0000-0000-0000-000000000002',auth.uid());
    raise exception 'Created a project in another company';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id,name) values ('quote-uploads','injected.pdf');
    raise exception 'Direct quote-upload write allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.projects set org_id='10000000-0000-0000-0000-000000000002'
      where id='30000000-0000-0000-0000-000000000001';
    raise exception 'Moved a project into another company';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.bids (gc_name) values ('A lead');
do $$ begin
  if (select count(*) from public.bids) <> 1 then raise exception 'Own unassigned bid unavailable'; end if;
end $$;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$ begin
  if (select count(*) from public.ykk_products) = 0 then raise exception 'Public product catalog unavailable'; end if;
  if exists (select 1 from public.ykk_products where org_id is not null) then
    raise exception 'Anonymous company catalog visibility';
  end if;
  if exists (select 1 from storage.objects) then raise exception 'Anonymous private-file access'; end if;
  begin
    perform 1 from public.projects;
    if found then raise exception 'Anonymous project access'; end if;
  exception when insufficient_privilege then null; end;
end $$;
rollback;
