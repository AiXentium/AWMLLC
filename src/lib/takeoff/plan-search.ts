/**
 * Plan-wide search — Togal-style "search, don't trace".
 *
 * The pre-analysis pipeline (runner.ts) persists extracted sheet text into
 * plan_sheet_classifications.sheet_text (see 20261007000000_plan_search.sql).
 * This module searches that text for window/door tags and converts accepted
 * matches into takeoff_items.
 *
 * Two flows:
 *  - Manual: estimator types a tag (e.g. "W6"), we ILIKE every sheet.
 *  - Auto review: schedule marks from plan_schedule_entries are searched
 *    across sheets; the pipeline already recorded callout_matches /
 *    callout_sheets, and this re-verifies them live against stored text.
 *
 * Conversion follows the promote.ts pattern: status 'review',
 * source 'plan_search', idempotent via the notes ref.
 */
import { supabase } from "@/integrations/supabase/client";
import { parseSizePair } from "./dimensions";
import { logAudit } from "@/lib/audit";

export type SheetSearchHit = {
  sheetId: string; // plan_sheet_classifications.id
  pageId: string | null;
  pageNumber: number | null;
  sheetNumber: string | null;
  title: string | null;
  category: string | null;
  matchCount: number;
  snippet: string;
};

export type ScheduleMark = {
  id: string;
  mark: string | null;
  schedule_type: string | null;
  type_label: string | null;
  width: string | null;
  height: string | null;
  quantity: number | null;
  operation: string | null;
  material: string | null;
  glazing: string | null;
  confidence: number | null;
  callout_matches: number | null;
  callout_sheets: string[] | null;
  page_id: string | null;
  source_sheet: string | null;
};

