import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { extractPageText, loadPdfFromUrl, renderPageToDataUrl } from "@/lib/pdf-client";
import { runSheetDetection } from "@/lib/ai/detections";
import { readPageWithOcr, OCR_FALLBACK_MIN_CHARS } from "@/lib/ocr/reader";
import type { OcrSource } from "@/lib/ocr/types";
import { signedUrl } from "@/lib/storage-client";
import { logAudit } from "@/lib/audit";
import { classifyPlanSheets, readPlanSchedules, extractTitleBlocks } from "./analysis.functions";
import { extractTitleBlock, type TitleBlockResult } from "./title-block";
import {
  buildQuantityBreakdowns,
  buildQuantityDiscrepancies,
  toQuantityEstimates,
  type MarkEvidence,
} from "./quantities";
import { recordFacts, recordQuantities, type IntelligenceFact } from "@/lib/intelligence/store";
import {
  CALLOUT_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_RELEVANCE,
  COVERAGE_EXPECTATIONS,
  SCHEDULE_CATEGORIES,
  WORKING_SET_THRESHOLD,
  autoWorkingSetName,
  countCallouts,
  hintSheet,
  isAnalysisBusy,
  normalizeMark,
  resolveTradeFocus,
  TRADE_FOCI,
  type AnalysisStage,
  type SheetCategory,
  type TradeFocus,
} from "./shared";

const MAX_PAGES = 60;
const CLASSIFY_BATCH = 20;
const MAX_SCHEDULE_SHEETS = 6;
const MIN_SCHEDULE_TEXT = 300;
/** Vision-first counting: max working-set sheets to visually scan per run. */
const VISION_SHEETS_MAX = 20;
/** Per-sheet timeouts so one slow sheet can't stall the whole pipeline. */
const VISION_RENDER_TIMEOUT_MS = 60_000;
const VISION_DETECT_TIMEOUT_MS = 180_000;
/** Tokens like W1 / D-12 / SF3 that read as window, door or glazing callouts. */
const CALLOUT_TOKEN = /\b(W|D|SF|CW|WW|G)-?\d{1,3}[A-Z]?\b/g;

export type AnalysisProgress = { stage: AnalysisStage; message: string };

/** Stops two mounted surfaces from starting the same project's analysis twice. */
const activeProjects = new Set<string>();

// Cancellation flags per project — lets the UI stop a running scan.
const cancelFlags = new Map<string, boolean>();
export function requestCancelPreAnalysis(projectId: string) {
  cancelFlags.set(projectId, true);
}
function isCancelled(projectId: string) {
  return cancelFlags.get(projectId) === true;
}

type PageRow = {
  id: string;
  page_number: number;
  sheet_number: string | null;
  title: string | null;
};

type SheetWork = {
  pageNumber: number;
  text: string;
  page: PageRow | undefined;
  category: SheetCategory;
  confidence: number;
  reason: string | null;
  /** OCR provenance — set when the sheet was read via Tesseract fallback. */
  ocrSource: OcrSource | null;
  ocrConfidence: number | null;
  ocrNeedsReview: boolean;
};

/**
 * Automatic plan pre-analysis.
 *
 * Runs unattended right after intake: reads every sheet, classifies schedules /
 * plans / elevations / reflected ceiling plans, auto-builds the initial working
 * set, transcribes the window and door schedules, correlates each mark against
 * plan callouts and records counts, confidence and conflicts for approval.
 */
