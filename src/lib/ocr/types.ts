/**
 * OCR types — the document reading layer for plan sheets.
 *
 * Every piece of text the system reads carries its source and confidence.
 * Nothing below the confidence threshold is ever auto-accepted: it is
 * flagged for estimator review instead of being guessed.
 */

export type OcrSource =
  "pdf-text" | "tesseract" | "google-document-ai" | "azure-document-intelligence" | "none";

/** Human label for an OCR source. */
export function ocrSourceLabel(source: OcrSource): string {
  switch (source) {
    case "pdf-text":
      return "PDF text layer";
    case "tesseract":
      return "Tesseract OCR";
    case "google-document-ai":
      return "Google Document AI";
    case "azure-document-intelligence":
      return "Azure Document Intelligence";
    default:
      return "unread";
  }
}

export interface OcrBox {
  /** Pixels in the rendered page image (or PDF points for text-layer blocks). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrBlock {
  /** Verbatim text — never altered, corrected, or "cleaned up". */
  text: string;
  /** 0–100. pdf-text blocks report 100 (embedded text is exact). */
  confidence: number;
  box: OcrBox | null;
  source: OcrSource;
  /** True when confidence is below threshold — must be human-verified. */
  needsReview: boolean;
}

export interface OcrPageResult {
  pageNumber: number;
  source: OcrSource;
  blocks: OcrBlock[];
  /** Blocks joined in reading order, verbatim. */
  text: string;
  /** Mean block confidence, 0–100. -1 when not applicable. */
  avgConfidence: number;
  /** True when any block needs review or the page could not be read. */
  needsReview: boolean;
  charCount: number;
}

export const EMPTY_OCR: OcrPageResult = {
  pageNumber: 0,
  source: "none",
  blocks: [],
  text: "",
  avgConfidence: -1,
  needsReview: true,
  charCount: 0,
};
