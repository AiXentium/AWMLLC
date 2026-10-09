/**
 * Verification state machine — the trust layer.
 *
 * takeoff_items.status (review_status enum):
 *   pending  — extracted by the system, not yet touched
 *   review   — in estimator review (promoted schedules land here)
 *   approved — human-confirmed; ONLY these flow into quotes
 *   rejected — excluded from takeoff and quotes
 *
 * Every transition writes a verification_events row (append-only audit).
 * Human transitions (review/approved/rejected) require an explicit click —
 * viewing an item never counts as reviewing it.
 */
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { logAudit } from "@/lib/audit";

export type VerifyStatus = "pending" | "review" | "approved" | "rejected";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** verified_by is a uuid column — only store the actor when it's a real user id. */
function verifiedBy(actor?: string): string | null {
  return actor && UUID_RE.test(actor) ? actor : null;
}

export async function setItemStatus(
  projectId: string,
  itemId: string,
  status: VerifyStatus,
  opts: { actor?: string; note?: string; overrideReason?: string } = {},
): Promise<void> {
  const patch: TablesUpdate<"takeoff_items"> = { status };
  if (status === "approved") {
    patch.verified_by = verifiedBy(opts.actor);
    patch.verified_at = new Date().toISOString();
  }
  if (opts.overrideReason) patch.override_reason = opts.overrideReason;

  const { error } = await supabase.from("takeoff_items").update(patch).eq("id", itemId);
  if (error) throw error;

  await supabase.from("verification_events").insert({
    project_id: projectId,
    takeoff_item_id: itemId,
    event: status,
    actor: opts.actor ?? "estimator",
    note: opts.note ?? opts.overrideReason ?? null,
    evidence: {},
  });

  await logAudit({
    projectId,
    action: `takeoff.item_${status}`,
    entityType: "takeoff_item",
    entityId: itemId,
    detail: { status, overrideReason: opts.overrideReason ?? null },
  });
}

export async function bulkSetStatus(
  projectId: string,
  itemIds: string[],
  status: VerifyStatus,
  opts: { actor?: string; note?: string } = {},
): Promise<number> {
  if (!itemIds.length) return 0;
  const patch: TablesUpdate<"takeoff_items"> = { status };
  if (status === "approved") {
    patch.verified_by = verifiedBy(opts.actor);
    patch.verified_at = new Date().toISOString();
  }
  const { error } = await supabase.from("takeoff_items").update(patch).in("id", itemIds);
  if (error) throw error;

  await supabase.from("verification_events").insert(
    itemIds.map((id) => ({
      project_id: projectId,
      takeoff_item_id: id,
      event: `bulk_${status}`,
      actor: opts.actor ?? "estimator",
      note: opts.note ?? null,
      evidence: {},
    })),
  );
  return itemIds.length;
}

/** Quote gate: returns blockers; empty array = quotable. */
export function quoteGate(
  items: { id: string; status: string | null; override_reason?: string | null }[],
): string[] {
  const blockers: string[] = [];
  const unapproved = items.filter(
    (i) => i.status !== "approved" && !(i.status === "rejected" && i.override_reason),
  );
  const pending = unapproved.filter((i) => i.status !== "rejected");
  if (pending.length > 0) {
    blockers.push(
      `${pending.length} item(s) are not approved yet — review and approve them, or reject with an override reason.`,
    );
  }
  return blockers;
}

/** Items eligible for quoting: approved only. Rejected-with-override items are
 *  intentionally excluded (the estimator explicitly took them out of scope). */
export function quotableItems<T extends { status: string | null; override_reason?: string | null }>(
  items: T[],
): T[] {
  return items.filter((i) => i.status === "approved");
}