export async function runPlanPreAnalysis(opts: {
  projectId: string;
  documentId?: string | null;
  /** When set, only this trade's sheets enter the working set and schedule reading. */
  tradeFocus?: TradeFocus | null;
  onProgress?: (progress: AnalysisProgress) => void;
}): Promise<{ runId: string | null; windows: number; doors: number; error?: string }> {
  const { projectId } = opts;
  // Clear any stale cancellation flag from a previous run.
  cancelFlags.delete(projectId);
  const tradeFocus = resolveTradeFocus(opts.tradeFocus);
  const focusInfo = TRADE_FOCI[tradeFocus];
  const focusCategories = focusInfo.categories;
  const report = (stage: AnalysisStage, message: string) => opts.onProgress?.({ stage, message });

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  const docSelect = "id,name,storage_path,status,page_count";
  const docs = opts.documentId
    ? (await supabase.from("documents").select(docSelect).eq("id", opts.documentId).limit(1)).data
    : (
        await supabase
          .from("documents")
          .select(docSelect)
          .eq("project_id", projectId)
          .not("storage_path", "is", null)
          .in("status", ["ready", "partially_failed"])
          .order("created_at", { ascending: false })
          .limit(1)
      ).data;

  const doc = docs?.[0];
  if (!doc?.storage_path) {
    return { runId: null, windows: 0, doors: 0, error: "No readable document yet." };
  }

  const { data: runRow } = await supabase
    .from("plan_analysis_runs")
    .insert({
      project_id: projectId,
      document_id: doc.id,
      status: "reading_sheets",
      stage_message: `Reading ${doc.name}`,
      created_by: userId,
    })
    .select("id")
    .maybeSingle();
  const runId = runRow?.id ?? null;

  // Best-effort: record the trade focus on the run (column arrives via migration;
  // ignored when the migration hasn't been pushed yet).
  if (runId) {
    try {
      await supabase.from("plan_analysis_runs").update({ trade_focus: tradeFocus }).eq("id", runId);
    } catch {
      /* migration not pushed yet — scan continues without it */
    }
  }

  const setRun = async (status: AnalysisStage, patch: Record<string, unknown> = {}) => {
    report(status, String(patch.stage_message ?? ""));
    if (runId)
      await supabase
        .from("plan_analysis_runs")
        .update({ status, ...patch })
        .eq("id", runId);
  };

  try {
    // ---- 1. Read every sheet -------------------------------------------
    report("reading_sheets", `Reading ${doc.name}`);
    const url = await signedUrl("plan-files", doc.storage_path, 3600);
    const pdf = await loadPdfFromUrl(url);
    const total = Math.min(pdf.numPages, MAX_PAGES);

    const { data: pageRows } = await supabase
      .from("pages")
      .select("id,page_number,sheet_number,title")
      .eq("document_id", doc.id);
    const pageByNumber = new Map<number, PageRow>(
      (pageRows ?? []).map((p) => [p.page_number, p as PageRow]),
    );

    // Text extraction dominates the wall-clock time on large sets, so read the
    // sheets in small parallel chunks instead of strictly one at a time.
    const READ_CHUNK = 6;
    const sheets: SheetWork[] = [];
    for (let start = 1; start <= total; start += READ_CHUNK) {
      if (isCancelled(projectId)) throw new Error("Scan stopped by user.");
      const numbers: number[] = [];
      for (let n = start; n < start + READ_CHUNK && n <= total; n += 1) numbers.push(n);
      const texts = await Promise.all(
        numbers.map((n) =>
          Promise.race([
            extractPageText(pdf, n),
            // A single hung page must not stall the whole scan — skip it.
            new Promise<string>((resolve) => window.setTimeout(() => resolve(""), 30000)),
          ]).catch(() => ""),
        ),
      );
      numbers.forEach((n, i) => {
        sheets.push({
          pageNumber: n,
          text: texts[i],
          page: pageByNumber.get(n),
          category: "other",
          confidence: 0,
          reason: null,
          ocrSource: null,
          ocrConfidence: null,
          ocrNeedsReview: false,
        });
      });
      await setRun("reading_sheets", {
        stage_message: `Read ${sheets.length} of ${total} sheets`,
        sheets_total: pdf.numPages,
        sheets_analyzed: sheets.length,
      });
    }

    // ---- 1b. Title block extraction (Togal-style auto-naming) ------------
    // Regex first (fast, free); AI fallback only for sheets regex missed.
    await setRun("reading_sheets", {
      stage_message: `Naming sheets from title blocks`,
    });
    const titleByPage = new Map<number, TitleBlockResult>();
    for (const s of sheets) {
      titleByPage.set(s.pageNumber, extractTitleBlock(s.text));
    }
    // AI fallback for sheets where regex found nothing useful.
    const needsAi = sheets.filter(
      (s) => (titleByPage.get(s.pageNumber)?.confidence ?? 0) < 0.6 && s.text.trim().length > 100,
    );
    for (let i = 0; i < needsAi.length; i += 20) {
      if (isCancelled(projectId)) throw new Error("Scan stopped by user.");
      const batch = needsAi.slice(i, i + 20);
      try {
        const result = await extractTitleBlocks({
          data: {
            projectId,
            sheets: batch.map((s) => ({ pageNumber: s.pageNumber, text: s.text })),
          },
        });
        for (const r of result.sheets ?? []) {
          const prev = titleByPage.get(r.pageNumber);
          if (!prev || r.confidence > prev.confidence) {
            titleByPage.set(r.pageNumber, {
              sheet_number: r.sheet_number,
              title: r.title,
              confidence: r.confidence,
            });
          }
        }
      } catch {
        // AI fallback is best-effort; regex results still stand.
      }
    }
    // Persist to the pages table in one bulk upsert (don't clobber existing
    // values unless the new extraction is more confident).
    const pageUpdates = sheets
      .map((s) => {
        const t = titleByPage.get(s.pageNumber);
        const existing = s.page;
        if (!t || t.confidence < 0.6 || !s.page?.id) return null;
        const sheet_number =
          !existing?.sheet_number || t.confidence >= 0.8 ? t.sheet_number : existing.sheet_number;
        const title = !existing?.title || t.confidence >= 0.8 ? t.title : existing.title;
        if (!sheet_number && !title) return null;
        return {
          document_id: doc.id,
          project_id: projectId,
          page_number: s.pageNumber,
          sheet_number,
          title,
        };
      })
      .filter((u): u is NonNullable<typeof u> => u !== null);
    if (pageUpdates.length) {
      await supabase.from("pages").upsert(pageUpdates, { onConflict: "document_id,page_number" });
    }

    // ---- 2. Classify ----------------------------------------------------
    await setRun("classifying", {
      stage_message: "Identifying schedules, plans and elevations",
      sheets_total: pdf.numPages,
      sheets_analyzed: total,
    });

    let classifyError: string | undefined;
    let provider: string | undefined;
    let model: string | undefined;

    for (let i = 0; i < sheets.length; i += CLASSIFY_BATCH) {
      if (isCancelled(projectId)) throw new Error("Scan stopped by user.");
      const batch = sheets.slice(i, i + CLASSIFY_BATCH);
      // Token saver: with a specific trade focus, sheets with zero keyword
      // hint never go to AI classification — they can't be relevant.
      // Deterministic hint first, AI only for candidates.
      const candidates: typeof batch = [];
      const skipped: typeof batch = [];
      for (const s of batch) {
        const h = hintSheet(s.text, s.page?.sheet_number ?? null, s.page?.title ?? null);
        if (tradeFocus !== "all" && h.score === 0) {
          s.category = "other";
          s.confidence = 0.15;
          s.reason = "Skipped: no trade-relevant keywords (deterministic pre-filter)";
          skipped.push(s);
        } else {
          candidates.push(s);
        }
      }
      const payload = candidates.map((s) => {
        const hint = hintSheet(s.text, s.page?.sheet_number ?? null, s.page?.title ?? null);
        return {
          pageNumber: s.pageNumber,
          sheetLabel: s.page?.sheet_number ?? null,
          title: s.page?.title ?? null,
          text: s.text,
          hint: `${hint.category} (${hint.score})`,
        };
      });
      if (candidates.length === 0) {
        // Entire batch skipped by the deterministic pre-filter — no AI spend.
        await setRun("classifying", {
          stage_message: `Classified ${Math.min(i + CLASSIFY_BATCH, sheets.length)} of ${sheets.length} sheets (${skipped.length} skipped by keyword pre-filter)`,
        });
        continue;
      }
      const result = await classifyPlanSheets({ data: { projectId, sheets: payload } });
      provider = result.provider ?? provider;
      model = result.model ?? model;
      if (result.error) classifyError = result.error;
      const byPage = new Map(result.sheets.map((s) => [s.pageNumber, s]));
      for (const sheet of candidates) {
        const hit = byPage.get(sheet.pageNumber);
        if (hit) {
          sheet.category = hit.category;
          sheet.confidence = hit.confidence;
          sheet.reason = hit.reason;
        } else {
          // Keyword fallback so a partial model reply never loses a sheet.
          const hint = hintSheet(
            sheet.text,
            sheet.page?.sheet_number ?? null,
            sheet.page?.title ?? null,
          );
          sheet.category = hint.category;
          sheet.confidence = hint.score > 0 ? Math.min(0.6, hint.score / 150) : 0.2;
          sheet.reason = hint.score > 0 ? "Matched by sheet title keywords" : null;
        }
      }
      await setRun("classifying", {
        stage_message: `Classified ${Math.min(i + CLASSIFY_BATCH, sheets.length)} of ${sheets.length} sheets${skipped.length ? ` (${skipped.length} skipped by keyword pre-filter)` : ""}`,
      });
    }

    if (classifyError && sheets.every((s) => s.confidence === 0)) {
      await setRun("failed", {
        stage_message: classifyError,
        error_message: classifyError.slice(0, 500),
      });
      return { runId, windows: 0, doors: 0, error: classifyError };
    }

    // Trade focus: only this trade's sheets enter the working set and the
    // expensive schedule-reading step, saving AI time and tokens.
    const selected = sheets.filter(
      (s) =>
        CATEGORY_RELEVANCE[s.category] >= WORKING_SET_THRESHOLD &&
        focusCategories.includes(s.category),
    );

    if (runId) {
      await supabase.from("plan_sheet_classifications").insert(
        sheets.map((s) => {
          const t = titleByPage.get(s.pageNumber);
          const useExtracted = t && t.confidence >= 0.6;
          return {
            run_id: runId,
            project_id: projectId,
            document_id: doc.id,
            page_id: s.page?.id ?? null,
            page_number: s.pageNumber,
            sheet_number:
              useExtracted && t.sheet_number ? t.sheet_number : (s.page?.sheet_number ?? null),
            title: useExtracted && t.title ? t.title : (s.page?.title ?? null),
            category: s.category,
            relevance: CATEGORY_RELEVANCE[s.category],
            confidence: s.confidence,
            reason: s.reason,
            selected: CATEGORY_RELEVANCE[s.category] >= WORKING_SET_THRESHOLD,
            // Persisted for plan-wide tag search (see 20261007000000_plan_search.sql).
            sheet_text: s.text ? s.text.slice(0, 8000) : null,
          };
        }),
      );
    }

    // ---- 3. Auto-build the working set ----------------------------------
    await setRun("building_working_set", {
      stage_message:
        tradeFocus === "all"
          ? `Selecting ${selected.length} takeoff-relevant sheet(s)`
          : `Selecting ${selected.length} ${focusInfo.label.toLowerCase()} sheet(s)`,
      sheets_selected: selected.length,
    });

    let workingSetId: string | null = null;
    const selectedWithPages = selected.filter((s) => s.page?.id);
    if (selectedWithPages.length) {
      // Split-plan grouping: parts of one original file (Set.part1.pdf,
      // Set.part2.pdf, …) share a single working set so the project is
      // treated as one takeoff, not N fragments.
      const wsName = autoWorkingSetName(doc.name, focusInfo.label);
      const { data: existing } = await supabase
        .from("working_sets")
        .select("id")
        .eq("project_id", projectId)
        .eq("name", wsName)
        .maybeSingle();

      if (existing?.id) {
        workingSetId = existing.id as string;
      } else {
        const { data: created } = await supabase
          .from("working_sets")
          .insert({
            project_id: projectId,
            name: wsName,
            category: "Window Takeoff",
            description: `Auto-selected by AI pre-analysis from ${doc.name} (${focusInfo.label} focus): ${focusInfo.blurb}.`,
            created_by: userId,
          })
          .select("id")
          .maybeSingle();
        workingSetId = created?.id ?? null;
      }

      if (workingSetId) {
        // Continue sort_order past pages already in the set (other parts).
        const { data: existingPages } = await supabase
          .from("working_set_pages")
          .select("page_id,sort_order")
          .eq("working_set_id", workingSetId);
        const seenPageIds = new Set((existingPages ?? []).map((p) => p.page_id as string));
        const maxOrder = (existingPages ?? []).reduce(
          (m, p) => Math.max(m, Number(p.sort_order ?? 0) || 0),
          -1,
        );
        const ordered = [...selectedWithPages]
          .filter((s) => !seenPageIds.has(s.page!.id))
          .sort(
            (a, b) =>
              CATEGORY_RELEVANCE[b.category] - CATEGORY_RELEVANCE[a.category] ||
              a.pageNumber - b.pageNumber,
          );
        if (ordered.length) {
          await supabase.from("working_set_pages").insert(
            ordered.map((s, index) => ({
              working_set_id: workingSetId as string,
              page_id: s.page!.id,
              sort_order: maxOrder + 1 + index,
            })),
          );
        }
        await logAudit({
          projectId,
          action: "analysis.working_set_created",
          entityType: "working_set",
          entityId: workingSetId,
          detail: { name: wsName, sheets: ordered.length, document: doc.name },
        });
      }
    }

    // ---- 3b. Vision counting (Togal-style) ------------------------------
    // Render each working-set sheet as a high-res image and let vision AI
    // visually detect openings — actual boxes on the plan, not just text
    // callouts. The text pipeline stays as a complement for cross-checking.
    // Detections are stored in ai_detections by runSheetDetection, so the
    // Viewer canvas shows the bounding boxes automatically.
    const visionSheets = [...selectedWithPages]
      .sort(
        (a, b) =>
          CATEGORY_RELEVANCE[b.category] - CATEGORY_RELEVANCE[a.category] ||
          b.confidence - a.confidence,
      )
      .slice(0, VISION_SHEETS_MAX);

    let visionWindows = 0;
    let visionDoors = 0;
    let visionGlazing = 0;
    let visionSheetsScanned = 0;
    // Only detections created during this vision pass count toward the
    // aggregate — re-runs stay idempotent and older rows are never touched.
    const visionStart = new Date().toISOString();
    const visionBySheet: Array<{
      sheet: string;
      pageId: string;
      windows: number;
      doors: number;
      glazing: number;
      detections: number;
    }> = [];

    if (visionSheets.length && runId) {
      let done = 0;
      for (const sheet of visionSheets) {
        if (isCancelled(projectId)) throw new Error("Scan stopped by user.");
        const pageId = sheet.page!.id as string;
        const sheetLabel = sheet.page?.sheet_number ?? `page ${sheet.pageNumber}`;
        await setRun("vision_counting", {
          stage_message: `Visually counting openings on ${sheetLabel} (${done + 1} of ${visionSheets.length})`,
          working_set_id: workingSetId,
        });
        try {
          const imageDataUrl = await Promise.race([
            renderPageToDataUrl(pdf, sheet.pageNumber, 1500, 0.75),
            new Promise<never>((_, reject) =>
              window.setTimeout(
                () => reject(new Error(`Render timed out on ${sheetLabel}`)),
                VISION_RENDER_TIMEOUT_MS,
              ),
            ),
          ]);
          await Promise.race([
            runSheetDetection({ projectId, pageId, imageDataUrl, region: null }),
            new Promise<never>((_, reject) =>
              window.setTimeout(
                () => reject(new Error(`Vision detection timed out on ${sheetLabel}`)),
                VISION_DETECT_TIMEOUT_MS,
              ),
            ),
          ]);
          const { data: dets } = await supabase
            .from("ai_detections")
            .select("category,label,quantity,confidence")
            .eq("project_id", projectId)
            .eq("page_id", pageId)
            .eq("status", "pending")
            .gte("created_at", visionStart);
          let w = 0;
          let d = 0;
          let g = 0;
          for (const det of dets ?? []) {
            const qty = Math.max(1, Number(det.quantity ?? 1) || 1);
            if (det.category === "window") w += qty;
            else if (det.category === "door") d += qty;
            else if (det.category === "glazing") g += qty;
          }
          visionWindows += w;
          visionDoors += d;
          visionGlazing += g;
          visionBySheet.push({
            sheet: sheetLabel,
            pageId,
            windows: w,
            doors: d,
            glazing: g,
            detections: (dets ?? []).length,
          });
          done += 1;
          visionSheetsScanned = done;
        } catch (visionError) {
          // One slow or failing sheet must not kill the pipeline.
          await logAudit({
            projectId,
            action: "analysis.vision_sheet_failed",
            entityType: "document",
            entityId: doc.id,
            detail: {
              sheet: sheetLabel,
              error: visionError instanceof Error ? visionError.message : "Vision scan failed.",
            },
          });
        }
      }

      // Cross-sheet dedup by mark: the same labeled unit seen on a floor plan
      // and an elevation is one unit, not two — keep the max quantity per label.
      const labelGroups = new Map<string, { category: string; maxQty: number }>();
      if (visionBySheet.length) {
        const { data: allVision } = await supabase
          .from("ai_detections")
          .select("category,label,quantity")
          .eq("project_id", projectId)
          .in(
            "page_id",
            visionBySheet.map((s) => s.pageId),
          )
          .eq("status", "pending")
          .gte("created_at", visionStart);
        for (const det of allVision ?? []) {
          const rawLabel = (det.label as string | null) ?? "";
          if (!rawLabel.trim()) continue;
          const key = normalizeMark(rawLabel);
          const qty = Math.max(1, Number(det.quantity ?? 1) || 1);
          const existing = labelGroups.get(key);
          if (existing) existing.maxQty = Math.max(existing.maxQty, qty);
          else labelGroups.set(key, { category: det.category as string, maxQty: qty });
        }
      }
      let dedupWindows = 0;
      let dedupDoors = 0;
      let dedupGlazing = 0;
      for (const group of labelGroups.values()) {
        if (group.category === "window") dedupWindows += group.maxQty;
        else if (group.category === "door") dedupDoors += group.maxQty;
        else if (group.category === "glazing") dedupGlazing += group.maxQty;
      }

      const visionDetail = {
        sheetsScanned: visionSheetsScanned,
        sheetsAttempted: visionSheets.length,
        rawTotals: { windows: visionWindows, doors: visionDoors, glazing: visionGlazing },
        dedupedByLabel: { windows: dedupWindows, doors: dedupDoors, glazing: dedupGlazing },
        uniqueLabels: labelGroups.size,
        bySheet: visionBySheet,
      };

      await setRun("vision_counting", {
        stage_message:
          `Vision scan complete: ${visionWindows} window and ${visionDoors} door unit(s) ` +
          `visually detected across ${visionSheetsScanned} sheet(s)` +
          (labelGroups.size ? ` (${labelGroups.size} unique marks)` : ""),
        working_set_id: workingSetId,
      });
      // Best-effort: vision columns arrive via migration; ignored when the
      // migration hasn't been pushed yet (same pattern as trade_focus).
      try {
        await supabase
          .from("plan_analysis_runs")
          .update({
            vision_window_count: visionWindows,
            vision_door_count: visionDoors,
            vision_sheets_scanned: visionSheetsScanned,
            vision_detail: visionDetail,
          })
          .eq("id", runId);
      } catch {
        // Migration not pushed yet — vision counts remain visible via facts.
      }
    }

    // ---- 4. Read the schedules ------------------------------------------
    // Trade focus applies here too: only this trade's schedule sheets get the
    // expensive vision/text AI read.
    const scheduleSheets = sheets
      .filter(
        (s) => SCHEDULE_CATEGORIES.includes(s.category) && focusCategories.includes(s.category),
      )
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, MAX_SCHEDULE_SHEETS);

    await setRun("reading_schedules", {
      stage_message: scheduleSheets.length
        ? `Reading ${scheduleSheets.length} ${tradeFocus === "all" ? "" : `${focusInfo.label.toLowerCase()} `}schedule sheet(s)`
        : tradeFocus === "all"
          ? "No window or door schedule sheet identified"
          : `No ${focusInfo.label.toLowerCase()} schedule sheet identified`,
      working_set_id: workingSetId,
    });

    // ---- 4a. OCR fallback for scanned schedule sheets -------------------
    // A thin text layer means the sheet is a scan: run Tesseract OCR so the
    // schedule reader works from transcribed text with confidence scores,
    // not from a vision model guessing at pixels.
    let ocrSheetCount = 0;
    const ocrReviewSheets: number[] = [];
    const ocrMethods = new Set<string>();
    for (const sheet of scheduleSheets) {
      if (sheet.text.trim().length >= OCR_FALLBACK_MIN_CHARS) continue;
      await setRun("reading_schedules", {
        stage_message: `OCR reading scanned schedule sheet ${sheet.page?.sheet_number ?? sheet.pageNumber}…`,
        working_set_id: workingSetId,
      });
      const ocr = await readPageWithOcr(pdf, sheet.pageNumber).catch(() => null);
      if (ocr && ocr.charCount > sheet.text.trim().length) {
        sheet.text = ocr.text;
        sheet.ocrSource = ocr.source;
        sheet.ocrConfidence = ocr.avgConfidence;
        sheet.ocrNeedsReview = ocr.needsReview;
        ocrSheetCount += 1;
        ocrMethods.add(ocr.source);
        if (ocr.needsReview) ocrReviewSheets.push(sheet.pageNumber);
      }
    }
    const ocrMethodLabel = [...ocrMethods].join(", ") || "tesseract";

    const scheduleText = scheduleSheets.reduce((sum, s) => sum + s.text.length, 0);
    const useVision = scheduleSheets.length > 0 && scheduleText < MIN_SCHEDULE_TEXT;
    const images: string[] = [];
    if (useVision) {
      for (const sheet of scheduleSheets.slice(0, 3)) {
        images.push(await renderPageToDataUrl(pdf, sheet.pageNumber, 1800));
      }
    }

    let rows: Awaited<ReturnType<typeof readPlanSchedules>>["rows"] = [];
    let scheduleError: string | undefined;
    if (scheduleSheets.length) {
      const result = await readPlanSchedules({
        data: {
          projectId,
          sheets: (useVision ? scheduleSheets.slice(0, 3) : scheduleSheets).map((s) => ({
            pageNumber: s.pageNumber,
            sheetLabel: s.page?.sheet_number ?? null,
            category: s.category,
            text: s.text,
            ocrSource: s.ocrSource,
            ocrConfidence: s.ocrConfidence,
            ocrNeedsReview: s.ocrNeedsReview,
          })),
          images,
        },
      });
      rows = result.rows;
      scheduleError = result.error;
      provider = result.provider ?? provider;
      model = result.model ?? model;
    }

    // ---- 5. Correlate marks with plan callouts ---------------------------
    await setRun("correlating", {
      stage_message: "Correlating schedule marks with plan callouts",
      used_vision: useVision,
    });

    // Callouts are counted per source category so schedule totals, floor plans
    // and elevations can be compared against each other rather than merged.
    const CORRELATION_CATEGORIES: SheetCategory[] = [
      ...CALLOUT_CATEGORIES,
      "section_detail",
      "general_notes",
    ];
    const calloutSheets = sheets.filter(
      (s) => CORRELATION_CATEGORIES.includes(s.category) && s.text.length > 20,
    );
    const planSheets = calloutSheets.filter((s) => CALLOUT_CATEGORIES.includes(s.category));
    const scheduleMarks = new Set(
      rows.map((r) => (r.mark ? normalizeMark(r.mark) : "")).filter(Boolean),
    );

    const evidence: MarkEvidence[] = [];
    /** Callout hits per analysed sheet, used to explain why a sheet was selected. */
    const sheetCallouts = new Map<number, number>();

    const entryRows = rows.map((row) => {
      const page = row.pageNumber ? pageByNumber.get(row.pageNumber) : undefined;
      const fallbackSheet = scheduleSheets[0];
      const matches: string[] = [];
      const byCategory: Record<string, number> = {};
      let hits = 0;
      if (row.mark) {
        for (const sheet of calloutSheets) {
          const n = countCallouts(sheet.text, row.mark);
          if (n > 0) {
            hits += n;
            byCategory[sheet.category] = (byCategory[sheet.category] ?? 0) + n;
            sheetCallouts.set(sheet.pageNumber, (sheetCallouts.get(sheet.pageNumber) ?? 0) + n);
            matches.push(sheet.page?.sheet_number ?? `Page ${sheet.pageNumber}`);
          }
        }
      }

      const entry = {
        run_id: runId,
        project_id: projectId,
        document_id: doc.id,
        page_id: page?.id ?? fallbackSheet?.page?.id ?? null,
        page_number: row.pageNumber ?? fallbackSheet?.pageNumber ?? null,
        source_sheet:
          page?.sheet_number ??
          fallbackSheet?.page?.sheet_number ??
          (row.pageNumber ? `Page ${row.pageNumber}` : null),
        schedule_type: row.scheduleType,
        mark: row.mark,
        type_label: row.typeLabel,
        width: row.width,
        height: row.height,
        quantity: row.quantity,
        material: row.material,
        glazing: row.glazing,
        operation: row.operation,
        notes: row.notes,
        callout_matches: hits,
        callout_sheets: [...new Set(matches)].slice(0, 12),
        confidence: row.confidence,
      };

      evidence.push({
        mark: row.mark,
        typeLabel: row.typeLabel,
        scheduleType: row.scheduleType,
        operation: row.operation,
        material: row.material,
        notes: row.notes,
        scheduleQuantity: row.quantity,
        confidence: row.confidence,
        pageId: entry.page_id,
        sourceSheet: entry.source_sheet,
        calloutsByCategory: byCategory,
        calloutSheets: entry.callout_sheets,
      });

      return entry;
    });

    if (entryRows.length) await supabase.from("plan_schedule_entries").insert(entryRows);

    // ---- 5b. Explain why each sheet was selected -------------------------
    const scheduleRowsBySheet = new Map<number, number>();
    for (const entry of entryRows) {
      if (entry.page_number == null) continue;
      scheduleRowsBySheet.set(
        entry.page_number,
        (scheduleRowsBySheet.get(entry.page_number) ?? 0) + 1,
      );
    }

    const explainSheet = (sheet: SheetWork) => {
      const label = CATEGORY_LABELS[sheet.category];
      const scheduleRows = scheduleRowsBySheet.get(sheet.pageNumber) ?? 0;
      const callouts = sheetCallouts.get(sheet.pageNumber) ?? 0;
      if (SCHEDULE_CATEGORIES.includes(sheet.category) && scheduleRows) {
        return `${label} — selected because ${scheduleRows} schedule entr${scheduleRows === 1 ? "y was" : "ies were"} read from this sheet.`;
      }
      if (callouts) {
        return `${label} — selected because ${callouts} window/door callout${callouts === 1 ? " was" : "s were"} detected on this sheet.`;
      }
      if (CATEGORY_RELEVANCE[sheet.category] >= WORKING_SET_THRESHOLD) {
        return `${label} — selected because this sheet type carries openings relevant to the takeoff${sheet.reason ? ` (${sheet.reason})` : ""}.`;
      }
      return sheet.reason ?? `${label} — not required for the window and door takeoff.`;
    };

    if (runId) {
      for (const sheet of sheets) {
        const reason = explainSheet(sheet);
        if (reason === sheet.reason) continue;
        sheet.reason = reason;
        await supabase
          .from("plan_sheet_classifications")
          .update({ reason })
          .eq("run_id", runId)
          .eq("page_number", sheet.pageNumber);
      }
    }

    // ---- 5c. Preliminary quantities --------------------------------------
    const breakdowns = buildQuantityBreakdowns(evidence);
    await recordQuantities(projectId, toQuantityEstimates(projectId, runId, breakdowns));

    // ---- 6. Issues -------------------------------------------------------
    const issues: {
      run_id: string | null;
      project_id: string;
      page_id: string | null;
      page_number: number | null;
      source_sheet: string | null;
      kind: string;
      severity: string;
      message: string;
    }[] = [];
    const addIssue = (
      kind: string,
      severity: string,
      message: string,
      sheet?: { page?: PageRow; pageNumber?: number },
    ) =>
      issues.push({
        run_id: runId,
        project_id: projectId,
        page_id: sheet?.page?.id ?? null,
        page_number: sheet?.pageNumber ?? null,
        source_sheet:
          sheet?.page?.sheet_number ?? (sheet?.pageNumber ? `Page ${sheet.pageNumber}` : null),
        kind,
        severity,
        message,
      });

    // Coverage analysis — report every expected category, present or missing.
    const coverage = COVERAGE_EXPECTATIONS.map((expectation) => {
      const found = sheets.filter((s) => s.category === expectation.category);
      return {
        category: expectation.category,
        label: CATEGORY_LABELS[expectation.category],
        required: expectation.required,
        sheetCount: found.length,
        sheets: found.map((s) => s.page?.sheet_number ?? `Page ${s.pageNumber}`).slice(0, 8),
        explanation: found.length ? null : expectation.missingExplanation,
      };
    });
    for (const item of coverage) {
      if (item.sheetCount) continue;
      addIssue(
        item.category.endsWith("_schedule") ? "missing_schedule" : "coverage_gap",
        item.required ? "warning" : "info",
        item.explanation ?? `No ${item.label.toLowerCase()} detected.`,
      );
    }

    if (!planSheets.length) {
      addIssue(
        "note",
        "info",
        "No floor plans or elevations with readable text were found, so callouts could not be correlated.",
      );
    }

    if (scheduleError) {
      addIssue("note", "warning", `Schedule reading reported: ${scheduleError}`);
    }

    for (const entry of entryRows) {
      if (entry.mark && entry.callout_matches === 0 && calloutSheets.length) {
        addIssue(
          "conflict",
          "warning",
          `Schedule mark ${entry.mark} was not found on any floor plan or elevation.`,
          {
            page: pageByNumber.get(entry.page_number ?? -1),
            pageNumber: entry.page_number ?? undefined,
          },
        );
      }
    }

    // Duplicate marks with different printed sizes read as a schedule conflict.
    const byMark = new Map<string, typeof entryRows>();
    for (const entry of entryRows) {
      if (!entry.mark) continue;
      const key = `${entry.schedule_type}:${normalizeMark(entry.mark)}`;
      byMark.set(key, [...(byMark.get(key) ?? []), entry]);
    }
    for (const [key, group] of byMark) {
      const sizes = new Set(group.map((g) => `${g.width ?? "?"}x${g.height ?? "?"}`));
      if (group.length > 1 && sizes.size > 1) {
        addIssue(
          "conflict",
          "warning",
          `Mark ${key.split(":")[1]} appears ${group.length} times with different sizes (${[...sizes].join(", ")}).`,
        );
      }
    }

    // Callout marks that never appear in a schedule.
    const orphan = new Map<string, string[]>();
    for (const sheet of calloutSheets) {
      for (const token of sheet.text.match(CALLOUT_TOKEN) ?? []) {
        const mark = normalizeMark(token);
        if (scheduleMarks.has(mark)) continue;
        orphan.set(mark, [
          ...new Set([
            ...(orphan.get(mark) ?? []),
            sheet.page?.sheet_number ?? `Page ${sheet.pageNumber}`,
          ]),
        ]);
      }
    }
    const orphanList = [...orphan.entries()].slice(0, 12);
    if (scheduleMarks.size && orphanList.length) {
      addIssue(
        "conflict",
        "warning",
        `${orphanList.length} callout mark(s) on the plans have no schedule row: ${orphanList
          .map(([mark, sheetsFound]) => `${mark} (${sheetsFound.slice(0, 2).join(", ")})`)
          .join("; ")}`,
      );
    }

    // Sources that disagree become explicit issues instead of a silent pick.
    for (const issue of buildQuantityDiscrepancies(breakdowns)) {
      addIssue(issue.kind, issue.severity, issue.message);
    }

    if (issues.length) await supabase.from("plan_analysis_issues").insert(issues);

    // ---- 6b. Accumulate into the persistent project intelligence model ----
    const facts: IntelligenceFact[] = [
      ...sheets.map((sheet) => ({
        projectId,
        runId,
        documentId: doc.id,
        pageId: sheet.page?.id ?? null,
        factType: "sheet_classification" as const,
        factKey: `page:${sheet.pageNumber}`,
        label: sheet.page?.sheet_number ?? `Page ${sheet.pageNumber}`,
        value: {
          category: sheet.category,
          relevance: CATEGORY_RELEVANCE[sheet.category],
          selected: CATEGORY_RELEVANCE[sheet.category] >= WORKING_SET_THRESHOLD,
          title: sheet.page?.title ?? null,
        },
        sources: [
          {
            label: sheet.page?.sheet_number ?? `Page ${sheet.pageNumber}`,
            pageId: sheet.page?.id ?? null,
            pageNumber: sheet.pageNumber,
          },
        ],
        reasoning: sheet.reason,
        confidence: sheet.confidence,
      })),
      ...entryRows.map((entry, index) => ({
        projectId,
        runId,
        documentId: doc.id,
        pageId: entry.page_id,
        factType: "schedule_row" as const,
        factKey: `${entry.schedule_type}:${entry.mark ? normalizeMark(entry.mark) : `row${index}`}`,
        label: entry.mark ?? entry.type_label,
        value: {
          scheduleType: entry.schedule_type,
          mark: entry.mark,
          typeLabel: entry.type_label,
          width: entry.width,
          height: entry.height,
          quantity: entry.quantity,
          material: entry.material,
          glazing: entry.glazing,
          operation: entry.operation,
          calloutMatches: entry.callout_matches,
        },
        sources: [
          {
            label: entry.source_sheet ?? "Schedule",
            pageId: entry.page_id,
            pageNumber: entry.page_number,
          },
          ...(entry.callout_sheets ?? []).map((label) => ({ label, detail: "plan callout" })),
        ],
        reasoning: entry.callout_matches
          ? `${entry.callout_matches} matching callout(s) on ${(entry.callout_sheets ?? []).join(", ")}`
          : "No matching plan callout found",
        confidence: entry.confidence,
      })),
      ...coverage.map((item) => ({
        projectId,
        runId,
        documentId: doc.id,
        factType: "coverage" as const,
        factKey: `coverage:${item.category}`,
        label: item.label,
        value: { ...item },
        sources: item.sheets.map((label) => ({ label })),
        reasoning: item.explanation,
        confidence: item.sheetCount ? 0.9 : 0.4,
      })),
      // OCR provenance — which schedule sheets were read by Tesseract and
      // whether any of their text needs human verification.
      ...(ocrSheetCount > 0
        ? [
            {
              projectId,
              runId,
              documentId: doc.id,
              factType: "coverage" as const,
              factKey: "ocr:schedule-sheets",
              label: "OCR schedule reading",
              value: {
                sheets: ocrSheetCount,
                method: ocrMethodLabel,
                needsReviewPages: ocrReviewSheets,
              },
              sources: [],
              reasoning:
                `${ocrSheetCount} scanned schedule sheet(s) read with ${ocrMethodLabel} ` +
                (ocrReviewSheets.length > 0
                  ? `Pages ${ocrReviewSheets.join(", ")} have low-confidence text — verify before quoting.`
                  : "All OCR text above the confidence threshold."),
              confidence: ocrReviewSheets.length > 0 ? 0.5 : 0.85,
            },
          ]
        : []),
      // Vision-vs-text cross-check: both pipelines stay visible so the
      // estimator can compare visual detections against schedule/callout counts.
      ...(visionSheetsScanned > 0
        ? [
            {
              projectId,
              runId,
              documentId: doc.id,
              factType: "coverage" as const,
              factKey: "vision:opening-counts",
              label: "Vision opening counts",
              value: {
                windows: visionWindows,
                doors: visionDoors,
                glazing: visionGlazing,
                sheetsScanned: visionSheetsScanned,
                bySheet: visionBySheet,
              },
              sources: visionBySheet.map((s) => ({ label: s.sheet, pageId: s.pageId })),
              reasoning:
                `Vision AI visually detected ${visionWindows} window and ${visionDoors} door unit(s) ` +
                `across ${visionSheetsScanned} working-set sheet(s). ` +
                `Compare against the schedule/callout counts for cross-checking.`,
              confidence: 0.75,
            },
          ]
        : []),
      ...issues.map((issue, index) => ({
        projectId,
        runId,
        documentId: doc.id,
        pageId: issue.page_id,
        factType: "conflict" as const,
        factKey: `issue:${issue.kind}:${index}`,
        label: issue.kind,
        value: { severity: issue.severity, message: issue.message },
        sources: issue.source_sheet ? [{ label: issue.source_sheet, pageId: issue.page_id }] : [],
        reasoning: issue.message,
        confidence: 0.5,
      })),
    ];
    await recordFacts(projectId, facts);

    // ---- 7. Totals -------------------------------------------------------
    const windows = entryRows
      .filter((r) => r.schedule_type === "window")
      .reduce((s, r) => s + r.quantity, 0);
    const doors = entryRows
      .filter((r) => r.schedule_type === "door")
      .reduce((s, r) => s + r.quantity, 0);
    const glazing = entryRows
      .filter((r) => r.schedule_type === "glazing")
      .reduce((s, r) => s + r.quantity, 0);

    const confidenceParts = [
      ...entryRows.map((r) => r.confidence),
      ...selected.map((s) => s.confidence),
    ].filter((n) => n > 0);
    const confidence = confidenceParts.length
      ? confidenceParts.reduce((a, b) => a + b, 0) / confidenceParts.length
      : 0;

    await setRun("needs_approval", {
      stage_message: entryRows.length
        ? `${windows} window and ${doors} door unit(s) read from ${scheduleSheets.length} schedule sheet(s)`
        : "No schedule rows could be read — review the selected sheets",
      sheets_total: pdf.numPages,
      sheets_analyzed: total,
      sheets_selected: selected.length,
      schedules_found: scheduleSheets.length,
      window_count: windows + glazing,
      door_count: doors,
      confidence,
      working_set_id: workingSetId,
      used_vision: useVision,
      provider: provider ?? null,
      model: model ?? null,
      error_message: null,
    });
    // Best-effort: persist the final vision aggregate on the run row.
    // Text-pipeline window_count/door_count are left untouched so both
    // counts stay visible for cross-checking.
    if (runId && visionSheetsScanned > 0) {
      try {
        await supabase
          .from("plan_analysis_runs")
          .update({
            vision_window_count: visionWindows,
            vision_door_count: visionDoors,
            vision_sheets_scanned: visionSheetsScanned,
          })
          .eq("id", runId);
      } catch {
        // Migration not pushed yet — vision counts remain visible via facts.
      }
    }

    await logAudit({
      projectId,
      action: "analysis.completed",
      entityType: "document",
      entityId: doc.id,
      detail: {
        document: doc.name,
        sheets: total,
        selected: selected.length,
        windows: windows + glazing,
        doors,
        schedules: scheduleSheets.length,
        provider: provider ?? "unknown",
      },
    });

    return { runId, windows: windows + glazing, doors };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plan pre-analysis failed.";
    await setRun("failed", { stage_message: message, error_message: message.slice(0, 500) });
    await logAudit({ projectId, action: "analysis.failed", detail: { error: message } });
    return { runId, windows: 0, doors: 0, error: message };
  }
}

