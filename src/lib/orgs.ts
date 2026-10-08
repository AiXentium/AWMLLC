/**
 * Multi-tenancy foundation.
 *
 * Schema (migration 20261004200000_commercial_grade.sql): orgs, org_members,
 * projects.org_id, ykk_products.org_id.
 *
 * Transition rules:
 * - org_id is nullable during transition; NULL = AWM's own data (legacy).
 * - ykk_products with org_id NULL = global catalog (visible to everyone).
 * - New licensees get an org; their projects/products carry their org_id.
 * - RLS on orgs/org_members restricts membership management to
 *   owner/admin of that org.
 */
import { supabase } from "@/integrations/supabase/client";

export type Org = { id: string; name: string; slug: string | null; plan: string };
export type OrgMember = { org_id: string; role: string };

/** Orgs the current user belongs to. */
export async function myOrgs(): Promise<(Org & { role: string })[]> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return [];
  const { data, error } = await supabase
    .from("org_members")
    .select("role, orgs(id,name,slug,plan)")
    .eq("user_id", user.user.id);
  if (error) throw error;
  return (data ?? []).map((m) => ({
    ...(m.orgs as unknown as Org),
    role: m.role,
  }));
}

/** Creates an org and makes the caller its owner. */
export async function createOrg(name: string): Promise<Org> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Not signed in");
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const { data: org, error } = await supabase
    .from("orgs")
    .insert({ name, slug })
    .select("id,name,slug,plan")
    .single();
  if (error) throw error;
  const { error: mErr } = await supabase
    .from("org_members")
    .insert({ org_id: org.id, user_id: user.user.id, role: "owner" });
  if (mErr) throw mErr;
  return org;
}

/** Invites a user to an org (caller must be owner/admin). */
export async function inviteToOrg(orgId: string, userId: string, role = "estimator") {
  const { error } = await supabase
    .from("org_members")
    .insert({ org_id: orgId, user_id: userId, role });
  if (error) throw error;
}

/** Assigns a project to an org (tenant isolation). */
export async function assignProjectToOrg(projectId: string, orgId: string | null) {
  const { error } = await supabase.from("projects").update({ org_id: orgId }).eq("id", projectId);
  if (error) throw error;
}
