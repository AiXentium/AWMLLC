/**
 * Server-only prompt building and model execution for plan pre-analysis.
 * Provider keys are only ever read through providers.server.
 */
import { SHEET_CATEGORIES, isSheetCategory, type SheetCategory } from "./shared";
import { callWithRetry, estimateCostUsd, type ProviderKey } from "@/lib/ai/providers.server";
import { ocrSourceLabel, type OcrSource } from "@/lib/ocr/types";

export type Candidate = { provider: ProviderKey; model: string };

export type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
};

export type ClassifiedSheet = {
  pageNumber: number;
  category: SheetCategory;
  confidence: number;
  reason: string | null;
};

export type ScheduleRow = {
  pageNumber: number | null;
  scheduleType: "window" | "door" | "glazing";
  mark: string | null;
  typeLabel: string | null;
  width: string | null;
  height: string | null;
  quantity: number;
  material: string | null;
  glazing: string | null;
  operation: string | null;
  notes: string | null;
  confidence: number;
};

export const CLASSIFY_SYSTEM = `You classify construction drawing sheets for a window and door takeoff at AWM LLC.

Hard rules:
- Judge only from the supplied sheet number, title and sheet text. Never invent a sheet.
- A sheet is a schedule only when it actually contains a tabular schedule of window, door or glazing units (marks, sizes, quantities) — not when it merely references one.
- Elevations show the exterior/interior faces of the building. Floor plans show the plan view. Reflected ceiling plans are labelled RCP or "reflected ceiling".
- Roof plans show the roof layout, slopes, drains, scuppers and roofing materials — classify them as roof_plan, not floor_plan.
- Confidence must reflect evidence strength: 0.9+ for an explicit title match, 0.6-0.85 when clearly implied, below 0.6 when uncertain.
- Reply with JSON only. No markdown fences, no commentary.`;

export const SCHEDULE_SYSTEM = `You read window, door and glazing schedules from construction drawings for AWM LLC.

Hard rules:
- Transcribe only rows that literally appear in the supplied schedule text or image. Never invent a mark, size or quantity.
- Keep the mark exactly as printed (W1, W-12, D03, SF2, CW-4).
- Quantity is the printed count for that mark; when no count column exists use 1.
- Keep widths and heights as printed, including feet-inch marks; do not convert units.
- Classify each row: "window" for window units, "door" for swing/sliding/entrance doors, "glazing" for storefront, curtain wall and window wall.
- Omit header, legend, note and total rows.
- Reply with JSON only. No markdown fences, no commentary.`;

export const TITLE_BLOCK_SYSTEM = `You read title blocks on construction drawing sheets for AWM LLC.

Hard rules:
- Extract only the sheet number and sheet title as printed. Never invent one.
- Sheet numbers look like A-101, A101, S-201, E-301, P-001, FP-1, G-001 (discipline prefix + number).
- The sheet title is the descriptive name, e.g. "First Floor Plan", "North Elevation", "Window Schedule".
- If you cannot find a sheet number or title, use null for that field. Do not guess.
- Confidence must reflect evidence strength: 0.9+ for an explicit title-block match, 0.6-0.85 when clearly implied, below 0.6 when uncertain.
- Reply with JSON only. No markdown fences, no commentary.`;

export type TitleBlockSheet = {
  pageNumber: number;
  sheet_number: string | null;
  title: string | null;
  confidence: number;
};

export function buildTitleBlockPrompt(sheets: { pageNumber: number; text: string }[]): string {
  const blocks = sheets
    .map(
      (s) =>
        `--- PAGE ${s.pageNumber} ---\n${s.text.slice(0, 1500) || "(no text layer on this sheet)"}`,
    )
    .join("\n\n");

  return [
    "Extract the sheet number and sheet title from the title block of each sheet below.",
    "",
    blocks,
    "",
    "Return JSON exactly in this shape, one entry per supplied page:",
    `{"sheets":[{"page":4,"sheet_number":"A-101","title":"First Floor Plan","confidence":0.94}]}`,
  ].join("\n");
}

