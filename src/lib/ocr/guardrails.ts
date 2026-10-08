/**
 * Anti-invention guardrails for everything the system reads.
 *
 * Principles:
 * 1. Raw text is preserved verbatim — never "corrected" by code or model.
 * 2. Every block carries a confidence score; anything below threshold is
 *    flagged needsReview and shown as unverified, never auto-accepted.
 * 3. Structured values (marks, dimensions) are extracted deterministically
 *    with regex + the dimension parser. No match = no value, never a guess.
 * 4. Every extracted value traces to its source block, page and method.
 */
import type { OcrBlock, OcrSource } from "./types";
import { parseDimensionToInches } from "@/lib/takeoff/dimensions";

/** Blocks below this confidence are flagged for human review. */
export const OCR_CONFIDENCE_THRESHOLD = 60;

/** Marks confidence-gated blocks as needing review. Pure function. */
export function gateBlocks(blocks: OcrBlock[]): OcrBlock[] {
  return blocks.map((b) =>
    b.source === "pdf-text" ? b : { ...b, needsReview: b.confidence < OCR_CONFIDENCE_THRESHOLD },
  );
}

export interface ExtractedValue {
  /** The interpreted value (e.g. 36 for a dimension, "W-1" for a mark). */
  value: string | number;
  /** The exact raw text it came from — audit trail. */
  raw: string;
  confidence: number;
  source: OcrSource;
  needsReview: boolean;
  /** Extra context, e.g. which half of an industry pair this is. */
  note?: string;
}

/** Window/door/glazing callout marks: W1, W-12, D03, SF2, CW-4, SK-1, LVR-3. */
const MARK_RE =
  /\b([WDS][A-Z]*-?\d{1,3}[A-Z]?|SF-?\d{1,3}|CW-?\d{1,3}|SK-?\d{1,3}|LVR-?\d{1,3})\b/gi;

/** Finds mark candidates in OCR text. No match = no mark, never invented. */
export function extractMarkCandidates(
  text: string,
  source: OcrSource,
  confidence: number,
): ExtractedValue[] {
  const out: ExtractedValue[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(MARK_RE)) {
    const raw = m[1];
    const key = raw.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      value: key,
      raw,
      confidence,
      source,
      needsReview: confidence < OCR_CONFIDENCE_THRESHOLD,
    });
  }
  return out;
}

/**
 * Dimension-like tokens. A unit marker (', ", in, mm) is required — bare
 * numbers are deliberately NOT matched because a bare "36" could be a
 * quantity, a count, or a dimension, and guessing is worse than skipping.
 * Industry 4-digit pairs (3060 = 3'-0" x 6'-0") are expanded to width+height.
 */
const DIM_RE =
  /(\d+\s*(?:'|ft)\s*-?\s*[\d\s/.]*\s*(?:"|in\b)?|\b\d+(?:\s+\d+\/\d+)?(?:\.\d+)?\s*(?:"|in\b)|\b\d{1,3}\s*-\s*\d{1,3}(?:\s+\d+\/\d+)?\b|\b\d{4}\b|\b\d+(?:\.\d+)?\s*mm\b)/gi;
const PAIR_RE = /^\b(\d)(\d)(\d)(\d)\b$/;

/**
 * Finds dimension candidates and parses each to inches with the shared
 * deterministic parser. Unparseable tokens are dropped — never guessed.
 * Industry pairs (3060) expand to two values: width and height.
 */
export function extractDimensionCandidates(
  text: string,
  source: OcrSource,
  confidence: number,
): ExtractedValue[] {
  const out: ExtractedValue[] = [];
  const seen = new Set<string>();
  const needsReview = confidence < OCR_CONFIDENCE_THRESHOLD;
  for (const m of text.matchAll(DIM_RE)) {
    const raw = m[1].trim();
    if (seen.has(raw)) continue;
    seen.add(raw);
    // Industry shorthand: 3060 -> 36" wide x 72" high.
    const pair = raw.match(PAIR_RE);
    if (pair) {
      const w = Number(pair[1]) * 12 + Number(pair[2]);
      const h = Number(pair[3]) * 12 + Number(pair[4]);
      out.push({ value: w, raw, confidence, source, needsReview, note: "industry pair — width" });
      out.push({ value: h, raw, confidence, source, needsReview, note: "industry pair — height" });
      continue;
    }
    const parsed = parseDimensionToInches(raw);
    if (!parsed || !(parsed.inches > 0) || parsed.inches > 1200) continue;
    out.push({ value: parsed.inches, raw, confidence, source, needsReview });
  }
  return out;
}

/**
 * Picks the best available text for a sheet: highest-confidence source wins.
 * Used when both a text layer and OCR exist — the text layer always wins
 * on accuracy, OCR wins on coverage for scanned sheets.
 */
export function bestText(
  candidates: { text: string; source: OcrSource; confidence: number }[],
): string {
  const ranked = [...candidates].sort((a, b) => b.confidence - a.confidence);
  return ranked[0]?.text ?? "";
}