/**
 * Marks a completed pre-analysis as reviewed so the full takeoff can continue.
 * Nothing is discarded: the accumulated intelligence is stamped as
 * estimator-confirmed and later stages refine it instead of re-analysing.
 */
export async function approvePreAnalysis(projectId: string, runId: string) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  await supabase
    .from("plan_analysis_runs")
    .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: userId })
    .eq("id", runId);
  const { confirmProjectIntelligence } = await import("@/lib/intelligence/store");
  await confirmProjectIntelligence(projectId, runId, userId);
  await logAudit({
    projectId,
    action: "analysis.approved",
    entityType: "plan_analysis_run",
    entityId: runId,
    detail: { model: "project_intelligence_confirmed" },
  });
}

export function categoryName(category: string) {
  return CATEGORY_LABELS[category as SheetCategory] ?? "Not takeoff relevant";
}

/**
 * Watches for newly readable documents and starts the pre-analysis in the
 * background — no manual trigger, once per document.
 */
export function usePlanPreAnalysis(projectId: string, enabled: boolean) {
  const qc = useQueryClient();
  const running = useRef(false);
  const seen = useRef(new Set<string>());
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);

  const run = useCallback(
    async (options?: { documentId?: string | null; tradeFocus?: TradeFocus | null }) => {
      if (running.current || activeProjects.has(projectId)) return;
      running.current = true;
      activeProjects.add(projectId);
      try {
        const result = await runPlanPreAnalysis({
          projectId,
          documentId: options?.documentId ?? null,
          tradeFocus: options?.tradeFocus ?? null,
          onProgress: setProgress,
        });
        for (const key of [
          "plan-analysis-run",
          "plan-analysis-sheets",
          "plan-analysis-entries",
          "plan-analysis-issues",
          "plan-analysis-quantities",
          "project-intelligence",
          "working-sets-full",
          "working-sets",
          "project-overview",
          "activity",
        ]) {
          qc.invalidateQueries({ queryKey: [key, projectId] });
        }
        return result;
      } finally {
        running.current = false;
        activeProjects.delete(projectId);
        window.setTimeout(() => setProgress(null), 4000);
      }
    },
    [projectId, qc],
  );

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    const tick = async () => {
      if (!active || running.current) return;

      const { data: docs } = await supabase
        .from("documents")
        .select("id")
        .eq("project_id", projectId)
        .not("storage_path", "is", null)
        .in("status", ["ready", "partially_failed"])
        .order("created_at", { ascending: true });
      const readable = docs ?? [];
      if (!readable.length) return;

      // Pre-analysis follows project-information extraction, so wait until the
      // extraction run for this document has settled before spending AI calls.
      const { data: extractionRuns } = await supabase
        .from("project_extraction_runs")
        .select("document_id,status")
        .eq("project_id", projectId);
      const settled = new Set(
        (extractionRuns ?? [])
          .filter((r) => ["needs_review", "complete", "failed"].includes(r.status ?? ""))
          .map((r) => r.document_id),
      );

      const { data: runs } = await supabase
        .from("plan_analysis_runs")
        .select("document_id,status,updated_at")
        .eq("project_id", projectId);
      // A run abandoned mid-flight (tab closed, reload) would otherwise pin the
      // document as "seen" forever, so treat a stalled busy run as resumable.
      const staleCutoff = Date.now() - 3 * 60 * 1000;
      for (const r of runs ?? []) {
        if (!r.document_id) continue;
        const stalled =
          isAnalysisBusy(r.status) && new Date(r.updated_at ?? 0).getTime() < staleCutoff;
        if (stalled) seen.current.delete(r.document_id);
        else seen.current.add(r.document_id);
      }

      const next = readable.find((d) => !seen.current.has(d.id) && settled.has(d.id));
      if (!next) return;
      seen.current.add(next.id);
      await run({ documentId: next.id });
    };

    void tick();
    const id = window.setInterval(() => void tick(), 9000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [enabled, projectId, run]);

  /** Clears a hung in-tab run so a manual restart can proceed. */
  const forceReset = useCallback(() => {
    running.current = false;
    activeProjects.delete(projectId);
  }, [projectId]);

  /** Stops the current scan: flags cancellation, clears in-tab state, and marks
   * the latest run as cancelled in the DB so the UI stops spinning. */
  const stop = useCallback(async () => {
    requestCancelPreAnalysis(projectId);
    running.current = false;
    activeProjects.delete(projectId);
    setProgress(null);
    const { data } = await supabase
      .from("plan_analysis_runs")
      .select("id")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      await supabase
        .from("plan_analysis_runs")
        .update({
          status: "cancelled",
          stage_message: "Stopped by user",
          error_message: "Scan stopped by user.",
        })
        .eq("id", data.id);
    }
    for (const key of ["plan-analysis-run", "activity"]) {
      qc.invalidateQueries({ queryKey: [key, projectId] });
    }
  }, [projectId, qc]);

  return { progress, run, forceReset, stop };
}
