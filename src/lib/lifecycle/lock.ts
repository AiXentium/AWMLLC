import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ProjectLockState = {
  lockedAt: string | null;
  lockedBy: string | null;
  lockReason: string | null;
  archivedAt: string | null;
  archiveVersion: number;
};

export const EMPTY_LOCK: ProjectLockState = {
  lockedAt: null,
  lockedBy: null,
  lockReason: null,
  archivedAt: null,
  archiveVersion: 0,
};

export function readLockState(row: Record<string, unknown> | null | undefined): ProjectLockState {
  if (!row) return EMPTY_LOCK;
  return {
    lockedAt: (row.locked_at as string | null) ?? null,
    lockedBy: (row.locked_by as string | null) ?? null,
    lockReason: (row.lock_reason as string | null) ?? null,
    archivedAt: (row.archived_at as string | null) ?? null,
    archiveVersion: Number(row.archive_version ?? 0),
  };
}

/**
 * Locks a project. The database refuses every content change while locked, so
 * this is a hard read-only state rather than a UI convention. Viewing,
 * searching, downloading and exporting stay available.
 */
export async function lockProject(projectId: string, reason: string) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await (supabase as any)
    .from("projects")
    .update({
      locked_at: new Date().toISOString(),
      locked_by: userData.user?.id ?? null,
      lock_reason: reason,
    })
    .eq("id", projectId);
  if (error) throw error;
  await logAudit({
    projectId,
    action: "project.locked",
    entityType: "project",
    entityId: projectId,
    detail: { reason, result: "locked" },
  });
}

/** Unlocks a project. Restricted to owner/admin in the calling UI. */
export async function unlockProject(projectId: string, reason: string) {
  const { error } = await (supabase as any)
    .from("projects")
    .update({ locked_at: null, locked_by: null, lock_reason: reason })
    .eq("id", projectId);
  if (error) throw error;
  await logAudit({
    projectId,
    action: "project.unlocked",
    entityType: "project",
    entityId: projectId,
    detail: { reason, result: "unlocked" },
  });
}

export async function setDocumentLock(input: {
  projectId: string;
  documentId: string;
  locked: boolean;
  reason: string;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const patch = input.locked
    ? {
        locked_at: new Date().toISOString(),
        locked_by: userData.user?.id ?? null,
        lock_reason: input.reason,
      }
    : { locked_at: null, locked_by: null, lock_reason: input.reason };
  const { error } = await (supabase as any)
    .from("documents")
    .update(patch)
    .eq("id", input.documentId);
  if (error) throw error;
  await logAudit({
    projectId: input.projectId,
    action: input.locked ? "document.locked" : "document.unlocked",
    entityType: "document",
    entityId: input.documentId,
    detail: { reason: input.reason, result: input.locked ? "locked" : "unlocked" },
  });
}