export function normalizeTitleBlock(raw: unknown): TitleBlockSheet[] {
  const out: TitleBlockSheet[] = [];
  const root =
    raw && typeof raw === "object" && "sheets" in raw ? (raw as { sheets: unknown }).sheets : raw;
  if (!Array.isArray(root)) return out;
  for (const s of root) {
    if (!s || typeof s !== "object") continue;
    const r = s as Record<string, unknown>;
    const pageNumber = Number(r.page ?? r.pageNumber ?? 0);
    if (!pageNumber) continue;
    const sheet_number =
      typeof r.sheet_number === "string" && r.sheet_number.trim()
        ? r.sheet_number.trim().slice(0, 20).toUpperCase()
        : null;
    const title =
      typeof r.title === "string" && r.title.trim() ? r.title.trim().slice(0, 120) : null;
    const confidence =
      typeof r.confidence === "number"
        ? Math.min(1, Math.max(0, r.confidence))
        : sheet_number || title
          ? 0.6
          : 0;
    out.push({ pageNumber, sheet_number, title, confidence });
  }
  return out;
}

export function buildClassifyPrompt(
  sheets: {
    pageNumber: number;
    sheetLabel: string | null;
    title: string | null;
    text: string;
    hint: string;
  }[],
) {
  const blocks = sheets
    .map(
      (s) =>
        `--- PAGE ${s.pageNumber}${s.sheetLabel ? ` (${s.sheetLabel})` : ""}${s.title ? ` — ${s.title}` : ""} ---\n` +
        `keyword guess: ${s.hint}\n${s.text.slice(0, 1600) || "(no text layer on this sheet)"}`,
    )
    .join("\n\n");

  return [
    "Classify every sheet below for a window and door takeoff.",
    "",
    blocks,
    "",
    `Allowed "category" values: ${SHEET_CATEGORIES.join(", ")}.`,
    'Use "other" for structural, mechanical, electrical, plumbing, civil and landscape sheets.',
    "",
    "Return JSON exactly in this shape, one entry per supplied page:",
    `{"sheets":[{"page":4,"category":"window_schedule","confidence":0.94,"reason":"Titled WINDOW SCHEDULE with mark/size columns"}]}`,
  ].join("\n");
}

export function buildSchedulePrompt(
  sheets: {
    pageNumber: number;
    sheetLabel: string | null;
    category: string;
    text: string;
    ocrSource?: OcrSource | null;
    ocrConfidence?: number | null;
    ocrNeedsReview?: boolean | null;
  }[],
  hasImages: boolean,
) {
  const blocks = sheets
    .map((s) => {
      const header = `--- PAGE ${s.pageNumber}${s.sheetLabel ? ` (${s.sheetLabel})` : ""} — classified ${s.category} ---`;
      const provenance =
        s.ocrSource && s.ocrSource !== "pdf-text" && s.ocrSource !== "none"
          ? `[OCR transcription via ${ocrSourceLabel(s.ocrSource)}${s.ocrConfidence != null ? `, avg confidence ${Math.round(s.ocrConfidence)}%` : ""}${s.ocrNeedsReview ? ", LOW CONFIDENCE — verify every value" : ""}]`
          : s.ocrSource === "pdf-text"
            ? "[PDF text layer — exact]"
            : "";
      const body =
        s.text.slice(0, 8000) || "(no text layer — read the attached image for this sheet)";
      return `${header}\n${provenance ? provenance + "\n" : ""}${body}`;
    })
    .join("\n\n");

  return [
    hasImages
      ? "These schedule sheets have no usable text layer, so page images are attached in the same order. Read the schedule tables from the images."
      : "Schedule sheet text extracted from the PDF text layer follows.",
    "",
    blocks,
    "",
    "Transcribe every window, door and glazing schedule row you can read.",
    "ANTI-INVENTION RULES — follow strictly:",
    "1. Transcribe ONLY values you can actually read. Never invent a mark, size, quantity or material.",
    "2. When text is marked [OCR transcription], quote the transcription — do not 'correct' it into something plausible.",
    "3. When text is marked LOW CONFIDENCE, set confidence below 0.6 for every row from that page.",
    "4. If a cell is unreadable, leave the field null or empty — never guess.",
    "5. Copy dimensions EXACTLY as printed (3'-0\", 3060, 914) — do not convert or round.",
    "",
    "Return JSON exactly in this shape:",
    `{"rows":[{"page":4,"scheduleType":"window","mark":"W1","type":"Single Hung","width":"3'-0\\"","height":"5'-0\\"","quantity":8,"material":"Aluminum","glazing":"Impact insulated","operation":"Single hung","notes":"","confidence":0.9}]}`,
  ].join("\n");
}

