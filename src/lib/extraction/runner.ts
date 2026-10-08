import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadPdfFromUrl, extractPageText, renderPageToDataUrl } from "@/lib/pdf-client";
import { signedUrl } from "@/lib/storage-client";
import { logAudit } from "@/lib/audit";
import { extractProjectInfo, geocodeAddress } from "./extraction.functions";
import { EXTRACTION_FIELDS, FIELD_BY_KEY, HIGH_CONFIDENCE, scorePageText } from "./fields";

export type ExtractionStage =
  | "queued"
  | "reading_text"
  | "analyzing_sheets"
  | "extracting"
  | "geocoding"
  | "needs_review"
  | "complete"
  | "failed";

export const STAGE_LABELS: Record<ExtractionStage, string> = {
  queued: "Waiting",
  reading_text: "Reading text",
  analyzing_sheets: "Analyzing cover/title sheets",
  extracting: "Extracting project details",
  geocoding: "Geocoding",
  needs_review: "Needs review",
  complete: "Complete",
  failed: "Failed",
};

const MAX_TEXT_PAGES = 40;
const TOP_SHEETS = 6;
const MIN_TEXT_CHARS = 400;

type ProjectRow = Record<string, unknown>;

const PROJECT_COLUMNS = [
  "id",
  "latitude",
  "longitude",
  ...new Set(EXTRACTION_FIELDS.filter((f) => f.column).map((f) => f.column as string)),
].join(",");

function isBlank(value: unknown) {
  return (
    value === null || value === undefined || (typeof value === "string" && value.trim() === "")
  );
}

