/**
 * Schedule ↔ callout cross-validation + mark hyperlinking.
 *
 * Bid-defense rules:
 * - Every schedule mark should appear in the takeoff (else: unpromoted).
 * - Every takeoff mark should trace to a schedule row or a measured callout
 *   (else: orphan — nothing on the plans backs it).
 * - Schedule quantity × multiplier vs takeoff quantity for the same mark
 *   must agree (else: quantity mismatch).
 *
 * Unresolved mismatches block quoting (see verify.ts quoteGate).
 * Mark hyperlinking: markToPages() gives every sheet a mark appears on.
 */
import { supabase } from "@/integrations/supabase/client";

export type CrossIssue = {
  kind: "unpromoted" | "orphan" | "qty_mismatch";
  mark: string;
  detail: string;
  scheduleQty: number | null;
  takeoffQty: number | null;
};

export type CrossCheckResult = {
  issues: CrossIssue[];
  /** mark → pages (sheet numbers) where it appears, for hyperlinking */
  markToPages: Record<string, { pageId: string | null; sheet: string | null }[]>;
  scheduleMarks: Set<string>;
  takeoffMarks: Set<string>;
};

const norm = (s: string | null | undefined) => (s ?? "").trim().toUpperCase();

export async function crossCheck(projectId: string): Promise<CrossCheckResult> {
  const [schedRes, itemsRes] = await Promise.all([
    supabase
      .from("plan_schedule_entries")
      .select("id,mark,quantity,page_id,source_sheet,callout_sheets")
      .eq("project_id", projectId),
    supabase
      .from("takeoff_items")
      .select("id,mark,quantity,multiplier,page_id")
      .eq("project_id", projectId)
      .is("deleted_at", null),
  ]);
  if (schedRes.error) throw schedRes.error;
  if (itemsRes.error) throw itemsRes.error;

  const entries = (schedRes.data ?? []) as {
    id: string;
    mark: string | null;
    quantity: number | null;
    page_id: string | null;
    source_sheet: string | null;
    callout_sheets: string[] | null;
  }[];
  const items = (itemsRes.data ?? []) as {
    id: string;
    mark: string | null;
    quantity: number | null;
    multiplier: number | null;
    page_id: string | null;
  }[];

  const markToPages: CrossCheckResult["markToPages"] = {};
  const push = (mark: string, pageId: string | null, sheet: string | null) => {
    if (!mark) return;
    const list = (markToPages[mark] ??= []);
    if (!list.some((p) => p.pageId === pageId && p.sheet === sheet)) {
      list.push({ pageId, sheet });
    }
  };

  const schedQty = new Map<string, number>();
  const scheduleMarks = new Set<string>();
  for (const e of entries) {
    const m = norm(e.mark);
    if (!m) continue;
    scheduleMarks.add(m);
    schedQty.set(m, (schedQty.get(m) ?? 0) + (Number(e.quantity ?? 1) || 1));
    push(m, e.page_id, e.source_sheet);
    for (const s of e.callout_sheets ?? []) push(m, null, s);
  }

  const takeoffQty = new Map<string, number>();
  const takeoffMarks = new Set<string>();
  for (const i of items) {
    const m = norm(i.mark);
    if (!m) continue;
    takeoffMarks.add(m);
    const eff = (Number(i.quantity ?? 0) || 0) * (Number(i.multiplier ?? 1) || 1);
    takeoffQty.set(m, (takeoffQty.get(m) ?? 0) + eff);
    push(m, i.page_id, null);
  }

  const issues: CrossIssue[] = [];
  for (const m of scheduleMarks) {
    if (!takeoffMarks.has(m)) {
      issues.push({
        kind: "unpromoted",
        mark: m,
        detail: `Schedule lists mark ${m} but no takeoff item carries it — promote the schedule or the bid is short.`,
        scheduleQty: schedQty.get(m) ?? null,
        takeoffQty: null,
      });
    }
  }
  for (const m of takeoffMarks) {
    if (!scheduleMarks.has(m)) {
      issues.push({
        kind: "orphan",
        mark: m,
        detail: `Takeoff has mark ${m} with no matching schedule row — verify it exists on the plans.`,
        scheduleQty: null,
        takeoffQty: takeoffQty.get(m) ?? null,
      });
    }
  }
  for (const m of scheduleMarks) {
    if (!takeoffMarks.has(m)) continue;
    const s = schedQty.get(m) ?? 0;
    const t = takeoffQty.get(m) ?? 0;
    if (s !== t) {
      issues.push({
        kind: "qty_mismatch",
        mark: m,
        detail: `Mark ${m}: schedule says ${s}, takeoff counts ${t}. Resolve before quoting.`,
        scheduleQty: s,
        takeoffQty: t,
      });
    }
  }

  return { issues, markToPages, scheduleMarks, takeoffMarks };
}
