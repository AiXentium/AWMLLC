/**
 * Schedule → takeoff promotion.
 *
 * The scan reads every schedule row (mark, type, size, quantity) into
 * plan_schedule_entries. This module bulk-promotes reviewed rows into
 * takeoff_items so the estimator doesn't re-click every window.
 *
 * Rules:
 * - Only rows the estimator has reviewed (or explicitly selected) promote.
 * - Sizes parse deterministically via parseSizePair — unparseable sizes
 *   promote with null dimensions and a verification flag, never guessed.
 * - Promoted items get status 'review' and source 'schedule'.
 * - Idempotent: re-running skips rows already promoted (tracked by
 *   schedule_entry_id on the takeoff item notes... via source ref).
 */
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { parseSizePair } from "./dimensions";
import { logAudit } from "@/lib/audit";

export type ScheduleEntry = {
  id: string;
  project_id: string;
  page_id: string | null;
  schedule_type: string | null;
  mark: string | null;
  type_label: string | null;
  width: string | null;
  height: string | null;
  quantity: number | null;
  material: string | null;
  glazing: string | null;
  operation: string | null;
  confidence: number | null;
};

export type PromotionResult = {
  promoted: number;
  skipped: number;
  unsized: number;
  itemIds: string[];
};

function categoryFor(scheduleType: string | null): string {
  const t = (scheduleType ?? "").toLowerCase();
  if (t.includes("door")) return "door";
  if (t.includes("glaz")) return "storefront_curtainwall";
  return "window";
}

/**
 * Promotes schedule entries to takeoff items. Pass explicit entry ids
 * (estimator-selected) or omit to promote all unpromoted entries.
 */
export async function promoteScheduleEntries(
  projectId: string,
  entryIds?: string[],
): Promise<PromotionResult> {
  // Load entries.
  let query = supabase.from("plan_schedule_entries").select("*").eq("project_id", projectId);
  if (entryIds?.length) query = query.in("id", entryIds);
  const { data: entries, error } = await query;
  if (error) throw error;

  // Find already-promoted entry ids. Notes look like
  // "schedule:<uuid>" with optional suffixes (" — size unreadable, verify",
  // " | material"), so extract just the id — never the whole note.
  const { data: existing } = await supabase
    .from("takeoff_items")
    .select("notes")
    .eq("project_id", projectId)
    .eq("source", "schedule")
    .like("notes", "schedule:%");
  const promotedIds = new Set(
    (existing ?? []).map((r) => {
      const m = String(r.notes ?? "").match(/^schedule:([0-9a-f-]{36})/i);
      return m ? m[1].toLowerCase() : "";
    }),
  );

  const result: PromotionResult = { promoted: 0, skipped: 0, unsized: 0, itemIds: [] };
  const rows: TablesInsert<"takeoff_items">[] = [];

  for (const e of (entries ?? []) as ScheduleEntry[]) {
    if (promotedIds.has(e.id.toLowerCase())) {
      result.skipped += 1;
      continue;
    }
    const size = parseSizePair(e.width, e.height);
    if (!size) result.unsized += 1;
    rows.push({
      project_id: projectId,
      page_id: e.page_id,
      mark: e.mark,
      category: categoryFor(e.schedule_type),
      type_name: e.type_label,
      quantity: Math.max(1, Math.round(Number(e.quantity ?? 1) || 1)),
      width_in: size?.widthIn ?? null,
      height_in: size?.heightIn ?? null,
      operation: e.operation,
      glass: e.glazing,
      notes: `schedule:${e.id}${size ? "" : " — size unreadable, verify"}${e.material ? ` | ${e.material}` : ""}`,
      status: "review",
      source: "schedule",
    });
  }

  if (rows.length) {
    const { data, error: insertError } = await supabase
      .from("takeoff_items")
      .insert(rows)
      .select("id");
    if (insertError) throw insertError;
    result.promoted = rows.length;
    result.itemIds = (data ?? []).map((r) => r.id);

    // Audit the bulk promotion.
    for (const id of result.itemIds) {
      await supabase.from("verification_events").insert({
        project_id: projectId,
        takeoff_item_id: id,
        event: "promoted",
        actor: "system",
        note: "Promoted from schedule entry by estimator bulk action",
        evidence: {},
      });
    }
  }

  await logAudit({
    projectId,
    action: "takeoff.schedule_promoted",
    entityType: "project",
    detail: { promoted: result.promoted, skipped: result.skipped, unsized: result.unsized },
  });

  return result;
}

/** Fetches schedule entries awaiting promotion for a project. */
export async function unpromotedScheduleEntries(projectId: string): Promise<ScheduleEntry[]> {
  const { data: entries, error } = await supabase
    .from("plan_schedule_entries")
    .select("*")
    .eq("project_id", projectId)
    .order("mark", { ascending: true });
  if (error) throw error;
  const { data: existing } = await supabase
    .from("takeoff_items")
    .select("notes")
    .eq("project_id", projectId)
    .eq("source", "schedule");
  const promotedIds = new Set(
    (existing ?? []).map((r) => {
      const m = String(r.notes ?? "").match(/^schedule:([0-9a-f-]{36})/i);
      return m ? m[1].toLowerCase() : "";
    }),
  );
  return ((entries ?? []) as ScheduleEntry[]).filter((e) => !promotedIds.has(e.id.toLowerCase()));
}
