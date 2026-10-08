
revoke all on function public.update_updated_at_column() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.is_admin(uuid) from public, anon;
revoke all on function public.can_edit(uuid) from public, anon;
revoke all on function public.can_view_project(uuid, uuid) from public, anon;
revoke all on function public.can_edit_project(uuid, uuid) from public, anon;