function coerce(fieldKey: string, value: string): string | number | null {
  const field = FIELD_BY_KEY.get(fieldKey);
  if (!field) return value;
  if (field.type === "integer") {
    const n = parseInt(value.replace(/[^\d-]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }
  if (field.type === "date") {
    const iso = value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    if (iso) return iso;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }
  return value;
}

function sameValue(a: unknown, b: unknown) {
  if (a === null || a === undefined) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

export type RunProgress = { stage: ExtractionStage; message: string };

/** Guards against two mounted surfaces starting the same project's scan twice. */
const activeProjects = new Set<string>();

/**
 * Document-first project information extraction.
 *
 * Reads the plan set (embedded PDF text first, sheet images only when a set is
 * scanned), extracts project record fields with the routed AI provider,
 * auto-fills only blank project fields, raises conflicts for user-confirmed
 * values, and geocodes the highest-ranked project-site address.
 */
export async function runProjectExtraction(opts: {
  projectId: string;
  documentId?: string | null;
  missingOnly?: boolean;
  onProgress?: (progress: RunProgress) => void;
}): Promise<{ runId: string | null; fields: number; needsReview: boolean; error?: string }> {
  const { projectId } = opts;
  const report = (stage: ExtractionStage, message: string) => opts.onProgress?.({ stage, message });

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
          .in("status", ["ready", "partially_failed", "processing"])
          .order("created_at", { ascending: false })
          .limit(1)
      ).data;

  const doc = docs?.[0];
  if (!doc?.storage_path)
    return { runId: null, fields: 0, needsReview: false, error: "No readable document yet." };

  const { data: runRow } = await supabase
    .from("project_extraction_runs")
    .insert({
      project_id: projectId,
      document_id: doc.id,
      status: "reading_text",
      stage_message: `Reading ${doc.name}`,
      created_by: userId,
    })
    .select("id")
    .maybeSingle();
  const runId = runRow?.id ?? null;

  const setRun = async (status: ExtractionStage, patch: Record<string, unknown> = {}) => {
    report(status, String(patch.stage_message ?? STAGE_LABELS[status]));
    if (runId)
      await supabase
        .from("project_extraction_runs")
        .update({ status, ...patch })
        .eq("id", runId);
  };

  try {
    report("reading_text", `Reading ${doc.name}`);
    const url = await signedUrl("plan-files", doc.storage_path, 3600);
    const pdf = await loadPdfFromUrl(url);
    const total = Math.min(pdf.numPages, MAX_TEXT_PAGES);

    const scored: { pageNumber: number; text: string; score: number }[] = [];
    let textChars = 0;
    for (let n = 1; n <= total; n += 1) {
      const text = await extractPageText(pdf, n);
      textChars += text.length;
      scored.push({ pageNumber: n, text, score: scorePageText(text, n) });
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, TOP_SHEETS).filter((s) => s.text.length > 40);

    await supabase
      .from("project_extraction_runs")
      .update({ pages_scanned: total, pages_total: pdf.numPages })
      .eq("id", runId ?? "");

    const { data: pageRows } = await supabase
      .from("pages")
      .select("id,page_number,sheet_number")
      .eq("document_id", doc.id);
    const pageByNumber = new Map((pageRows ?? []).map((p) => [p.page_number, p]));

    const scanned = textChars < MIN_TEXT_CHARS || top.length === 0;
    const images: string[] = [];
    let sheets = top.map((s) => ({
      pageNumber: s.pageNumber,
      sheetLabel: pageByNumber.get(s.pageNumber)?.sheet_number ?? null,
      text: s.text,
    }));

    if (scanned) {
      await setRun("analyzing_sheets", {
        stage_message: "Scanned set — rendering cover sheets for vision",
        used_vision: true,
      });
      const pageNumbers = scored
        .slice(0, 3)
        .map((s) => s.pageNumber)
        .sort((a, b) => a - b);
      for (const n of pageNumbers) images.push(await renderPageToDataUrl(pdf, n, 1500));
      sheets = pageNumbers.map((n) => ({
        pageNumber: n,
        sheetLabel: pageByNumber.get(n)?.sheet_number ?? null,
        text: "",
      }));
    } else {
      await setRun("analyzing_sheets", {
        stage_message: `Ranked ${top.length} likely cover/title/code sheets`,
      });
    }

    // Only ask for fields the project still needs when re-running incrementally.
    const { data: project } = await supabase
      .from("projects")
      .select(PROJECT_COLUMNS)
      .eq("id", projectId)
      .maybeSingle();
    const projectRow = (project ?? {}) as ProjectRow;
    const missingOnly = opts.missingOnly
      ? EXTRACTION_FIELDS.filter((f) => !f.column || isBlank(projectRow[f.column])).map(
          (f) => f.key,
        )
      : null;

    await setRun("extracting", { stage_message: "Extracting project details" });
    const result = await extractProjectInfo({
      data: {
        projectId,
        taskCategory: images.length ? "vision_analysis" : "document_summarization",
        sheets,
        images,
        missingOnly,
      },
    });

    if (result.error && !result.fields.length) {
      await setRun("failed", {
        stage_message: result.error,
        error_message: result.error.slice(0, 500),
      });
      await logAudit({
        projectId,
        action: "extraction.failed",
        entityType: "document",
        entityId: doc.id,
        detail: { document: doc.name, error: result.error },
      });
      return { runId, fields: 0, needsReview: false, error: result.error };
    }

    // ---- Persist every extracted field with provenance --------------------
    const updates: Record<string, unknown> = {};
    const rows = result.fields.map((f) => {
      const page = f.pageNumber ? pageByNumber.get(f.pageNumber) : undefined;
      const field = FIELD_BY_KEY.get(f.key);
      const coerced = field?.column ? coerce(f.key, f.value) : null;
      let status: "auto_applied" | "pending" | "conflict" = "pending";
      let applied = false;
      let conflictValue: string | null = null;

      if (field?.column && coerced !== null && coerced !== "") {
        const current = projectRow[field.column];
        if (isBlank(current)) {
          updates[field.column] = coerced;
          status = "auto_applied";
          applied = true;
        } else if (sameValue(current, coerced)) {
          status = "auto_applied";
          applied = true;
        } else {
          status = "conflict";
          conflictValue = String(current);
        }
      }

      return {
        project_id: projectId,
        run_id: runId,
        document_id: doc.id,
        page_id: page?.id ?? null,
        field_key: f.key,
        value: f.value,
        confidence: f.confidence,
        source_sheet: page?.sheet_number ?? (f.pageNumber ? `Page ${f.pageNumber}` : null),
        source_page_number: f.pageNumber,
        snippet: f.snippet,
        status,
        applied,
        conflict_value: conflictValue,
      };
    });

    if (rows.length) await supabase.from("project_field_extractions").insert(rows);
    if (Object.keys(updates).length) {
      await supabase
        .from("projects")
        .update(updates as never)
        .eq("id", projectId);
    }

    // ---- Address candidates + ranking -------------------------------------
    const addressRows = result.addresses.map((a) => {
      const page = a.pageNumber ? pageByNumber.get(a.pageNumber) : undefined;
      return {
        project_id: projectId,
        run_id: runId,
        document_id: doc.id,
        page_id: page?.id ?? null,
        raw_address: a.address,
        role: a.role,
        score: a.score,
        label: a.label,
        source_sheet: page?.sheet_number ?? (a.pageNumber ? `Page ${a.pageNumber}` : null),
        selected: false,
        geocode_status: "pending" as const,
      };
    });
    let insertedAddresses: { id: string; raw_address: string; role: string; score: number }[] = [];
    if (addressRows.length) {
      const { data: inserted } = await supabase
        .from("project_address_candidates")
        .insert(addressRows)
        .select("id,raw_address,role,score");
      insertedAddresses = inserted ?? [];
    }

    await logAudit({
      projectId,
      action: "extraction.completed",
      entityType: "document",
      entityId: doc.id,
      detail: {
        document: doc.name,
        fields: rows.length,
        addresses: addressRows.length,
        mode: images.length ? "vision" : "text",
        provider: result.provider ?? "unknown",
      },
    });

    // ---- Geocoding of the highest ranked site address ---------------------
    const best = [...insertedAddresses].sort((a, b) => b.score - a.score)[0];
    const unambiguous = best && insertedAddresses.filter((a) => a.role === "site").length <= 1;
    if (best && unambiguous) {
      await setRun("geocoding", { stage_message: `Geocoding ${best.raw_address}` });
      await geocodeCandidate({
        projectId,
        candidateId: best.id,
        address: best.raw_address,
        apply: true,
      });
    }

    const needsReview =
      rows.some((r) => r.status !== "auto_applied") || insertedAddresses.length > 1;
    await setRun(needsReview ? "needs_review" : "complete", {
      stage_message: needsReview
        ? `${rows.filter((r) => r.status !== "auto_applied").length} field(s) need review`
        : `${rows.length} field(s) auto-filled`,
      fields_found: rows.length,
    });

    return { runId, fields: rows.length, needsReview };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed.";
    await setRun("failed", { stage_message: message, error_message: message.slice(0, 500) });
    await logAudit({ projectId, action: "extraction.failed", detail: { error: message } });
    return { runId, fields: 0, needsReview: false, error: message };
  }
}

/** Geocodes one candidate and (optionally) writes coordinates onto the project. */
export async function geocodeCandidate(opts: {
  projectId: string;
  candidateId: string;
  address: string;
  apply: boolean;
}) {
  const result = await geocodeAddress({ data: { address: opts.address } });
  await supabase
    .from("project_address_candidates")
    .update({
      geocode_status: result.ok ? "geocoded" : "failed",
      geocode_provider: result.provider,
      geocode_error: result.ok ? null : (result.error ?? "Geocoding failed."),
      latitude: result.latitude ?? null,
      longitude: result.longitude ?? null,
      city: result.city ?? null,
      county: result.county ?? null,
      state: result.state ?? null,
      postal_code: result.postalCode ?? null,
      country: result.country ?? null,
      selected: opts.apply,
    })
    .eq("id", opts.candidateId);

  if (opts.apply) {
    await supabase
      .from("project_address_candidates")
      .update({ selected: false })
      .eq("project_id", opts.projectId)
      .neq("id", opts.candidateId);

    const { data: project } = await supabase
      .from("projects")
      .select("address,latitude,longitude,city,county,state,postal_code")
      .eq("id", opts.projectId)
      .maybeSingle();
    const patch: Record<string, unknown> = {};
    if (project && isBlank(project.address)) patch.address = opts.address;
    if (result.ok) {
      if (project && (project.latitude === null || project.longitude === null)) {
        patch.latitude = result.latitude;
        patch.longitude = result.longitude;
      }
      if (project && isBlank(project.city) && result.city) patch.city = result.city;
      if (project && isBlank(project.county) && result.county) patch.county = result.county;
      if (project && isBlank(project.state) && result.state) patch.state = result.state;
      if (project && isBlank(project.postal_code) && result.postalCode)
        patch.postal_code = result.postalCode;
    }
    if (Object.keys(patch).length)
      await supabase
        .from("projects")
        .update(patch as never)
        .eq("id", opts.projectId);
  }

  await logAudit({
    projectId: opts.projectId,
    action: result.ok ? "extraction.geocoded" : "extraction.geocode_failed",
    entityType: "address_candidate",
    entityId: opts.candidateId,
    detail: {
      address: opts.address,
      provider: result.provider,
      error: result.error,
      precision: result.precision ?? null,
      matchedQuery: result.matchedQuery ?? null,
    },
  });

  return result;
}

/** Accept (optionally with an edited value), or reject, one extracted field. */
export async function decideField(opts: {
  projectId: string;
  id: string;
  fieldKey: string;
  decision: "accept" | "reject";
  value?: string;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const field = FIELD_BY_KEY.get(opts.fieldKey);
  const value = (opts.value ?? "").trim();
  const now = new Date().toISOString();

  if (opts.decision === "reject") {
    await supabase
      .from("project_field_extractions")
      .update({
        status: "rejected",
        applied: false,
        decided_by: userData.user?.id ?? null,
        decided_at: now,
      })
      .eq("id", opts.id);
  } else {
    await supabase
      .from("project_field_extractions")
      .update({
        status: "accepted",
        applied: Boolean(field?.column),
        value: value || undefined,
        decided_by: userData.user?.id ?? null,
        decided_at: now,
      })
      .eq("id", opts.id);
    if (field?.column && value) {
      const coerced = coerce(opts.fieldKey, value);
      if (coerced !== null)
        await supabase
          .from("projects")
          .update({ [field.column]: coerced } as never)
          .eq("id", opts.projectId);
    }
  }

  await logAudit({
    projectId: opts.projectId,
    action: opts.decision === "accept" ? "extraction.field_accepted" : "extraction.field_rejected",
    entityType: "project_field",
    entityId: opts.id,
    detail: {
      field: field?.label ?? opts.fieldKey,
      value: opts.decision === "accept" ? value : undefined,
    },
  });
}

/** Accepts every pending field at or above the high-confidence threshold. */
export async function acceptAllHighConfidence(projectId: string) {
  const { data } = await supabase
    .from("project_field_extractions")
    .select("id,field_key,value,confidence,status")
    .eq("project_id", projectId)
    .in("status", ["pending", "conflict"])
    .gte("confidence", HIGH_CONFIDENCE);
  for (const row of data ?? []) {
    await decideField({
      projectId,
      id: row.id,
      fieldKey: row.field_key,
      decision: "accept",
      value: row.value,
    });
  }
  return data?.length ?? 0;
}

/**
 * Watches the project for its first readable document and starts extraction
 * automatically. Runs at most once per document unless re-run manually.
 */
export function useProjectExtraction(projectId: string, enabled: boolean) {
  const qc = useQueryClient();
  const running = useRef(false);
  const seen = useRef(new Set<string>());
  const [progress, setProgress] = useState<RunProgress | null>(null);

  const run = useCallback(
    async (options?: { documentId?: string | null; missingOnly?: boolean }) => {
      if (running.current || activeProjects.has(projectId)) return;
      running.current = true;
      activeProjects.add(projectId);
      try {
        const result = await runProjectExtraction({
          projectId,
          documentId: options?.documentId ?? null,
          missingOnly: options?.missingOnly ?? false,
          onProgress: setProgress,
        });
        qc.invalidateQueries({ queryKey: ["project", projectId] });
        qc.invalidateQueries({ queryKey: ["extracted-fields", projectId] });
        qc.invalidateQueries({ queryKey: ["address-candidates", projectId] });
        qc.invalidateQueries({ queryKey: ["extraction-runs", projectId] });
        qc.invalidateQueries({ queryKey: ["project-activity", projectId] });
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

      const { data: runs } = await supabase
        .from("project_extraction_runs")
        .select("document_id,status")
        .eq("project_id", projectId);
      for (const r of runs ?? []) if (r.document_id) seen.current.add(r.document_id);

      const next = readable.find((d) => !seen.current.has(d.id));
      if (!next) return;
      seen.current.add(next.id);
      await run({ documentId: next.id, missingOnly: (runs ?? []).length > 0 });
    };

    void tick();
    const id = window.setInterval(() => void tick(), 8000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [enabled, projectId, run]);

  return { progress, run };
}
