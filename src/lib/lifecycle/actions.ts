import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { LIFECYCLE, type LifecycleEntity } from "./registry";

/* eslint-disable @typescript-eslint/no-explicit-any */
const table = (name: string) => (supabase as any).from(name);

export type DeletedRecord = {
  entity: LifecycleEntity;
  id: string;
  title: string;
  subtitle: string | null;
  projectId: string | null;
  deletedAt: string;
  deletedBy: string | null;
  deletionReason: string | null;
  originalParentId: string | null;
  restoreStatus: string;
};

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Soft-delete: the record leaves every normal view but keeps all of its data,
 * its parent link and the reason it was removed, so it can be restored intact.
 */
export async function softDelete(input: {
  entity: LifecycleEntity;
  ids: string[];
  reason: string;
  projectId?: string | null;
  sourceScreen?: string;
}) {
  const def = LIFECYCLE[input.entity];
  if (!input.ids.length) return 0;
  const userId = await currentUserId();

  // Capture the original parent so a restore can prove where it belongs.
  let parents = new Map<string, string | null>();
  if (def.parentColumn) {
    const { data } = await table(def.table).select(`id,${def.parentColumn}`).in("id", input.ids);
    parents = new Map(
      ((data ?? []) as Record<string, string>[]).map((r) => [
        r.id,
        r[def.parentColumn as string] ?? null,
      ]),
    );
  }

  const now = new Date().toISOString();
  for (const id of input.ids) {
    const patch: Record<string, unknown> = {
      deleted_at: now,
      deleted_by: userId,
      deletion_reason: input.reason || null,
      restore_status: "deleted",
    };
    if (def.parentColumn) patch.original_parent_id = parents.get(id) ?? null;
    const { error } = await table(def.table).update(patch).eq("id", id);
    if (error) throw error;
  }

  // A deleted sheet must also leave every active working set.
  if (input.entity === "page") {
    await (supabase as any).from("working_set_pages").delete().in("page_id", input.ids);
  }

  await logAudit({
    projectId: input.projectId ?? null,
    action: "lifecycle.deleted",
    entityType: input.entity,
    entityId: input.ids[0],
    detail: {
      count: input.ids.length,
      record: def.label,
      reason: input.reason,
      source_screen: input.sourceScreen ?? "unknown",
      result: "soft_deleted",
    },
  });
  return input.ids.length;
}

/** Restores soft-deleted records back into the normal views. */
export async function restoreRecords(input: {
  entity: LifecycleEntity;
  ids: string[];
  projectId?: string | null;
  sourceScreen?: string;
}) {
  const def = LIFECYCLE[input.entity];
  if (!input.ids.length) return 0;
  const { error } = await table(def.table)
    .update({
      deleted_at: null,
      deleted_by: null,
      deletion_reason: null,
      restore_status: "restored",
    })
    .in("id", input.ids);
  if (error) throw error;

  await logAudit({
    projectId: input.projectId ?? null,
    action: "lifecycle.restored",
    entityType: input.entity,
    entityId: input.ids[0],
    detail: {
      count: input.ids.length,
      record: def.label,
      source_screen: input.sourceScreen ?? "recycle_bin",
      result: "restored",
    },
  });
  return input.ids.length;
}

/** Irreversible removal. Callers must confirm twice and hold the right role. */
export async function purgeRecords(input: {
  entity: LifecycleEntity;
  ids: string[];
  reason: string;
  projectId?: string | null;
}) {
  const def = LIFECYCLE[input.entity];
  if (!input.ids.length) return 0;
  const { error } = await table(def.table).delete().in("id", input.ids);
  if (error) throw error;

  await logAudit({
    projectId: input.projectId ?? null,
    action: "lifecycle.purged",
    entityType: input.entity,
    entityId: input.ids[0],
    detail: {
      count: input.ids.length,
      record: def.label,
      reason: input.reason,
      dependents: def.dependents?.join(", ") ?? null,
      result: "purged",
    },
  });
  return input.ids.length;
}

/** Every soft-deleted record of one type, newest first. */
export async function listDeleted(
  entity: LifecycleEntity,
  projectId?: string | null,
): Promise<DeletedRecord[]> {
  const def = LIFECYCLE[entity];
  const columns = [
    "id",
    "deleted_at",
    "deleted_by",
    "deletion_reason",
    "restore_status",
    def.titleColumn,
    def.subtitleColumn,
    def.projectColumn,
    "original_parent_id",
  ].filter((c, i, all): c is string => Boolean(c) && all.indexOf(c) === i);

  let query = table(def.table).select(columns.join(",")).not("deleted_at", "is", null);
  if (projectId && def.projectColumn) query = query.eq(def.projectColumn, projectId);
  const { data, error } = await query.order("deleted_at", { ascending: false }).limit(500);
  if (error) return [];

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    entity,
    id: String(row.id),
    title: def.titleColumn ? String(row[def.titleColumn] ?? "Untitled") : "Untitled",
    subtitle: def.subtitleColumn ? ((row[def.subtitleColumn] as string | null) ?? null) : null,
    projectId: def.projectColumn ? ((row[def.projectColumn] as string | null) ?? null) : null,
    deletedAt: String(row.deleted_at),
    deletedBy: (row.deleted_by as string | null) ?? null,
    deletionReason: (row.deletion_reason as string | null) ?? null,
    originalParentId: (row.original_parent_id as string | null) ?? null,
    restoreStatus: String(row.restore_status ?? "deleted"),
  }));
}

/**
 * Excludes a sheet from the project workflow without deleting it. The original
 * PDF is never modified; the sheet simply stops feeding working sets, AI
 * analysis and takeoff.
 */
export async function setPageExcluded(input: {
  projectId: string;
  pageIds: string[];
  excluded: boolean;
  reason?: string;
}) {
  const userId = await currentUserId();
  const patch = input.excluded
    ? {
        excluded_at: new Date().toISOString(),
        excluded_by: userId,
        exclusion_reason: input.reason || null,
      }
    : { excluded_at: null, excluded_by: null, exclusion_reason: null };
  const { error } = await table("pages").update(patch).in("id", input.pageIds);
  if (error) throw error;

  if (input.excluded) {
    await (supabase as any).from("working_set_pages").delete().in("page_id", input.pageIds);
  }

  await logAudit({
    projectId: input.projectId,
    action: input.excluded ? "lifecycle.page_excluded" : "lifecycle.page_included",
    entityType: "page",
    entityId: input.pageIds[0],
    detail: {
      count: input.pageIds.length,
      reason: input.reason ?? null,
      result: input.excluded ? "excluded" : "restored_to_workflow",
    },
  });
}
