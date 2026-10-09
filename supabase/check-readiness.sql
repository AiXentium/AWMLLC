-- Read-only verification for the hosted project after its migrations are applied.
select count(*) as application_tables,
       count(*) filter (where c.relrowsecurity) as tables_with_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p');
select c.relname as unprotected_table from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
select id, public, file_size_limit from storage.buckets
where id in ('plan-files', 'project-exports', 'quote-uploads');
select count(*) as auth_users_without_profiles from auth.users u
left join public.profiles p on p.id = u.id where p.id is null;
select count(*) as provisioned_admins from public.user_roles where role = 'owner_admin';