/** Escape LIKE wildcards so the tag is matched literally. */
function escapeLike(tag: string): string {
  return tag.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** Count non-overlapping occurrences of tag in text (case-insensitive). */
function countOccurrences(text: string, tag: string): number {
  if (!tag) return 0;
  const lower = text.toLowerCase();
  const needle = tag.toLowerCase();
  let count = 0;
  let idx = 0;
  while ((idx = lower.indexOf(needle, idx)) !== -1) {
    count += 1;
    idx += needle.length;
  }
  return count;
}

/** Short context window around the first match, for the review UI. */
function snippetAround(text: string, tag: string, radius = 60): string {
  const idx = text.toLowerCase().indexOf(tag.toLowerCase());
  if (idx === -1) return text.slice(0, 120);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + tag.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).replace(/\s+/g, " ").trim()}${suffix}`;
}

/**
 * Manual tag search across all stored sheet texts for a project.
 * Returns one hit per sheet that contains the tag, with match counts.
 */
export async function searchSheetsForTag(
  projectId: string,
  tag: string,
): Promise<SheetSearchHit[]> {
  const clean = tag.trim();
  if (!clean) return [];
  const { data, error } = await supabase
    .from("plan_sheet_classifications")
    .select("id,page_id,page_number,sheet_number,title,category,sheet_text")
    .eq("project_id", projectId)
    .not("sheet_text", "is", null)
    .ilike("sheet_text", `%${escapeLike(clean)}%`)
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const text = String(r.sheet_text ?? "");
    return {
      sheetId: r.id as string,
      pageId: (r.page_id as string | null) ?? null,
      pageNumber: (r.page_number as number | null) ?? null,
      sheetNumber: (r.sheet_number as string | null) ?? null,
      title: (r.title as string | null) ?? null,
      category: (r.category as string | null) ?? null,
      matchCount: countOccurrences(text, clean),
      snippet: snippetAround(text, clean),
    };
  });
}

/** All schedule marks for the auto-review tab. */
export async function scheduleMarksForProject(projectId: string): Promise<ScheduleMark[]> {
  const { data, error } = await supabase
    .from("plan_schedule_entries")
    .select(
      "id,mark,schedule_type,type_label,width,height,quantity,operation,material,glazing,confidence,callout_matches,callout_sheets,page_id,source_sheet",
    )
    .eq("project_id", projectId)
    .order("mark", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ScheduleMark[];
}

/**
 * Live re-verification of one mark against stored sheet texts.
 * The pipeline's callout_matches is the first pass; this confirms each hit
 * against the persisted text and reports per-sheet counts.
 */
export async function verifyMarkAcrossSheets(
  projectId: string,
  mark: string,
): Promise<{ sheets: SheetSearchHit[]; totalMatches: number }> {
  const sheets = await searchSheetsForTag(projectId, mark);
  return { sheets, totalMatches: sheets.reduce((s, h) => s + h.matchCount, 0) };
}

function categoryFor(scheduleType: string | null, mark: string | null): string {
  const t = `${scheduleType ?? ""} ${mark ?? ""}`.toLowerCase();
  if (/\b(sf|storefront|curtain|cw)\b/.test(t) || t.includes("glaz"))
    return "storefront_curtainwall";
  if (t.includes("door") || /^d[\s-]?\d/i.test(mark ?? "")) return "door";
  return "window";
}

async function alreadyConvertedRefs(projectId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("takeoff_items")
    .select("notes")
    .eq("project_id", projectId)
    .eq("source", "plan_search")
    .like("notes", "plan-search:%");
  return new Set(
    (data ?? []).map((r) => {
      const m = String(r.notes ?? "").match(/^plan-search:(\S+)/);
      return m ? m[1] : "";
    }),
  );
}

export type PlanSearchConversion = {
  promoted: number;
  skipped: number;
  itemIds: string[];
};

/**
 * Converts accepted AUTO marks (schedule entries) into takeoff items.
 * Idempotent: re-running skips entries already converted.
 */
export async function convertAutoMarksToTakeoff(
  projectId: string,
  marks: ScheduleMark[],
): Promise<PlanSearchConversion> {
  const done = await alreadyConvertedRefs(projectId);
  const result: PlanSearchConversion = { promoted: 0, skipped: 0, itemIds: [] };
  const rows: Record<string, unknown>[] = [];

  for (const m of marks) {
    const ref = `auto:${m.id}`;
    if (done.has(ref)) {
      result.skipped += 1;
      continue;
    }
    const size = parseSizePair(m.width, m.height);
    const qty = Math.max(1, Math.round(Number(m.callout_matches ?? m.quantity ?? 1) || 1));
    rows.push({
      project_id: projectId,
      page_id: m.page_id,
      mark: m.mark,
      category: categoryFor(m.schedule_type, m.mark),
      type_name: m.type_label,
      quantity: qty,
      width_in: size?.widthIn ?? null,
      height_in: size?.heightIn ?? null,
      operation: m.operation,
      glass: m.glazing,
      notes: `plan-search:${ref} — found ${m.callout_matches ?? 0} callout(s) on ${(m.callout_sheets ?? []).join(", ") || "sheets"}${size ? "" : " — size unreadable, verify"}${m.material ? ` | ${m.material}` : ""}`,
      status: "review",
      source: "plan_search",
      ai_confidence: m.confidence,
    });
  }

  if (rows.length) {
    const { data, error } = await supabase.from("takeoff_items").insert(rows).select("id");
    if (error) throw error;
    result.promoted = rows.length;
    result.itemIds = (data ?? []).map((r) => r.id);
  }

  await logAudit({
    projectId,
    action: "takeoff.plan_search_converted",
    entityType: "project",
    detail: {
      mode: "auto",
      promoted: result.promoted,
      skipped: result.skipped,
    },
  });
  return result;
}

/**
 * Converts accepted MANUAL search hits into takeoff items.
 * One item per (tag, sheet); quantity = match count on that sheet.
 * Idempotent via the plan-search:manual ref.
 */
export async function convertManualHitsToTakeoff(
  projectId: string,
  tag: string,
  hits: SheetSearchHit[],
): Promise<PlanSearchConversion> {
  const done = await alreadyConvertedRefs(projectId);
  const result: PlanSearchConversion = { promoted: 0, skipped: 0, itemIds: [] };
  const rows: Record<string, unknown>[] = [];

  for (const h of hits) {
    const ref = `manual:${tag.toLowerCase()}:${h.sheetId}`;
    if (done.has(ref)) {
      result.skipped += 1;
      continue;
    }
    const sheetLabel = h.sheetNumber ?? (h.pageNumber ? `Page ${h.pageNumber}` : "sheet");
    rows.push({
      project_id: projectId,
      page_id: h.pageId,
      mark: tag.trim(),
      category: categoryFor(null, tag),
      type_name: h.title,
      quantity: Math.max(1, h.matchCount),
      width_in: null,
      height_in: null,
      notes: `plan-search:${ref} — ${h.matchCount} match(es) on ${sheetLabel}; size unreadable, verify`,
      status: "review",
      source: "plan_search",
    });
  }

  if (rows.length) {
    const { data, error } = await supabase.from("takeoff_items").insert(rows).select("id");
    if (error) throw error;
    result.promoted = rows.length;
    result.itemIds = (data ?? []).map((r) => r.id);
  }

  await logAudit({
    projectId,
    action: "takeoff.plan_search_converted",
    entityType: "project",
    detail: {
      mode: "manual",
      tag,
      promoted: result.promoted,
      skipped: result.skipped,
    },
  });
  return result;
}