function parseJsonBlock(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Model did not return JSON.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function clampConfidence(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n > 1 ? n / 100 : n));
}

function cleanText(value: unknown, max: number): string | null {
  const text = String(value ?? "").trim();
  if (!text || /^(n\/?a|none|unknown|-|—)$/i.test(text)) return null;
  return text.slice(0, max);
}

export function normalizeClassification(raw: unknown): ClassifiedSheet[] {
  const obj = (raw ?? {}) as { sheets?: unknown[] };
  const out: ClassifiedSheet[] = [];
  const seen = new Set<number>();
  for (const item of obj.sheets ?? []) {
    const row = item as {
      page?: unknown;
      category?: unknown;
      confidence?: unknown;
      reason?: unknown;
    };
    const page = Number(row.page);
    if (!Number.isFinite(page) || page <= 0 || seen.has(page)) continue;
    seen.add(page);
    const category = isSheetCategory(row.category) ? row.category : "other";
    out.push({
      pageNumber: Math.trunc(page),
      category,
      confidence: clampConfidence(row.confidence),
      reason: cleanText(row.reason, 300),
    });
  }
  return out;
}

export function normalizeSchedule(raw: unknown): ScheduleRow[] {
  const obj = (raw ?? {}) as { rows?: unknown[] };
  const out: ScheduleRow[] = [];
  for (const item of (obj.rows ?? []).slice(0, 400)) {
    const row = item as Record<string, unknown>;
    const mark = cleanText(row.mark, 24);
    const typeLabel = cleanText(row.type ?? row.typeLabel, 120);
    if (!mark && !typeLabel) continue;
    const typeRaw = String(row.scheduleType ?? "window").toLowerCase();
    const scheduleType: ScheduleRow["scheduleType"] =
      typeRaw === "door" ? "door" : typeRaw === "glazing" ? "glazing" : "window";
    const qty = Number(row.quantity);
    const page = Number(row.page);
    out.push({
      pageNumber: Number.isFinite(page) && page > 0 ? Math.trunc(page) : null,
      scheduleType,
      mark,
      typeLabel,
      width: cleanText(row.width, 40),
      height: cleanText(row.height, 40),
      quantity: Number.isFinite(qty) && qty > 0 ? Math.min(9999, Math.trunc(qty)) : 1,
      material: cleanText(row.material, 80),
      glazing: cleanText(row.glazing, 120),
      operation: cleanText(row.operation, 80),
      notes: cleanText(row.notes, 300),
      confidence: clampConfidence(row.confidence),
    });
  }
  return out;
}

/** Runs one prompt through the routed chain, returning raw JSON text. */
export async function runAnalysisModel(input: {
  chain: Candidate[];
  system: string;
  prompt: string;
  images: string[];
  maxOutputTokens: number | null;
}): Promise<{
  raw?: unknown;
  provider?: string;
  model?: string;
  usage?: ModelUsage;
  error?: string;
}> {
  if (!input.chain.length) {
    return { error: "No AI provider is configured for plan analysis." };
  }

  const attempts: string[] = [];
  for (const candidate of input.chain) {
    try {
      const result = await callWithRetry({
        provider: candidate.provider,
        model: candidate.model,
        system: input.system,
        prompt: input.prompt,
        images: input.images.length ? input.images : undefined,
        maxOutputTokens: input.maxOutputTokens ?? 4096,
        timeoutMs: 90_000,
      });
      return {
        raw: parseJsonBlock(result.text),
        provider: result.provider,
        model: result.model,
        usage: {
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costUsd: estimateCostUsd(result.model, result.inputTokens, result.outputTokens),
          latencyMs: result.latencyMs,
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Plan analysis model request failed.";
      attempts.push(`${candidate.provider}/${candidate.model}: ${msg.slice(0, 160)}`);
    }
  }
  return { error: `All providers failed — ${attempts.join(" | ")}` };
}
